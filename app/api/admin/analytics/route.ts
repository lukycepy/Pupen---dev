import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { withSchemaCacheRetry } from '@/lib/schema-cache-retry';

interface AnalyticsProfileRow {
  is_admin?: boolean | null;
  can_manage_admins?: boolean | null;
  can_view_analytics?: boolean | null;
}

interface AnalyticsContentRow {
  id?: string | null;
  title?: string | null;
  views?: number | null;
}

interface AnalyticsAdminLogRow {
  id?: string | null;
  created_at?: string | null;
  admin_email?: string | null;
  admin_name?: string | null;
  action?: string | null;
  target_id?: string | null;
}

interface RetryResult<TData> {
  data: TData | null;
  error: Error | null;
  count?: number | null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

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
    const profileResult = profRes as RetryResult<AnalyticsProfileRow>;
    if (profileResult.error) throw profileResult.error;
    const profile = profileResult.data;
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
        supabase.from('membership_applications_v2').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ),
      withSchemaCacheRetry(supabase, () =>
        supabase
          .from('admin_logs')
          .select('id, created_at, admin_email, admin_name, action, target_id')
          .order('created_at', { ascending: false })
          .limit(8),
      ),
    ]);

    const typedEventsRes = eventsRes as RetryResult<AnalyticsContentRow[]>;
    const typedPostsRes = postsRes as RetryResult<AnalyticsContentRow[]>;
    const typedRsvpCountRes = rsvpCountRes as RetryResult<null>;
    const typedRecentActivityRes = recentActivityRes as RetryResult<null>;
    const typedPendingAppsRes = pendingAppsRes as RetryResult<null>;
    const typedRecentLogsRes = recentLogsRes as RetryResult<AnalyticsAdminLogRow[]>;

    for (const result of [typedEventsRes, typedPostsRes, typedRsvpCountRes, typedRecentActivityRes, typedPendingAppsRes, typedRecentLogsRes]) {
      if (result.error) throw result.error;
    }

    const topEvents = typedEventsRes.data || [];
    const topPosts = typedPostsRes.data || [];
    const totalEventViews = topEvents.reduce((acc, curr) => acc + Number(curr.views || 0), 0);
    const totalPostViews = topPosts.reduce((acc, curr) => acc + Number(curr.views || 0), 0);

    return NextResponse.json({
      ok: true,
      topEvents,
      topPosts,
      totalRSVPs: Number(typedRsvpCountRes.count || 0),
      totalViews: totalEventViews + totalPostViews,
      recentActivity: Number(typedRecentActivityRes.count || 0),
      pendingApplications: Number(typedPendingAppsRes.count || 0),
      recentLogs: typedRecentLogsRes.data || [],
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
