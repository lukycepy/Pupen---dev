import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';
import { getMailer } from '@/lib/email/mailer';
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
  const transporter = getMailer();
  const { subject, html } = renderEmailTemplate('admin_password', { email, password, firstName });
  await transporter.sendMail({
    from: '"Pupen Control" <info@pupen.org>',
    to: email,
    subject,
    html,
  });
}

export async function POST(req: Request) {
  try {
    const { user: adminUser } = await requireAdmin(req);
    const supabase = getServerSupabase();

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || '').trim().toLowerCase();
    const first_name = String(body?.first_name || '').trim();
    const last_name = String(body?.last_name || '').trim();
    const providedPassword = typeof body?.password === 'string' ? body.password : '';
    const shouldSend = body?.send_password !== false;

    if (!email || !email.includes('@')) return NextResponse.json({ error: 'Missing email' }, { status: 400 });
    if (!first_name || !last_name) return NextResponse.json({ error: 'Missing name' }, { status: 400 });

    const password = providedPassword || generatePassword(14);

    let userId = await findUserIdByEmail(supabase, email);
    let created = false;

    if (!userId) {
      const res = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name, last_name },
      });
      if (res.error) throw res.error;
      userId = res.data?.user?.id || null;
      created = true;
    } else {
      const upd = await supabase.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: { first_name, last_name },
      });
      if (upd.error) throw upd.error;
    }

    if (!userId) throw new Error('User not resolved');

    const profilePatch = pickProfilePatch({
      ...body,
      email,
      first_name,
      last_name,
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

    if (shouldSend) {
      await sendPasswordEmail(email, password, first_name);
    }

    return NextResponse.json({ ok: true, id: userId, email, created });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

