import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { withSchemaCacheRetry } from '@/lib/schema-cache-retry';

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const supabase = getServerSupabase();

    const profRes = await withSchemaCacheRetry(supabase, () =>
      supabase
        .from('profiles')
        .select('is_admin, can_manage_admins, can_view_analytics')
        .eq('id', user.id)
        .maybeSingle(),
    );
    if ((profRes as any).error) throw (profRes as any).error;
    const profile = (profRes as any).data as any;
    if (!profile?.is_admin && !profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!profile?.can_manage_admins && !profile?.can_view_analytics) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const [eventsRes, postsRes, rsvpCountRes, recentActivityRes, pendingAppsRes, recentLogsRes] = await Promise.all([
      withSchemaCacheRetry(supabase, () =>
        supabase.from('events').select('id, title, views').order('views', { ascending: false }).limit(5),
      ),
      withSchemaCacheRetry(supabase, () =>
        supabase.from('posts').select('id, title, views').order('views', { ascending: false }).limit(5),
      ),
      withSchemaCacheRetry(supabase, () => supabase.from('rsvp').select('id', { count: 'exact', head: true })),
      withSchemaCacheRetry(supabase, () =>
        supabase.from('admin_logs').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      ),
      withSchemaCacheRetry(supabase, () =>
        supabase.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ),
      withSchemaCacheRetry(supabase, () =>
        supabase
          .from('admin_logs')
          .select('id, created_at, admin_email, admin_name, action, target_id')
          .order('created_at', { ascending: false })
          .limit(8),
      ),
    ]);

    for (const r of [eventsRes, postsRes, rsvpCountRes, recentActivityRes, pendingAppsRes, recentLogsRes] as any[]) {
      if (r?.error) throw r.error;
    }

    const topEvents = (eventsRes as any).data || [];
    const topPosts = (postsRes as any).data || [];
    const totalEventViews = topEvents.reduce((acc: number, curr: any) => acc + (curr?.views || 0), 0);
    const totalPostViews = topPosts.reduce((acc: number, curr: any) => acc + (curr?.views || 0), 0);

    return NextResponse.json({
      ok: true,
      topEvents,
      topPosts,
      totalRSVPs: Number((rsvpCountRes as any)?.count || 0),
      totalViews: totalEventViews + totalPostViews,
      recentActivity: Number((recentActivityRes as any)?.count || 0),
      pendingApplications: Number((pendingAppsRes as any)?.count || 0),
      recentLogs: (recentLogsRes as any).data || [],
    });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
