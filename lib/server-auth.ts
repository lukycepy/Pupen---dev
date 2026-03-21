import { getServerSupabase } from '@/lib/supabase-server';

export function getBearerToken(req: Request) {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const m = String(auth).match(/^Bearer\s+(.+)$/i);
  if (m?.[1]) return m[1];

  const alt = req.headers.get('x-supabase-token') || '';
  const mm = String(alt).match(/^Bearer\s+(.+)$/i);
  if (mm?.[1]) return mm[1];
  if (alt && !alt.toLowerCase().startsWith('bearer ')) return alt;
  return null;
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
