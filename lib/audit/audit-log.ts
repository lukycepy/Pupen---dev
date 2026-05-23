import { getClientIp } from '@/lib/rate-limit';
import { sanitizeLogMessage, sanitizeLogValue } from '@/lib/logs/sanitize';
import { getServerSupabase } from '@/lib/supabase-server';

function isSchemaCacheMissingTable(e: any) {
  const msg = String(e?.message || '');
  return msg.includes('Could not find the table') && msg.includes('in the schema cache');
}

export type AuditEntity = {
  type: string;
  id?: string | null;
};

export async function writeAuditLog(input: {
  req?: Request | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
  action: string;
  entity?: AuditEntity | null;
  before?: any;
  after?: any;
  details?: any;
}) {
  const action = sanitizeLogMessage(input.action).slice(0, 300);
  if (!action) return;

  const actor_user_id = input.actorUserId ? sanitizeLogMessage(input.actorUserId).slice(0, 200) : null;
  const actor_email = input.actorEmail ? sanitizeLogMessage(input.actorEmail).slice(0, 200) : null;

  const entity_type = input.entity?.type ? sanitizeLogMessage(input.entity.type).slice(0, 120) : null;
  const entity_id = input.entity?.id ? sanitizeLogMessage(input.entity.id).slice(0, 200) : null;

  const ip = input.req ? getClientIp(input.req) : null;
  const user_agent = input.req ? String(input.req.headers.get('user-agent') || '').slice(0, 300) || null : null;

  const details = sanitizeLogValue({
    ...(input.details == null ? {} : input.details),
    before: input.before == null ? null : input.before,
    after: input.after == null ? null : input.after,
  });

  try {
    const supabase = getServerSupabase();
    const res = await supabase.from('audit_logs').insert([
      {
        actor_user_id,
        actor_email,
        action,
        entity_type,
        entity_id,
        details,
        ip,
        user_agent,
      },
    ]);
    if (res.error) throw res.error;
  } catch (e: any) {
    if (!isSchemaCacheMissingTable(e)) {
      return;
    }
  }
}
