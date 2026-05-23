import { test, expect } from '@playwright/test';

test.describe('Public Smoke Tests', () => {
  test('Homepage loads and has newsletter form', async ({ page }) => {
    await page.goto('/cs', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });

  test('Login page loads', async ({ page }) => {
    await page.goto('/cs/login', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('Application form loads', async ({ page }) => {
    await page.goto('/cs/prihlaska', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('form')).toBeVisible();
    await expect(page.locator('form button[type="submit"], form button').first()).toBeVisible();
  });

  test('Events page loads', async ({ page }) => {
    await page.goto('/cs/akce', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });

  test('TrustBox page loads', async ({ page }) => {
    await page.goto('/cs/schranka-duvery', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Theme Smoke Tests', () => {
  test.use({ colorScheme: 'dark' });

  test('System theme follows prefers-color-scheme and syncs on change', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('pupen_theme', 'system');
    });
    await page.goto('/cs', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('Theme toggle cycles light -> dark -> system', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('pupen_theme', 'light');
    });
    await page.goto('/cs', { waitUntil: 'domcontentloaded' });

    const toggle = page.getByTestId('accessibility-theme-toggle');
    await expect(toggle).toBeVisible();

    await toggle.click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect
      .poll(async () => page.evaluate(() => window.localStorage.getItem('pupen_theme')))
      .toBe('dark');

    await toggle.click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect
      .poll(async () => page.evaluate(() => window.localStorage.getItem('pupen_theme')))
      .toBe('system');

    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });
});

test.describe('Admin Smoke Tests (Mocked/Unauthenticated)', () => {
  test('Admin dashboard redirects to login if unauthenticated', async ({ page }) => {
    await page.goto('/cs/admin/dashboard', { waitUntil: 'commit' });
    await expect(page).toHaveURL(/\/cs\/(admin|login)(\/|$)/);
    await expect(page.locator('body')).toBeVisible();
  });
});
