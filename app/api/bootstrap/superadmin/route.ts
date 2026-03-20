import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';

function requireBootstrap(req: Request) {
  const secret = process.env.PUPEN_BOOTSTRAP_SECRET;
  if (!secret) throw new Error('Bootstrap disabled');
  const provided = req.headers.get('x-pupen-bootstrap') || '';
  if (!provided || provided !== secret) throw new Error('Unauthorized');
}

function buildFullAdminPermissions(email: string) {
  return {
    email,
    is_admin: true,
    is_member: true,
    can_manage_admins: true,
    can_view_events: true,
    can_edit_events: true,
    can_view_news: true,
    can_edit_news: true,
    can_view_faq: true,
    can_edit_faq: true,
    can_view_partners: true,
    can_edit_partners: true,
    can_view_apps: true,
    can_edit_apps: true,
    can_view_documents: true,
    can_edit_documents: true,
    can_view_gallery: true,
    can_edit_gallery: true,
    can_view_map: true,
    can_edit_map: true,
    can_view_hunts: true,
    can_edit_hunts: true,
    can_view_budget: true,
    can_edit_budget: true,
    can_view_logs: true,
    can_edit_logs: true,
    can_view_messages: true,
    can_edit_messages: true,
    can_view_meetings: true,
    can_edit_meetings: true,
    can_view_polls: true,
    can_edit_polls: true,
    can_view_quizzes: true,
    can_edit_quizzes: true,
    can_view_jobs: true,
    can_edit_jobs: true,
    can_view_schedule: true,
    can_edit_schedule: true,
    can_view_guide: true,
    can_edit_guide: true,
    can_view_hours: true,
    can_edit_hours: true,
    can_view_discounts: true,
    can_edit_discounts: true,
    can_view_feedback: true,
    can_edit_feedback: true,
    can_view_qr: true,
    can_edit_qr: true,
    can_view_assets: true,
    can_edit_assets: true,
    can_view_archive: true,
    can_edit_archive: true,
    can_view_books: true,
    can_edit_books: true,
    can_view_blog_mod: true,
    can_edit_blog_mod: true,
    can_view_reviews: true,
    can_edit_reviews: true,
  };
}

export async function POST(req: Request) {
  try {
    requireBootstrap(req);

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    const firstName = String(body?.first_name || '');
    const lastName = String(body?.last_name || '');

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 });
    }
    if (!password || password.length < 10) {
      return NextResponse.json({ error: 'Weak password' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const created = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      },
    });
    if (created.error) throw created.error;
    const userId = created.data?.user?.id;
    if (!userId) throw new Error('User not created');

    const profilePatch = {
      first_name: firstName || null,
      last_name: lastName || null,
      ...buildFullAdminPermissions(email),
    };

    const { error: updErr } = await supabase.from('profiles').update(profilePatch).eq('id', userId);
    if (updErr) throw updErr;

    return NextResponse.json({ ok: true, email });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Bootstrap disabled' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

