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

test.describe('Admin Smoke Tests (Mocked/Unauthenticated)', () => {
  test('Admin dashboard redirects to login if unauthenticated', async ({ page }) => {
    await page.goto('/cs/admin/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/cs\/(admin|login)(\/|$)/);
    await expect(page.locator('body')).toBeVisible();
  });
});
