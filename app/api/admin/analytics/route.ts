import { NextResponse } from 'next/server';
import { getBearerToken, getEffectiveProfileByToken } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { withSchemaCacheRetry } from '@/lib/schema-cache-retry';

interface AnalyticsProfileRow {
  is_admin?: boolean | null;
  can_manage_admins?: boolean | null;
  can_view_analytics?: boolean | null;
  can_edit_analytics?: boolean | null;
  has_admin_access?: boolean | null;
}

interface AnalyticsContentRow {
  id?: string | null;
  title?: string | null;
  views?: number | null;
  published_at?: string | null;
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

function isMissingColumn(error: unknown, table: string, column: string) {
  const message = getErrorMessage(error);
  return new RegExp(table, 'i').test(message) && new RegExp(column, 'i').test(message) && /(schema cache|column|does not exist)/i.test(message);
}

function isMissingRelation(error: unknown, relation: string) {
  const message = getErrorMessage(error);
  return new RegExp(relation, 'i').test(message) && /(schema cache|does not exist|relation|table)/i.test(message);
}

async function fetchTopContentWithFallback(
  supabase: ReturnType<typeof getServerSupabase>,
  table: 'events' | 'posts',
) {
  try {
    const res = await withSchemaCacheRetry(supabase, () =>
      supabase.from(table).select('id, title, views').order('views', { ascending: false }).limit(5),
    );
    const typedRes = res as RetryResult<AnalyticsContentRow[]>;
    if (typedRes.error) throw typedRes.error;
    return typedRes.data || [];
  } catch (error: unknown) {
    if (isMissingRelation(error, table)) return [];
    if (!isMissingColumn(error, table, 'views')) throw error;

    try {
      const fallbackRes = await withSchemaCacheRetry(supabase, () =>
        supabase.from(table).select('id, title, published_at').order('published_at', { ascending: false }).limit(5),
      );
      const typedFallbackRes = fallbackRes as RetryResult<AnalyticsContentRow[]>;
      if (typedFallbackRes.error) throw typedFallbackRes.error;

      return (typedFallbackRes.data || []).map((item) => ({
        ...item,
        views: 0,
      }));
    } catch (fallbackError: unknown) {
      if (isMissingRelation(fallbackError, table)) return [];
      throw fallbackError;
    }
  }
}

async function fetchCountOrZero(
  supabase: ReturnType<typeof getServerSupabase>,
  relation: string,
  query: () => Promise<RetryResult<null>>,
) {
  try {
    const res = await query();
    if (res.error) throw res.error;
    return Number(res.count || 0);
  } catch (error: unknown) {
    if (isMissingRelation(error, relation)) return 0;
    throw error;
  }
}

async function fetchRecentLogsOrEmpty(supabase: ReturnType<typeof getServerSupabase>) {
  try {
    const res = await withSchemaCacheRetry(supabase, () =>
      supabase
        .from('admin_logs')
        .select('id, created_at, admin_email, admin_name, action, target_id')
        .order('created_at', { ascending: false })
        .limit(8),
    );
    const typedRes = res as RetryResult<AnalyticsAdminLogRow[]>;
    if (typedRes.error) throw typedRes.error;
    return typedRes.data || [];
  } catch (error: unknown) {
    if (isMissingRelation(error, 'admin_logs')) return [];
    if (!isMissingColumn(error, 'admin_logs', 'admin_email') && !isMissingColumn(error, 'admin_logs', 'admin_name')) throw error;

    const fallbackRes = await withSchemaCacheRetry(supabase, () =>
      supabase
        .from('admin_logs')
        .select('id, created_at, action, target_id')
        .order('created_at', { ascending: false })
        .limit(8),
    );
    const typedFallbackRes = fallbackRes as RetryResult<AnalyticsAdminLogRow[]>;
    if (typedFallbackRes.error) throw typedFallbackRes.error;
    return (typedFallbackRes.data || []).map((row) => ({
      ...row,
      admin_email: row.admin_email || null,
      admin_name: row.admin_name || null,
    }));
  }
}

export async function GET(req: Request) {
  try {
    const token = getBearerToken(req);
    if (!token) throw new Error('Unauthorized');

    const { user, profile } = await getEffectiveProfileByToken(token);
    const supabase = getServerSupabase();

    const effectiveProfile = profile as AnalyticsProfileRow | null;
    const hasAdminAccess = !!(effectiveProfile?.has_admin_access || effectiveProfile?.is_admin || effectiveProfile?.can_manage_admins);
    const hasAnalyticsAccess = !!(
      effectiveProfile?.can_manage_admins ||
      effectiveProfile?.can_view_analytics ||
      effectiveProfile?.can_edit_analytics
    );
    if (!hasAdminAccess || !hasAnalyticsAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const [topEvents, topPosts, totalRSVPs, recentActivity, pendingApplications, recentLogs] = await Promise.all([
      fetchTopContentWithFallback(supabase, 'events'),
      fetchTopContentWithFallback(supabase, 'posts'),
      fetchCountOrZero(supabase, 'rsvp', () =>
        withSchemaCacheRetry(supabase, () => supabase.from('rsvp').select('id', { count: 'exact', head: true })) as Promise<RetryResult<null>>,
      ),
      fetchCountOrZero(supabase, 'admin_logs', () =>
        withSchemaCacheRetry(supabase, () =>
          supabase.from('admin_logs').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        ) as Promise<RetryResult<null>>,
      ),
      fetchCountOrZero(supabase, 'membership_applications_v2', () =>
        withSchemaCacheRetry(supabase, () =>
          supabase.from('membership_applications_v2').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        ) as Promise<RetryResult<null>>,
      ),
      fetchRecentLogsOrEmpty(supabase),
    ]);

    const totalEventViews = topEvents.reduce((acc, curr) => acc + Number(curr.views || 0), 0);
    const totalPostViews = topPosts.reduce((acc, curr) => acc + Number(curr.views || 0), 0);

    return NextResponse.json({
      ok: true,
      topEvents,
      topPosts,
      totalRSVPs,
      totalViews: totalEventViews + totalPostViews,
      recentActivity,
      pendingApplications,
      recentLogs,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
