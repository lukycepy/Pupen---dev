import { test, expect } from '@playwright/test';

async function getSupabasePasswordSession(opts: { url: string; anonKey: string; email: string; password: string }) {
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
  return json as any;
}

async function getSupabaseAccessToken(opts: { url: string; anonKey: string; email: string; password: string }) {
  const session = await getSupabasePasswordSession(opts);
  return String(session.access_token);
}

function getSupabaseProjectRef(supabaseUrl: string) {
  const m = String(supabaseUrl).match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return m?.[1] || '';
}

async function createSupabaseUser(opts: { url: string; serviceRoleKey: string; email: string; password: string }) {
  const res = await fetch(`${opts.url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: opts.serviceRoleKey,
      authorization: `Bearer ${opts.serviceRoleKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email: opts.email, password: opts.password, email_confirm: true }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.msg || json?.error || `Create user failed (${res.status})`);
  }
  const id = String(json?.id || json?.user?.id || '');
  if (!id) throw new Error('Missing created user id');
  return { id };
}

async function deleteSupabaseUser(opts: { url: string; serviceRoleKey: string; id: string }) {
  await fetch(`${opts.url}/auth/v1/admin/users/${opts.id}`, {
    method: 'DELETE',
    headers: {
      apikey: opts.serviceRoleKey,
      authorization: `Bearer ${opts.serviceRoleKey}`,
    },
  }).catch(() => null);
}

test.describe('Security bans', () => {
  test('IP ban blocks API', async ({ request }) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const email = process.env.E2E_ADMIN_EMAIL || '';
    const password = process.env.E2E_ADMIN_PASSWORD || '';
    const srv = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    test.skip(!supabaseUrl || !supabaseAnonKey || !email || !password || !srv, 'Missing E2E env');

    const token = await getSupabaseAccessToken({ url: supabaseUrl, anonKey: supabaseAnonKey, email, password });
    const create = await request.post('/api/admin/security-bans', {
      headers: { Authorization: `Bearer ${token}` },
      data: { kind: 'ip', value: '203.0.113.1', reason: 'e2e' },
    });
    expect(create.ok()).toBeTruthy();
    const created: any = await create.json();
    const banId = Number(created?.ban?.id);
    expect(Number.isFinite(banId)).toBeTruthy();

    const blocked = await request.get('/api/health', { headers: { 'x-forwarded-for': '203.0.113.1' } });
    expect(blocked.status()).toBe(403);

    const revoke = await request.post(`/api/admin/security-bans/${banId}/revoke`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(revoke.ok()).toBeTruthy();
  });

  test('Identity ban blocks API', async ({ request }) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const adminEmail = process.env.E2E_ADMIN_EMAIL || '';
    const adminPassword = process.env.E2E_ADMIN_PASSWORD || '';
    const srv = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    test.skip(!supabaseUrl || !supabaseAnonKey || !adminEmail || !adminPassword || !srv, 'Missing E2E env');

    const adminToken = await getSupabaseAccessToken({
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
      email: adminEmail,
      password: adminPassword,
    });

    const email = `e2e-ban-${Date.now()}@example.com`;
    const password = `E2e!${Date.now()}Abc`;
    const user = await createSupabaseUser({ url: supabaseUrl, serviceRoleKey: srv, email, password });
    let banId: number | null = null;
    try {
      const userToken = await getSupabaseAccessToken({ url: supabaseUrl, anonKey: supabaseAnonKey, email, password });
      const create = await request.post('/api/admin/security-bans', {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: { kind: 'identity', value: user.id, reason: 'e2e' },
      });
      expect(create.ok()).toBeTruthy();
      const created: any = await create.json();
      banId = Number(created?.ban?.id);
      expect(Number.isFinite(banId)).toBeTruthy();

      const blocked = await request.get('/api/auth/me-profile', { headers: { Authorization: `Bearer ${userToken}` } });
      expect(blocked.status()).toBe(403);
    } finally {
      if (banId) {
        await request
          .post(`/api/admin/security-bans/${banId}/revoke`, { headers: { Authorization: `Bearer ${adminToken}` } })
          .catch(() => null);
      }
      await deleteSupabaseUser({ url: supabaseUrl, serviceRoleKey: srv, id: user.id });
    }
  });

  test('Admin UI shows banování v Údržbě', async ({ page }) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const email = process.env.E2E_ADMIN_EMAIL || '';
    const password = process.env.E2E_ADMIN_PASSWORD || '';

    test.skip(!supabaseUrl || !supabaseAnonKey || !email || !password, 'Missing E2E env');

    const session = await getSupabasePasswordSession({ url: supabaseUrl, anonKey: supabaseAnonKey, email, password });
    const projectRef = getSupabaseProjectRef(supabaseUrl);
    test.skip(!projectRef, 'Missing Supabase project ref');

    const expiresIn = Number(session?.expires_in || 3600);
    const out = {
      access_token: session.access_token,
      token_type: session.token_type,
      expires_in: expiresIn,
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
      refresh_token: session.refresh_token,
      user: session.user,
    };

    await page.addInitScript(
      ({ key, value }) => {
        localStorage.setItem(key, value);
      },
      { key: `sb-${projectRef}-auth-token`, value: JSON.stringify(out) },
    );

    await page.goto('/cs/admin/dashboard#god_mode', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Banování IP / identity')).toBeVisible();
    await expect(page.getByText('Příští krok')).toHaveCount(0);
  });
});

