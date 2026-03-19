import { getServerSupabase } from '@/lib/supabase-server';

export function getBearerToken(req: Request) {
  const h = req.headers.get('authorization') || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

export async function requireUser(req: Request) {
  const token = getBearerToken(req);
  if (!token) throw new Error('Unauthorized');
  const supabase = getServerSupabase();
  const res = await supabase.auth.getUser(token);
  const user = res.data?.user;
  if (!user) throw new Error('Unauthorized');
  return user;
}

export async function requireAdmin(req: Request) {
  const user = await requireUser(req);
  const supabase = getServerSupabase();
  const { data: profile, error } = await supabase.from('profiles').select('is_admin, can_manage_admins').eq('id', user.id).maybeSingle();
  if (error) throw error;
  if (!profile?.is_admin && !profile?.can_manage_admins) throw new Error('Forbidden');
  return { user, profile };
}
