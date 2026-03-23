import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { getMailerWithSettings, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplate } from '@/lib/email/templates';

async function findUserIdByEmail(supabase: any, email: string) {
  const perPage = 200;
  for (let page = 1; page <= 10; page += 1) {
    const res = await supabase.auth.admin.listUsers({ page, perPage });
    if (res.error) throw res.error;
    const users = res.data?.users || [];
    const u = users.find((x: any) => String(x?.email || '').toLowerCase() === email.toLowerCase());
    if (u?.id) return String(u.id);
    if (users.length < perPage) return null;
  }
  return null;
}

function pickProfilePatch(perms: any) {
  const out: any = {};
  for (const [k, v] of Object.entries(perms || {})) {
    const key = String(k);
    if (key === 'is_admin' || key === 'is_member' || key === 'can_manage_admins' || key.startsWith('can_view_') || key.startsWith('can_edit_')) {
      out[key] = !!v;
    }
  }
  return out;
}

async function ensureMemberRole(supabase: any) {
  const res = await supabase.from('app_roles').select('id,name,permissions,color_hex').eq('name', 'ČLEN').maybeSingle();
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
    .single();
  if (created.error) throw created.error;
  return created.data;
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) throw new Error('Forbidden');

    const body = await req.json().catch(() => ({}));
    const applicationId = String(body?.applicationId || body?.id || '').trim();
    const lang = body?.lang === 'en' ? 'en' : 'cs';
    if (!applicationId) return NextResponse.json({ error: 'Missing applicationId' }, { status: 400 });

    const supabase = getServerSupabase();
    const appRes = await supabase.from('applications').select('*').eq('id', applicationId).single();
    if (appRes.error) throw appRes.error;

    const app: any = appRes.data;
    const email = String(app?.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

    const firstName = String(app?.first_name || String(app?.full_name || app?.name || '').split(' ')[0] || '').trim();
    const lastName = String(app?.last_name || String(app?.full_name || app?.name || '').split(' ').slice(1).join(' ') || '').trim();

    const origin = new URL(req.url).origin;
    const redirectTo = `${origin}/${lang}/reset-password`;

    const role = await ensureMemberRole(supabase);
    const rolePerms = role?.permissions && typeof role.permissions === 'object' ? role.permissions : {};
    const patch = pickProfilePatch(rolePerms);

    const existingUserId = await findUserIdByEmail(supabase, email);
    let userId = existingUserId;
    let actionUrl = '';

    if (!userId) {
      const invite = await supabase.auth.admin.generateLink({ type: 'invite', email, options: { redirectTo } } as any);
      if (invite.error) throw invite.error;
      userId = String((invite.data as any)?.user?.id || '');
      actionUrl = String((invite.data as any)?.properties?.action_link || '');
    } else {
      const rec = await supabase.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo } } as any);
      if (rec.error) throw rec.error;
      actionUrl = String((rec.data as any)?.properties?.action_link || '');
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
      ], { onConflict: 'user_id' })
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

    const transporter = await getMailerWithSettings();
    const from = await getSenderFromSettings();
    const { subject, html } = renderEmailTemplate('member_access', { toEmail: email, firstName, actionUrl, lang });
    await transporter.sendMail({ from, to: email, subject, html });

    await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'APPLICATION_APPROVED_ACCESS_SENT',
          target_id: String(applicationId),
          details: { email, user_id: userId, role_id: role.id, role_name: role.name },
        },
      ])
      .throwOnError();

    return NextResponse.json({ ok: true, userId, email });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
