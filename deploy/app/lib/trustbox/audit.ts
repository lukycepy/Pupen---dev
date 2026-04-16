import { getServerSupabase } from '@/lib/supabase-server';
import { getClientIp } from '@/lib/rate-limit';

export type TrustBoxAuditAction =
  | 'ADMIN_VIEW_PII'
  | 'ADMIN_EXPORT_PDF'
  | 'ADMIN_DOWNLOAD_ATTACHMENT'
  | 'ADMIN_MESSAGE_SENT';

export async function logTrustBoxAudit(input: {
  req: Request;
  actorUserId?: string | null;
  actorEmail?: string | null;
  action: TrustBoxAuditAction;
  threadId?: string | null;
  attachmentId?: string | null;
  piiAccessed?: boolean;
  reason?: string | null;
}) {
  const supabase = getServerSupabase();
  const ip = getClientIp(input.req) || null;
  const userAgent = String(input.req.headers.get('user-agent') || '').slice(0, 300) || null;
  const reason = input.reason != null ? String(input.reason).trim().slice(0, 500) : null;
  await supabase.from('trust_box_audit_logs').insert([
    {
      actor_user_id: input.actorUserId || null,
      actor_email: input.actorEmail || null,
      action: input.action,
      thread_id: input.threadId || null,
      attachment_id: input.attachmentId || null,
      pii_accessed: input.piiAccessed === true,
      reason,
      ip,
      user_agent: userAgent,
    },
  ]);
}

