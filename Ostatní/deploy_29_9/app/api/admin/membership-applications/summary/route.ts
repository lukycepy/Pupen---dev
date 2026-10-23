import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

interface MembershipApplicationSummaryRow {
  id?: string | null;
  status?: string | null;
  email?: string | null;
  user_id?: string | null;
  created_at?: string | null;
}

interface ProfileEmailRow {
  id?: string | null;
  email?: string | null;
}

interface AdminLogRow {
  action?: string | null;
  target_id?: string | null;
  created_at?: string | null;
  details?: Record<string, unknown> | null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function collectDuplicates<T extends { email?: string | null }>(rows: T[]) {
  const counts = new Map<string, { count: number; sampleId: string | null }>();
  for (const row of rows) {
    const email = normalizeEmail(row.email);
    if (!email) continue;
    const current = counts.get(email);
    if (current) {
      current.count += 1;
    } else {
      counts.set(email, { count: 1, sampleId: 'id' in row && row.id ? String((row as { id?: string | null }).id || '') : null });
    }
  }
  return Array.from(counts.entries())
    .filter(([, meta]) => meta.count > 1)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([email, meta]) => ({ email, count: meta.count, sampleApplicationId: meta.sampleId }));
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const supabase = getServerSupabase();

    const [appsRes, profilesRes, accessLogsRes, dedupeLogsRes] = await Promise.all([
      supabase
        .from('membership_applications_v2')
        .select('id,status,email,user_id,created_at')
        .order('created_at', { ascending: false })
        .limit(5000),
      supabase.from('profiles').select('id,email').limit(10000),
      supabase
        .from('admin_logs')
        .select('target_id,created_at,details')
        .eq('action', 'MEMBERSHIP_APPLICATION_APPROVED_ACCESS_SENT')
        .order('created_at', { ascending: false })
        .limit(5000),
      supabase
        .from('admin_logs')
        .select('action,target_id,created_at,details')
        .eq('action', 'MEMBERSHIP_APPLICATION_DEDUPE_REVIEWED')
        .order('created_at', { ascending: false })
        .limit(5000),
    ]);

    if (appsRes.error) throw appsRes.error;
    if (profilesRes.error) throw profilesRes.error;
    if (accessLogsRes.error) throw accessLogsRes.error;
    if (dedupeLogsRes.error) throw dedupeLogsRes.error;

    const apps = (appsRes.data || []) as MembershipApplicationSummaryRow[];
    const profiles = (profilesRes.data || []) as ProfileEmailRow[];
    const accessLogs = (accessLogsRes.data || []) as AdminLogRow[];
    const dedupeLogs = (dedupeLogsRes.data || []) as AdminLogRow[];

    const pendingCount = apps.filter((row) => String(row.status || '') === 'pending').length;
    const approved = apps.filter((row) => String(row.status || '') === 'approved');
    const approvedCount = approved.length;
    const rejectedCount = apps.filter((row) => String(row.status || '') === 'rejected').length;

    const accessLogByAppId = new Map<string, AdminLogRow>();
    for (const row of accessLogs) {
      const id = String(row.target_id || '').trim();
      if (!id || accessLogByAppId.has(id)) continue;
      accessLogByAppId.set(id, row);
    }

    const reviewedApplicationIds = new Set<string>();
    for (const row of dedupeLogs) {
      const id = String(row.target_id || '').trim();
      if (id) reviewedApplicationIds.add(id);
    }

    const approvedWithoutUserId = approved.filter((row) => !String(row.user_id || '').trim());
    const approvedWithoutAccessLog = approved.filter((row) => !accessLogByAppId.has(String(row.id || '').trim()));
    const duplicateApplicationEmails = collectDuplicates(apps.filter((row) => !reviewedApplicationIds.has(String(row.id || '').trim())));
    const duplicateProfileEmails = collectDuplicates(profiles);

    return NextResponse.json({
      ok: true,
      stats: {
        pendingCount,
        approvedCount,
        rejectedCount,
        approvedWithoutUserIdCount: approvedWithoutUserId.length,
        approvedWithoutAccessLogCount: approvedWithoutAccessLog.length,
        duplicateApplicationEmailCount: duplicateApplicationEmails.length,
        duplicateProfileEmailCount: duplicateProfileEmails.length,
        reviewedDuplicateApplicationCount: reviewedApplicationIds.size,
      },
      issues: {
        approvedWithoutUserId: approvedWithoutUserId.slice(0, 8).map((row) => ({
          id: row.id || null,
          email: row.email || null,
          createdAt: row.created_at || null,
        })),
        approvedWithoutAccessLog: approvedWithoutAccessLog.slice(0, 8).map((row) => ({
          id: row.id || null,
          email: row.email || null,
          createdAt: row.created_at || null,
        })),
        duplicateApplicationEmails: duplicateApplicationEmails.slice(0, 8),
        duplicateProfileEmails: duplicateProfileEmails.slice(0, 8),
      },
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
