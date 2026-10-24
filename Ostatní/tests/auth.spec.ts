import { test, expect, type Page } from '@playwright/test';

/**
 * E2E testy přihlašovacích toků.
 *
 * Reálné credentials v testovacím prostředí nemáme, proto simulujeme
 * síťovou komunikaci přes page.route():
 *  - Supabase token endpoint    ... odpověď supabase-js na password grant (vrací session)
 *  - /api/auth/login-guard      ... rate-limit / captcha guard
 *  - /api/auth/resolve-login    ... převod aliasu na kanonický e-mail
 *  - /api/auth/me-profile       ... profil uživatele (role)
 *  - Supabase user endpoint     ... seznam MFA faktorů (supabase.auth.mfa.listFactors)
 *  - Supabase MFA challenge     ... spuštění MFA výzvy
 */

const TEST_EMAIL = 'x@example.com';
const TEST_PASSWORD = 'SuperSecret123!';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const FACTOR_ID = '22222222-2222-4222-8222-222222222222';

const nowIso = () => new Date().toISOString();

function base64url(input: string) {
  return Buffer.from(input, 'utf-8').toString('base64url');
}

/**
 * Sestaví čitelný (nepodepsaný, ale syntakticky platný) JWT.
 * supabase-js z něj čte claim "aal" (úroveň ověření), proto musí být validní.
 */
function makeJwt(payload: Record<string, unknown>) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, ...payload }),
  );
  return `${header}.${body}.c2ln`;
}

// Session JSON přesně tak, jak ho vrací supabase-js password grant.
function sessionJson(aal?: 'aal1' | 'aal2') {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: makeJwt({
      sub: USER_ID,
      role: 'authenticated',
      aud: 'authenticated',
      ...(aal ? { aal } : {}),
    }),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: 'test-refresh-token',
    user: {
      id: USER_ID,
      aud: 'authenticated',
      role: 'authenticated',
      email: TEST_EMAIL,
      app_metadata: {},
      user_metadata: {},
      created_at: nowIso(),
    },
  };
}

async function jsonRoute(page: Page, url: string, body: unknown, status = 200) {
  await page.route(url, (route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }),
  );
}

// Mock password grant; volitelně odchytí body requestu (pro test aliasu).
async function mockToken(page: Page, session: unknown, onBody?: (body: any) => void) {
  await page.route('**/auth/v1/token**', async (route) => {
    onBody?.(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(session),
    });
  });
}

// Vyplní a odešle přihlašovací formulář na /cs/login.
// Stránka obsahuje i newsletter formulář v patičce, proto cílíme výhradně
// na formulář s polem hesla (login), abychom předešli strict-mode kolizi.
async function submitLogin(page: Page, email = TEST_EMAIL, password = TEST_PASSWORD) {
  await page.goto('/cs/login', { waitUntil: 'domcontentloaded' });
  const loginForm = page.locator('form').filter({ has: page.locator('input[type="password"]') });
  await loginForm.locator('input[type="email"]').first().fill(email);
  await loginForm.locator('input[type="password"]').first().fill(password);
  await loginForm.locator('button[type="submit"]').click();
}

