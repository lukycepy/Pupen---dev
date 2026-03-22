import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';
import { getMailerDebugInfoWithSettings, getMailerWithSettings, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplate } from '@/lib/email/templates';

function generatePassword(length = 14) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

const ALLOWED_PROFILE_FIELDS = new Set([
  'first_name',
  'last_name',
  'email',
  'is_admin',
  'is_member',
  'member_since',
  'can_manage_admins',
  'can_view_events',
  'can_edit_events',
  'can_view_news',
  'can_edit_news',
  'can_view_faq',
  'can_edit_faq',
  'can_view_partners',
  'can_edit_partners',
  'can_view_apps',
  'can_edit_apps',
  'can_view_documents',
  'can_edit_documents',
  'can_view_gallery',
  'can_edit_gallery',
  'can_view_map',
  'can_edit_map',
  'can_view_hunts',
  'can_edit_hunts',
  'can_view_budget',
  'can_edit_budget',
  'can_view_logs',
  'can_edit_logs',
  'can_view_messages',
  'can_edit_messages',
  'can_view_meetings',
  'can_edit_meetings',
  'can_view_polls',
  'can_edit_polls',
  'can_view_quizzes',
  'can_edit_quizzes',
  'can_view_jobs',
  'can_edit_jobs',
  'can_view_schedule',
  'can_edit_schedule',
  'can_view_guide',
  'can_edit_guide',
  'can_view_hours',
  'can_edit_hours',
  'can_view_discounts',
  'can_edit_discounts',
  'can_view_feedback',
  'can_edit_feedback',
  'can_view_qr',
  'can_edit_qr',
  'can_view_assets',
  'can_edit_assets',
  'can_view_archive',
  'can_edit_archive',
  'can_view_books',
  'can_edit_books',
  'can_view_blog_mod',
  'can_edit_blog_mod',
  'can_view_reviews',
  'can_edit_reviews',
]);

function pickProfilePatch(input: any) {
  const out: any = {};
  for (const [k, v] of Object.entries(input || {})) {
    if (!ALLOWED_PROFILE_FIELDS.has(k)) continue;
    out[k] = v;
  }
  if ('is_admin' in out) out.is_admin = !!out.is_admin;
  if ('is_member' in out) out.is_member = !!out.is_member;
  if ('can_manage_admins' in out) out.can_manage_admins = !!out.can_manage_admins;
  for (const k of Object.keys(out)) {
    if (k.startsWith('can_view_') || k.startsWith('can_edit_')) out[k] = !!out[k];
  }
  if ('member_since' in out && !out.member_since) out.member_since = null;
  return out;
}

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

async function sendPasswordEmail(email: string, password: string, firstName?: string) {
  const transporter = await getMailerWithSettings();
  const { subject, html } = renderEmailTemplate('admin_password', { email, password, firstName });
  const from = await getSenderFromSettings();
  await transporter.sendMail({
    from,
    to: email,
    subject,
    html,
  });
}

export async function POST(req: Request) {
  try {
    const { user: adminUser, profile: adminProfile } = await requireAdmin(req);
    if (!adminProfile?.can_manage_admins) throw new Error('Forbidden');
    const supabase = getServerSupabase();

    const body = await req.json().catch(() => ({}));
    const usersInput = Array.isArray(body?.users) ? body.users : null;

    async function upsertOne(input: any) {
      const email = String(input?.email || '').trim().toLowerCase();
      const first_name = String(input?.first_name || '').trim();
      const last_name = String(input?.last_name || '').trim();
      const providedPassword = typeof input?.password === 'string' ? input.password : '';
      const shouldSend = input?.send_password === true || (!providedPassword && input?.send_password !== false);

      if (!email || !email.includes('@')) return { ok: false, email, error: 'Missing email' };

      const password = providedPassword || generatePassword(14);

      let userId = await findUserIdByEmail(supabase, email);
      let created = false;

      const userMeta: any = {};
      if (first_name) userMeta.first_name = first_name;
      if (last_name) userMeta.last_name = last_name;

      if (!userId) {
        const res = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: userMeta,
        });
        if (res.error) throw res.error;
        userId = res.data?.user?.id || null;
        created = true;
      } else {
        const upd = await supabase.auth.admin.updateUserById(userId, {
          password,
          email_confirm: true,
          user_metadata: userMeta,
        });
        if (upd.error) throw upd.error;
      }

      if (!userId) throw new Error('User not resolved');

      const profilePatch = pickProfilePatch({
        ...input,
        email,
        first_name: first_name || null,
        last_name: last_name || null,
      });

      const { error: profErr } = await supabase.from('profiles').update(profilePatch).eq('id', userId);
      if (profErr) throw profErr;

      try {
        await supabase.from('admin_logs').insert([
          {
            admin_email: adminUser.email || 'admin',
            admin_name: 'Uživatelé',
            action: created ? 'USER_CREATE' : 'USER_MERGE_UPDATE',
            target_id: userId,
            details: { email, is_admin: !!profilePatch.is_admin, is_member: !!profilePatch.is_member },
          },
        ]);
      } catch {}

      let passwordSent = false;
      let passwordError: string | null = null;
      if (shouldSend) {
        try {
          await sendPasswordEmail(email, password, first_name || undefined);
          passwordSent = true;
        } catch (e: any) {
          passwordSent = false;
          passwordError = e?.message || 'Email send failed';
          const smtp = await getMailerDebugInfoWithSettings().catch(() => null);
          try {
            await supabase.from('admin_logs').insert([
              {
                admin_email: adminUser.email || 'admin',
                admin_name: 'Uživatelé',
                action: 'USER_PASSWORD_SEND_FAILED',
                target_id: userId,
                details: {
                  email,
                  error: passwordError,
                  smtp,
                  details: {
                    code: e?.code,
                    errno: e?.errno,
                    syscall: e?.syscall,
                    address: e?.address,
                    port: e?.port,
                    command: e?.command,
                    responseCode: e?.responseCode,
                  },
                },
              },
            ]);
          } catch {}
        }
      }

      return { ok: true, id: userId, email, created, passwordSent, passwordError };
    }

    if (usersInput) {
      const results: any[] = [];
      for (const u of usersInput.slice(0, 500)) {
        try {
          results.push(await upsertOne(u));
        } catch (e: any) {
          const email = String(u?.email || '').trim().toLowerCase();
          results.push({ ok: false, email, error: e?.message || 'Error' });
        }
      }
      return NextResponse.json({ ok: true, results });
    }

    const res = await upsertOne(body);
    if (!res.ok) return NextResponse.json({ error: res.error || 'Error' }, { status: 400 });
    return NextResponse.json(res);
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
