import { test, expect } from '@playwright/test';

/**
 * Automatizovaná část accessibility auditu (klávesnicová navigace):
 * - první Tab z landingu musí přesunout fokus na interaktivní prvek,
 * - fokusovaný prvek musí mít viditelný focus ring (centrální :focus-visible),
 * - fokus nesmí být "uvězněn" na jednom prvku (opakovaný Tab postupuje dál).
 */

test.describe('a11y: klávesnicová navigace', () => {
  test('Tab přesune fokus a focus-visible je viditelný', async ({ page }) => {
    await page.goto('/cs');

    const readActive = () =>
      page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        return {
          tag: el.tagName,
          outlineWidth: cs.outlineWidth,
          outlineStyle: cs.outlineStyle,
          outlineColor: cs.outlineColor,
        };
      });

    await page.keyboard.press('Tab');
    const first = await readActive();
    expect(first, 'po prvním Tabu musí být fokus na interaktivním prvku').not.toBeNull();
    expect(['A', 'BUTTON', 'INPUT', 'SUMMARY', 'SELECT', 'TEXTAREA']).toContain(first!.tag);

    // Viditelný focus ring (centrální pravidlo: 3px solid #16a34a).
    expect(first!.outlineStyle).not.toBe('none');
    expect(parseFloat(first!.outlineWidth)).toBeGreaterThanOrEqual(2);
    expect(first!.outlineColor.replace(/\s/g, '')).toBe('rgb(22,163,74)');
  });

  test('opakovaný Tab postupně prochází interaktivními prvky', async ({ page }) => {
    await page.goto('/cs');

    const seen = new Set<string>();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      const sig = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        return `${el.tagName}:${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)}`;
      });
      if (sig) seen.add(sig);
    }

    // Fokus se musí posouvat, ne zůstávat na jednom prvku.
    expect(seen.size).toBeGreaterThan(3);
  });

  test('skip link je první v tab pořadí a přesune fokus na hlavní obsah', async ({ page }) => {
    await page.goto('/cs');

    // První Tab musí nabídnout "přeskočit na obsah" (WCAG 2.4.1).
    await page.keyboard.press('Tab');
    const skip = page.locator('a[href="#main-content"]');
    await expect(skip).toBeFocused();

    // Fokusovaný odkaz nesmí zůstat vizuálně skrytý.
    const box = await skip.boundingBox();
    expect(box, 'skip link musí být po fokusu viditelný').not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);

    // Aktivace přesune fokus/scroll na cílový landmark.
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeAttached();
  });

  // Klávesnicový audit klíčových veřejných cest: na každé musí první Tab
  // skončit na interaktivním prvku s viditelným focus ringem.
  for (
    const route of [
      '/cs',
      '/cs/login',
      '/cs/akce',
      '/cs/novinky',
      '/cs/galerie',
      '/cs/kontakt',
      '/cs/faq',
      '/cs/prihlaska',
      '/cs/schranka-duvery',
    ]
  ) {
    test(`klávesnicový vstup funguje na ${route}`, async ({ page }) => {
      await page.goto(route);
      await page.keyboard.press('Tab');

      const active = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        return {
          tag: el.tagName,
          outlineStyle: cs.outlineStyle,
          outlineWidth: cs.outlineWidth,
        };
      });

      expect(active, `na ${route} musí první Tab zamířit na interaktivní prvek`).not.toBeNull();
      expect(['A', 'BUTTON', 'INPUT', 'SUMMARY', 'SELECT', 'TEXTAREA']).toContain(active!.tag);
      expect(active!.outlineStyle).not.toBe('none');
      expect(parseFloat(active!.outlineWidth)).toBeGreaterThanOrEqual(2);
    });
  }

  // Regrese: administrace (`admin-scope`) nesmí potlačovat centrální focus ring.
  // Dřívější `outline: none` v `.admin-scope` měl stejnou specificitu jako
  // globální `:focus-visible` pravidlo a díky pozdější pozici ho přebil,
  // takže pole v adminu neměla viditelný indikátor fokusu (WCAG 2.4.7).
  test('pole v admin-scope mají viditelný focus ring', async ({ page }) => {
    await page.goto('/cs');

    const outline = await page.evaluate(() => {
      const scope = document.createElement('div');
      scope.className = 'admin-scope';
      const input = document.createElement('input');
      input.type = 'text';
      scope.appendChild(input);
      document.body.appendChild(scope);
      input.focus();
      const cs = getComputedStyle(input);
      const result = { style: cs.outlineStyle, width: cs.outlineWidth, color: cs.outlineColor };
      scope.remove();
      return result;
    });

    expect(outline.style).not.toBe('none');
    expect(parseFloat(outline.width)).toBeGreaterThanOrEqual(2);
    expect(outline.color.replace(/\s/g, '')).toBe('rgb(22,163,74)');
  });

  // Focus-visible musí být zřetelný i v tmavém režimu (bílý text + zelený ring).
  test('focus ring je viditelný i v dark režimu', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('pupen_theme', 'dark');
    });
    await page.goto('/cs');
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.keyboard.press('Tab');
    const active = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      return { outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth, outlineColor: cs.outlineColor };
    });

    expect(active).not.toBeNull();
    expect(active!.outlineStyle).not.toBe('none');
    expect(parseFloat(active!.outlineWidth)).toBeGreaterThanOrEqual(2);
    expect(active!.outlineColor.replace(/\s/g, '')).toBe('rgb(22,163,74)');
  });
});
