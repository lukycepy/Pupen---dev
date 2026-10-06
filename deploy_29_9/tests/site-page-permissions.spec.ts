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

test.describe('RBAC per-page permissions (site pages)', () => {
  test('403 pro view/edit bez per-page oprávnění + povolení přes grant', async ({ request }) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const adminEmail = process.env.E2E_ADMIN_EMAIL || '';
    const adminPassword = process.env.E2E_ADMIN_PASSWORD || '';
    const srv = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    test.skip(!supabaseUrl || !supabaseAnonKey || !adminEmail || !adminPassword || !srv, 'Missing E2E env');

    const adminToken = await getSupabaseAccessToken({ url: supabaseUrl, anonKey: supabaseAnonKey, email: adminEmail, password: adminPassword });

    const email = `e2e-pages-${Date.now()}@example.com`;
    const password = `E2e!${Date.now()}Abc`;
    const user = await createSupabaseUser({ url: supabaseUrl, serviceRoleKey: srv, email, password });

    let userToken = '';
    try {
      const makeAdmin = await request.patch(`/api/admin/users/${user.id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: { is_admin: true, can_view_site_pages: false, can_edit_site_pages: false },
      });
      expect(makeAdmin.ok()).toBeTruthy();

      userToken = await getSupabaseAccessToken({ url: supabaseUrl, anonKey: supabaseAnonKey, email, password });

      const forbiddenView = await request.get('/api/admin/site-pages/o-nas', { headers: { Authorization: `Bearer ${userToken}` } });
      expect(forbiddenView.status()).toBe(403);

      const forbiddenEdit = await request.put('/api/admin/site-pages/o-nas', {
        headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
        data: { cs: { title: 'x', content_html: '<p>x</p>', content_blocks: null }, en: { title: 'x', content_html: '<p>x</p>', content_blocks: null } },
      });
      expect(forbiddenEdit.status()).toBe(403);

      const grantView = await request.post('/api/admin/site-pages/permissions', {
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        data: { slug: 'o-nas', userId: user.id, canView: true, canEdit: false },
      });
      expect(grantView.ok()).toBeTruthy();

      const allowedView = await request.get('/api/admin/site-pages/o-nas', { headers: { Authorization: `Bearer ${userToken}` } });
      expect(allowedView.ok()).toBeTruthy();

      const stillForbiddenEdit = await request.put('/api/admin/site-pages/o-nas', {
        headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
        data: { cs: { title: 'x', content_html: '<p>x</p>', content_blocks: null }, en: { title: 'x', content_html: '<p>x</p>', content_blocks: null } },
      });
      expect(stillForbiddenEdit.status()).toBe(403);

      const grantEdit = await request.post('/api/admin/site-pages/permissions', {
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        data: { slug: 'o-nas', userId: user.id, canView: true, canEdit: true },
      });
      expect(grantEdit.ok()).toBeTruthy();

      const allowedEdit = await request.put('/api/admin/site-pages/o-nas', {
        headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
        data: { cs: { title: 'e2e', content_html: '<p>e2e</p>', content_blocks: null }, en: { title: 'e2e', content_html: '<p>e2e</p>', content_blocks: null } },
      });
      expect(allowedEdit.ok()).toBeTruthy();
    } finally {
      if (userToken) {
        await request
          .post('/api/admin/site-pages/permissions', {
            headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
            data: { slug: 'o-nas', userId: user.id, canView: false, canEdit: false },
          })
          .catch(() => null);
      }
      await deleteSupabaseUser({ url: supabaseUrl, serviceRoleKey: srv, id: user.id });
    }
  });
});