test.describe('Auth flows (mocked)', () => {
  test('login shows role picker when user has both admin and member access', async ({ page }) => {
    // aal2 token: profil má admin přístup, ale NENÍ super-admin, takže
    // LoginPageClient vyžaduje dokončené 2FA (ensureAdminAal2) a teprve pak
    // zobrazí výběr role. aal2 = 2FA je již splněno.
    await mockToken(page, sessionJson('aal2'));
    await jsonRoute(page, '**/api/auth/login-guard', {});
    await jsonRoute(page, '**/api/auth/resolve-login', { email: TEST_EMAIL });
    await jsonRoute(page, '**/api/auth/me-profile', {
      profile: {
        has_admin_access: true,
        has_member_access: true,
        can_manage_admins: false,
        is_admin: false,
      },
    });
    // logSecurity() v handleRedirect posílá požadavek se session tokenem.
    await jsonRoute(page, '**/api/auth/security-log', {});

    await submitLogin(page);

    // Obrazovka pro výběr role – obě tlačítka musí být viditelná.
    await expect(page.getByTestId('role-select-admin')).toBeVisible();
    await expect(page.getByTestId('role-select-member')).toBeVisible();
  });

  test('login redirects a member-only profile to /cs/clen', async ({ page }) => {
    await mockToken(page, sessionJson());
    await jsonRoute(page, '**/api/auth/login-guard', {});
    await jsonRoute(page, '**/api/auth/resolve-login', { email: TEST_EMAIL });
    await jsonRoute(page, '**/api/auth/me-profile', { profile: { has_member_access: true } });
    await jsonRoute(page, '**/api/auth/security-log', {});

    await submitLogin(page);

    // Bez admin přístupu jde uživatel rovnou do členské sekce.
    await expect(page).toHaveURL(/\/cs\/clen/);
  });

  test('login redirects an admin-only profile to /cs/admin/dashboard', async ({ page }) => {
    // aal2: 2FA je už splněné, takže ensureAdminAal2 přesměrování nezablokuje.
    await mockToken(page, sessionJson('aal2'));
    await jsonRoute(page, '**/api/auth/login-guard', {});
    await jsonRoute(page, '**/api/auth/resolve-login', { email: TEST_EMAIL });
    await jsonRoute(page, '**/api/auth/me-profile', {
      profile: {
        has_admin_access: true,
        has_member_access: false,
        can_manage_admins: false,
        is_admin: false,
      },
    });
    await jsonRoute(page, '**/api/auth/security-log', {});

    await submitLogin(page);

    // Bez členského přístupu se nezobrazuje výběr role a jde se rovnou do adminu.
    await expect(page).toHaveURL(/\/cs\/admin\/dashboard/);
  });

  test('alias login authenticates with the canonical e-mail', async ({ page }) => {
    let capturedEmail: string | undefined;
    await mockToken(page, sessionJson(), (body) => {
      capturedEmail = body?.email;
    });
    await jsonRoute(page, '**/api/auth/login-guard', {});
    // Přihlášení s aliasem se má přeložit na kanonický e-mail.
    await jsonRoute(page, '**/api/auth/resolve-login', { email: 'canonical@example.com' });
    await jsonRoute(page, '**/api/auth/me-profile', { profile: { has_member_access: true } });
    await jsonRoute(page, '**/api/auth/security-log', {});

    await submitLogin(page, 'alias@example.com');

    // Do /auth/v1/token se musí poslat přeložený (kanonický) e-mail, ne alias.
    await expect.poll(() => capturedEmail).toBe('canonical@example.com');
  });

  test('forgot password shows confirmation and reset page renders its form', async ({ page }) => {
    await jsonRoute(page, '**/api/auth/forgot-password', { ok: true });

    await page.goto('/cs/forgot', { waitUntil: 'domcontentloaded' });
    const emailInput = page.locator('input[type="email"]').first();
    await expect(emailInput).toBeVisible();
    await emailInput.fill('user@example.com');

    const submit = page.locator('form button[type="submit"]').first();
    await expect(submit).toBeVisible();
    await submit.click();

    // Potvrzovací hlášení (CS text z dictionaries/cs.json).
    await expect(
      page.getByText('Pokud účet existuje, brzy vám dorazí e-mail.'),
    ).toBeVisible();

    // /reset-password (s dummy tokenem) musí vykreslit formulář se dvěma hesly.
    await page.goto('/cs/reset-password?token=dummy-token', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(2);
  });

  test('admin login with a verified TOTP factor shows the 2FA code input', async ({ page }) => {
    // Token bez "aal": uživatel má admin přístup, ale ne splněné 2FA.
    await mockToken(page, sessionJson());
    await jsonRoute(page, '**/api/auth/login-guard', {});
    await jsonRoute(page, '**/api/auth/resolve-login', { email: TEST_EMAIL });
    await jsonRoute(page, '**/api/auth/me-profile', {
      profile: { has_admin_access: true, can_manage_admins: false, is_admin: false },
    });
    await jsonRoute(page, '**/api/auth/security-log', {});
    // mfa.listFactors() načítá uživatele včetně faktorů -> musí vrátit ověřený TOTP.
    await jsonRoute(page, '**/auth/v1/user**', {
      id: USER_ID,
      aud: 'authenticated',
      role: 'authenticated',
      email: TEST_EMAIL,
      app_metadata: {},
      user_metadata: {},
      created_at: nowIso(),
      factors: [
        {
          id: FACTOR_ID,
          factor_type: 'totp',
          status: 'verified',
          friendly_name: 'Pupen',
          created_at: nowIso(),
          updated_at: nowIso(),
        },
      ],
    });
    // mfa.challenge() musí vrátit ID výzvy, jinak se 2FA obrazovka nevykreslí.
    await page.route('**/auth/v1/factors/*/challenge**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'challenge-1',
          type: 'totp',
          expires_at: Math.floor(Date.now() / 1000) + 300,
        }),
      }),
    );

    await submitLogin(page);

    // LoginPageClient přepne formulář na zadání 2FA kódu.
    await expect(
      page.locator('input[inputmode="numeric"][placeholder="123456"]'),
    ).toBeVisible();
  });

  test('logout from the member sidebar returns to /cs/login', async ({ page }) => {
    await mockToken(page, sessionJson());
    await jsonRoute(page, '**/api/auth/login-guard', {});
    await jsonRoute(page, '**/api/auth/resolve-login', { email: TEST_EMAIL });
    // is_member = true je potřeba, aby se vykreslil členský shell se sidebarem.
    await jsonRoute(page, '**/api/auth/me-profile', {
      profile: {
        is_member: true,
        has_member_access: true,
        email: TEST_EMAIL,
        first_name: 'Test',
        member_no: 'M-0001',
      },
    });
    await jsonRoute(page, '**/api/auth/security-log', {});
    // signOut() volá POST /auth/v1/logout?scope=global.
    await jsonRoute(page, '**/auth/v1/logout**', {});

    await submitLogin(page);
    await expect(page).toHaveURL(/\/cs\/clen/);

    // Sidebar je na desktopu vždy vidět; na mobilu je schovaný v draweru,
    // který se otevírá tlačítkem hamburgeru v hlavičce.
    const hamburger = page.getByRole('button', { name: 'Otevřít navigaci' });
    await expect(hamburger).toBeVisible();

    const visibleLogout = page.locator('[data-testid="logout-button"]:visible');
    if (!(await visibleLogout.isVisible())) {
      await hamburger.click();
    }

    await expect(visibleLogout).toBeVisible();
    await visibleLogout.click();

    await expect(page).toHaveURL(/\/cs\/login/);
  });
});
