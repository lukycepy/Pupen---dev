import { getServerSupabase } from '@/lib/supabase-server';
import { sanitizeLogMessage, sanitizeLogValue } from '@/lib/logs/sanitize';

export async function writeAdminAudit(input: {
  adminEmail: string | null | undefined;
  adminName?: string | null | undefined;
  action: string;
  targetId?: string | null | undefined;
  details?: any;
}) {
  const admin_email = input.adminEmail ? sanitizeLogMessage(input.adminEmail).slice(0, 200) : null;
  if (!admin_email) return;

  const admin_name = input.adminName ? sanitizeLogMessage(input.adminName).slice(0, 200) : null;
  const action = sanitizeLogMessage(input.action).slice(0, 300);
  const target_id = input.targetId ? sanitizeLogMessage(input.targetId).slice(0, 200) : null;
  const details = input.details == null ? {} : sanitizeLogValue(input.details);

  try {
    const supabase = getServerSupabase();
    await supabase.from('admin_logs').insert([{ admin_email, admin_name, action, target_id, details }]);
  } catch {}
}
