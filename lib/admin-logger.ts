import { supabase } from './supabase';
import { sanitizeLogMessage, sanitizeLogValue } from './logs/sanitize';

export async function logAdminAction(
  adminEmail: string | undefined | null,
  action: string,
  targetId?: string,
  details?: unknown,
  adminName?: string,
) {
  if (!adminEmail) return;
  try {
    const { error } = await supabase.from('admin_logs').insert([{
      admin_email: sanitizeLogMessage(adminEmail),
      admin_name: adminName ? sanitizeLogMessage(adminName) : null,
      action: sanitizeLogMessage(action),
      target_id: targetId ? sanitizeLogMessage(targetId) : null,
      details: sanitizeLogValue(details)
    }]);
    if (error) return;
  } catch {}
}
