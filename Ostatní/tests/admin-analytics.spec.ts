import { test, expect } from '@playwright/test';

async function getSupabaseAccessToken(opts: { url: string; anonKey: string; email: string; password: string }) {
  const res = await fetch(`${opts.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: opts.anonKey,
      authorization: `Bearer ${opts.anonKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email: opts.email, password: opts.password }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error_description || json?.msg || json?.error || `Supabase auth failed (${res.status})`);
  }
  const token = String(json?.access_token || '');
  if (!token) throw new Error('Missing access_token');
  return token;
}

test.describe('Admin Analytics API', () => {
  test('GET /api/admin/analytics returns stats (requires env)', async ({ request }) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const email = process.env.E2E_ADMIN_EMAIL || '';
    const password = process.env.E2E_ADMIN_PASSWORD || '';
    const srv = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    test.skip(!supabaseUrl || !supabaseAnonKey || !email || !password || !srv, 'Missing E2E env');

    const token = await getSupabaseAccessToken({ url: supabaseUrl, anonKey: supabaseAnonKey, email, password });
    const res = await request.get('/api/admin/analytics', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.ok()).toBeTruthy();
    const json: any = await res.json();
    expect(json.ok).toBeTruthy();
    expect(Array.isArray(json.topEvents)).toBeTruthy();
    expect(Array.isArray(json.topPosts)).toBeTruthy();
    expect(Array.isArray(json.recentLogs)).toBeTruthy();
    expect(typeof json.totalRSVPs).toBe('number');
    expect(typeof json.totalViews).toBe('number');
    expect(typeof json.recentActivity).toBe('number');
    expect(typeof json.pendingApplications).toBe('number');
  });
});

