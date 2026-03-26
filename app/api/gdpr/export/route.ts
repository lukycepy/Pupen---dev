import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireMember } from '@/lib/server-auth';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

export async function GET(req: Request) {
  try {
    const { user } = await requireMember(req);
    const ip = getClientIp(req) || 'unknown';
    const rl = rateLimit({ key: `gdpr_export:${user.id}:${ip}`, windowMs: 60 * 60 * 1000, max: 5 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Příliš mnoho požadavků. Zkuste to prosím později.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
      );
    }

    const supabase = getServerSupabase();
    const email = String(user.email || '').toLowerCase();

    const profileRes = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (profileRes.error) throw profileRes.error;

    const rsvpRes = email
      ? await supabase.from('rsvp').select('*').eq('email', email).order('created_at', { ascending: false }).limit(500)
      : { data: [], error: null as any };
    if ((rsvpRes as any).error) throw (rsvpRes as any).error;

    const badgesRes = await supabase.from('user_badges').select('*, gamification_badges(*)').eq('user_id', user.id);
    const applicationsRes = await supabase.from('member_applications').select('*').eq('email', email);
    
    await supabase.from('admin_logs').insert([{
      admin_email: user.email || 'system',
      admin_name: 'GDPR Export',
      action: 'EXPORT_DOWNLOAD',
      target_id: user.id,
      details: { format: 'json', type: 'gdpr_all', exportedBy: user.id }
    }]);

    const prefsRes = await supabase
      .from('admin_logs')
      .select('created_at, details')
      .eq('action', 'USER_EMAIL_PREFS')
      .eq('target_id', String(user.id))
      .order('created_at', { ascending: false })
      .limit(20);
    if (prefsRes.error) throw prefsRes.error;

    const pollVotesRes = await supabase
      .from('admin_logs')
      .select('created_at, target_id, details')
      .eq('action', 'POLL_VOTE')
      .eq('details->>userId', user.id)
      .order('created_at', { ascending: false })
      .limit(500);
    if (pollVotesRes.error) throw pollVotesRes.error;

    const reportsRes = await supabase
      .from('admin_logs')
      .select('created_at, action, target_id, details')
      .like('action', 'REPORT:%')
      .eq('details->>reporterId', user.id)
      .order('created_at', { ascending: false })
      .limit(300);
    if (reportsRes.error) throw reportsRes.error;

    const refundsRes = email
      ? await supabase
          .from('admin_logs')
          .select('created_at, action, target_id, details')
          .eq('action', 'REFUND_REQUEST')
          .eq('admin_email', email)
          .order('created_at', { ascending: false })
          .limit(100)
      : { data: [], error: null as any };
    if ((refundsRes as any).error) throw (refundsRes as any).error;

    const projectsRes = await supabase
      .from('admin_logs')
      .select('created_at, action, target_id, details')
      .eq('action', 'PROJECT')
      .order('created_at', { ascending: false })
      .limit(500);
    if (projectsRes.error) throw projectsRes.error;
    const projects = (projectsRes.data || []).filter((r: any) => {
      const d = r.details || {};
      if (!email) return false;
      const members = Array.isArray(d.members) ? d.members : [];
      const memberEmails = members.map((m: any) => String(m?.email || '').toLowerCase());
      const ownerEmail = String(d.ownerEmail || d.owner_email || '').toLowerCase();
      return ownerEmail === email || memberEmails.includes(email);
    });

    let dm = { threads: [] as any[], messages: [] as any[] };
    try {
      const threadsRes = await supabase
        .from('dm_threads')
        .select('*')
        .or(`participant1_id.eq.${user.id},participant2_id.eq.${user.id}`)
        .order('updated_at', { ascending: false })
        .limit(200);
      if (!threadsRes.error && threadsRes.data) {
        const threadIds = (threadsRes.data || []).map((t: any) => String(t.id));
        const msgsRes = threadIds.length
          ? await supabase.from('dm_messages').select('*').in('thread_id', threadIds as any).order('created_at', { ascending: false }).limit(500)
          : { data: [], error: null as any };
        if (!(msgsRes as any).error) {
          dm = { threads: threadsRes.data || [], messages: (msgsRes as any).data || [] };
        } else {
          dm = { threads: threadsRes.data || [], messages: [] };
        }
      }
    } catch {}

    const exportedAt = new Date().toISOString();
    const payload = {
      exportedAt,
      user: { id: user.id, email: user.email || null },
      profile: profileRes.data || null,
      rsvp: (rsvpRes as any).data || [],
      badges: (badgesRes as any).data || [],
      applications: (applicationsRes as any).data || [],
      emailPreferencesLogs: prefsRes.data || [],
      pollVotes: pollVotesRes.data || [],
      reports: reportsRes.data || [],
      refundRequests: (refundsRes as any).data || [],
      projects,
      dm,
    };

    const date = exportedAt.slice(0, 10);
    const body = JSON.stringify(payload, null, 2);
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename=\"pupen_gdpr_export_${date}.json\"`,
      },
    });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
