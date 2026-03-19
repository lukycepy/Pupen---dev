import { supabase } from './supabase';

export async function logAdminAction(adminEmail: string | undefined | null, action: string, targetId?: string, details?: any, adminName?: string) {
  if (!adminEmail) return;
  try {
    const { error } = await supabase.from('admin_logs').insert([{
      admin_email: adminEmail,
      admin_name: adminName,
      action,
      target_id: targetId,
      details
    }]);
    if (error) {
      console.error('Logging error:', error.message || error);
      // Don't throw here, we don't want to crash the main UI if logging fails
    }
  } catch (err) {
    console.error('Logging failed with exception:', err);
  }
}
