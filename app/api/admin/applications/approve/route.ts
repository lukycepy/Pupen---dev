import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { getMailerWithSettingsOrQueueTransporter, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { sendMailWithQueueFallback } from '@/lib/email/queue';
import { createSignedToken } from '@/lib/signed-token';
import { stripHtmlToText } from '@/lib/richtext-shared';
import { buildApplicationPdfBytes } from '@/lib/applications/pdf';
import { formatApplicationPdfFileName } from '@/lib/applications/pdfFilename';

export const runtime = 'nodejs';

type JsonRecord = Record<string, unknown>;

interface ApproveBody {
  applicationId?: unknown;
  id?: unknown;
  lang?: unknown;
}

interface AuthUserListRow {
  id?: string | null;
  email?: string | null;
}

interface GenerateLinkData {
  user?: { id?: string | null } | null;
  properties?: { action_link?: string | null } | null;
}

interface RoleRow {
  id?: string | number | null;
  name?: string | null;
  permissions?: JsonRecord | null;
  color_hex?: string | null;
}

interface ApplicationApproveRow {
  id?: string | number | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  name?: string | null;
  created_at?: string | null;
}

interface ProfileMemberRow {
  member_since?: string | null;
  member_expires_at?: string | null;
}

interface AssignMemberNoResponse {
  data: number | string | null;
  error: Error | null;
}

function toRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? (value as JsonRecord) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

async function findUserIdByEmail(supabase: ReturnType<typeof getServerSupabase>, email: string) {
  const perPage = 200;
  for (let page = 1; page <= 10; page += 1) {
    const res = await supabase.auth.admin.listUsers({ page, perPage });
    if (res.error) throw res.error;
    const users: AuthUserListRow[] = Array.isArray(res.data?.users) ? res.data.users : [];
    const u = users.find((x) => String(x.email || '').toLowerCase() === email.toLowerCase());
    if (u?.id) return String(u.id);
    if (users.length < perPage) return null;
  }
  return null;
}

function pickProfilePatch(perms: unknown) {
  const out: JsonRecord = {};
  const record = toRecord(perms);
  for (const [k, v] of Object.entries(record)) {
    const key = String(k);
    if (key === 'is_admin' || key === 'is_member' || key === 'can_manage_admins' || key.startsWith('can_view_') || key.startsWith('can_edit_')) {
      out[key] = !!v;
    }
  }
  return out;
}

async function ensureMemberRole(supabase: ReturnType<typeof getServerSupabase>) {
  const res = await supabase.from('app_roles').select('id,name,permissions,color_hex').eq('name', 'ČLEN').maybeSingle<RoleRow>();
  if (!res.error && res.data?.id) return res.data;

  const created = await supabase
    .from('app_roles')
    .insert([
      {
        name: 'ČLEN',
        color_hex: '#2563eb',
        permissions: { is_member: true, can_view_member_portal: true },
        updated_at: new Date().toISOString(),
      },
    ])
    .select('id,name,permissions,color_hex')
    .single<RoleRow>();
  if (created.error) throw created.error;
  return created.data;
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) throw new Error('Forbidden');

    const body = toRecord(await req.json().catch(() => ({})));
    const payload = body as ApproveBody;
    const applicationId = String(payload.applicationId || payload.id || '').trim();
    const lang = payload.lang === 'en' ? 'en' : 'cs';
    if (!applicationId) return NextResponse.json({ error: 'Missing applicationId' }, { status: 400 });

    const supabase = getServerSupabase();
    const appRes = await supabase.from('applications').select('*').eq('id', applicationId).single<ApplicationApproveRow>();
    if (appRes.error) throw appRes.error;

    const app = appRes.data;
    const email = String(app?.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

    const firstName = String(app?.first_name || String(app?.full_name || app?.name || '').split(' ')[0] || '').trim();
    const lastName = String(app?.last_name || String(app?.full_name || app?.name || '').split(' ').slice(1).join(' ') || '').trim();

    const origin = new URL(req.url).origin;
    const redirectTo = `${origin}/${lang}/reset-password`;

    const role = await ensureMemberRole(supabase);
    const rolePerms = toRecord(role?.permissions);
    const patch = pickProfilePatch(rolePerms);

    const existingUserId = await findUserIdByEmail(supabase, email);
    let userId = existingUserId;
    let actionUrl = '';

    if (!userId) {
      const invite = await supabase.auth.admin.generateLink({ type: 'invite', email, options: { redirectTo } });
      if (invite.error) throw invite.error;
      const inviteData = invite.data as GenerateLinkData | null;
      userId = String(inviteData?.user?.id || '');
      actionUrl = String(inviteData?.properties?.action_link || '');
    } else {
      const rec = await supabase.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo } });
      if (rec.error) throw rec.error;
      const recoveryData = rec.data as GenerateLinkData | null;
      actionUrl = String(recoveryData?.properties?.action_link || '');
    }

    if (!userId) throw new Error('Chybí userId');
    if (!actionUrl) throw new Error('Chybí aktivační odkaz');

    await supabase
      .from('app_user_roles')
      .upsert([
        {
          user_id: userId,
          role_id: String(role.id),
          assigned_at: new Date().toISOString(),
          assigned_by_email: user.email || null,
        },
      ], { onConflict: 'user_id,role_id' })
      .throwOnError();

    await supabase
      .from('profiles')
      .update({
        email,
        ...(firstName ? { first_name: firstName } : {}),
        ...(lastName ? { last_name: lastName } : {}),
        ...(Object.keys(patch).length ? patch : {}),
      })
      .eq('id', userId)
      .throwOnError();

    try {
      const prof = await supabase.from('profiles').select('member_since, member_expires_at').eq('id', userId).maybeSingle<ProfileMemberRow>();
      const cur: ProfileMemberRow = prof.data || {};
      const updates: Record<string, string> = {};
      if (!cur.member_since) updates.member_since = new Date().toISOString();
      if (!cur.member_expires_at) {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1);
        updates.member_expires_at = d.toISOString();
      }
      if (Object.keys(updates).length) {
        await supabase.from('profiles').update(updates).eq('id', userId);
      }
    } catch {}

    let memberNo: number | null = null;
    try {
      const m = await supabase.rpc('assign_member_no', { p_user_id: userId }) as AssignMemberNoResponse;
      if (!m.error) memberNo = typeof m.data === 'number' ? m.data : Number(m.data);
    } catch {}

    const transporter = await getMailerWithSettingsOrQueueTransporter();
    const from = await getSenderFromSettings();
    const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://pupen.org').replace(/\/$/, '');
    const actionUrlPublic = `${baseUrl}/api/auth/verify?u=${encodeURIComponent(actionUrl)}`;
    const tokenSecret = process.env.APPLICATION_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const pdfToken = createSignedToken({ appId: applicationId, email, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }, tokenSecret);
    const pdfUrl = `${baseUrl}/api/applications/pdf?t=${encodeURIComponent(pdfToken)}`;
    const { ascii: pdfAsciiName } = formatApplicationPdfFileName({ firstName, lastName, createdAt: app?.created_at });
    let pdfBytes: Buffer | null = null;
    try {
      pdfBytes = await buildApplicationPdfBytes(app);
    } catch {
      pdfBytes = null;
    }

    const tpl = await renderEmailTemplateWithDbOverride('application_approved_access', {
      toEmail: email,
      firstName,
      actionUrl: actionUrlPublic,
      pdfUrl,
      lang,
    });
    await sendMailWithQueueFallback({
      transporter,
      supabase,
      meta: { kind: 'application_approved_access', application_id: applicationId },
      message: {
        from,
        to: email,
        subject: tpl.subject,
        html: tpl.html,
        text: stripHtmlToText(tpl.html),
        replyTo: 'info@pupen.org',
        headers: { 'X-Pupen-Category': 'application', 'X-Pupen-Template': 'application_approved_access' },
        attachments:
          pdfBytes && Buffer.isBuffer(pdfBytes)
            ? [
                {
                  filename: pdfAsciiName,
                  content: pdfBytes,
                  contentType: 'application/pdf',
                },
              ]
            : undefined,
      },
    });

    await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'APPLICATION_APPROVED_ACCESS_SENT',
          target_id: String(applicationId),
          details: { email, user_id: userId, role_id: role.id, role_name: role.name, member_no: memberNo, pdf: true },
        },
      ])
      .throwOnError();

    return NextResponse.json({ ok: true, userId, email });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
