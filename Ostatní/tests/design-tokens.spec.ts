import { test, expect } from '@playwright/test';

/**
 * Dočasný regresní test: ověřuje, že centrální override v globals.css
 * zajišťuje čitelnost světlých šedých textů na bílých plochách v light režimu
 * a zároveň zachovává světlý text uvnitř tmavých ploch (schválená výjimka).
 */
test.describe('design tokens: light-gray text', () => {
  test('light mode: gray text on white is full color, inside dark surface stays light', async ({ page }) => {
    await page.goto('/cs');

    const probe = async (cls: string, parentCls?: string) =>
      page.evaluate(
        ({ cls, parentCls }) => {
          const parent = document.createElement('div');
          if (parentCls) parent.className = parentCls;
          const el = document.createElement('span');
          el.className = cls;
          parent.appendChild(el);
          document.body.appendChild(parent);
          const color = getComputedStyle(el).color;
          parent.remove();
          return color;
        },
        { cls, parentCls },
      );

    // Light režim (výchozí) – světle šedý text na bílé ploše musí být plná barva textu.
    expect(await probe('text-stone-300')).toBe('rgb(0, 0, 0)');
    expect(await probe('text-stone-200')).toBe('rgb(0, 0, 0)');
    expect(await probe('text-gray-300')).toBe('rgb(0, 0, 0)');

    // Schválená výjimka – uvnitř tmavé plochy musí zůstat světlý (čitelný) text.
    const onDark = await probe('text-stone-300', 'bg-stone-900');
    expect(onDark).toBe('rgb(214, 211, 209)');

    // Stejný element nese tmavou plochu i text (jako patička).
    const sameEl = await page.evaluate(() => {
      const el = document.createElement('footer');
      el.className = 'bg-stone-900 text-stone-300';
      document.body.appendChild(el);
      const color = getComputedStyle(el).color;
      el.remove();
      return color;
    });
    expect(sameEl).toBe('rgb(214, 211, 209)');
  });

  test('dark mode: gray text resolves to a light tone', async ({ page }) => {
    await page.goto('/cs');
    // Téma se aplikuje bootstrap skriptem z localStorage – nastavíme ho a znovu načteme.
    await page.evaluate(() => localStorage.setItem('pupen_theme', 'dark'));
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);

    const color = await page.evaluate(() => {
      const el = document.createElement('span');
      el.className = 'text-stone-300';
      document.body.appendChild(el);
      const c = getComputedStyle(el).color;
      el.remove();
      return c;
    });
    // V dark režimu se tmavé šedé texty sjednocují na plnou barvu textu (bílá).
    expect(color).toBe('rgb(255, 255, 255)');

    // Úklid – vrátíme light režim, aby test neovlivnil další scénáře.
    await page.evaluate(() => localStorage.removeItem('pupen_theme'));
  });

  test('neutral surfaces stay binary in both modes (opacity variants)', async ({ page }) => {
    await page.goto('/cs');

    const bg = async (cls: string) =>
      page.evaluate((c) => {
        const el = document.createElement('div');
        el.className = c;
        document.body.appendChild(el);
        const value = getComputedStyle(el).backgroundColor;
        el.remove();
        return value;
      }, cls);

    const border = async (cls: string) =>
      page.evaluate((c) => {
        const el = document.createElement('div');
        el.className = c;
        document.body.appendChild(el);
        const value = getComputedStyle(el).borderTopColor;
        el.remove();
        return value;
      }, cls);

    // Light režim – průhledné neutrální plochy se nesmí projevit jako šedá.
    expect(await bg('bg-stone-50/50')).toBe('rgb(255, 255, 255)');
    expect(await bg('bg-stone-100/50')).toBe('rgb(255, 255, 255)');
    expect(await border('border border-stone-100/50')).toBe('rgb(0, 0, 0)');

    // Dark režim – stejné třídy musí splynout s černým podkladem, ne šednout.
    await page.evaluate(() => localStorage.setItem('pupen_theme', 'dark'));
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);

    expect(await bg('bg-stone-50/50')).toBe('rgb(0, 0, 0)');
    expect(await bg('bg-stone-50/30')).toBe('rgb(0, 0, 0)');
    expect(await bg('bg-stone-100/50')).toBe('rgb(0, 0, 0)');
    // `bg-white/90` bez `dark:` variantu nesmí na černém webu zůstat bílé.
    expect(await bg('bg-white/90')).toBe('rgba(0, 0, 0, 0.9)');

    await page.evaluate(() => localStorage.removeItem('pupen_theme'));
  });

  test('gradient stops and -50 neutral shades stay binary in both modes', async ({ page }) => {
    await page.goto('/cs');

    const gradientBg = async (cls: string) =>
      page.evaluate((c) => {
        const el = document.createElement('div');
        el.className = c;
        document.body.appendChild(el);
        const value = getComputedStyle(el).backgroundImage;
        el.remove();
        return value;
      }, cls);

    const bg = async (cls: string) =>
      page.evaluate((c) => {
        const el = document.createElement('div');
        el.className = c;
        document.body.appendChild(el);
        const value = getComputedStyle(el).backgroundColor;
        el.remove();
        return value;
      }, cls);

    // Light režim – neutrální gradient nesmí obsahovat šedé odstíny
    // (stone-50 = 250,250,249; stone-100 = 245,245,244).
    const lightGrad = await gradientBg('bg-gradient-to-b from-stone-50 to-stone-100/40');
    expect(lightGrad).toContain('rgb(255, 255, 255)');
    expect(lightGrad).not.toContain('250, 250, 249');
    expect(lightGrad).not.toContain('245, 245, 244');

    // Stejně tak `from-white via-stone-50 to-white` (stránka odstávky).
    const lightGrad2 = await gradientBg('bg-gradient-to-b from-white via-stone-50 to-white');
    expect(lightGrad2).not.toContain('250, 250, 249');

    // Nejjjemnější neutrální odstíny a indikátor.
    expect(await bg('bg-stone-400')).toBe('rgb(0, 0, 0)');

    const border = await page.evaluate(() => {
      const el = document.createElement('div');
      el.className = 'border border-stone-50';
      document.body.appendChild(el);
      const value = getComputedStyle(el).borderTopColor;
      el.remove();
      return value;
    });
    expect(border).toBe('rgb(0, 0, 0)');

    // Dark režim – stejné třídy se musí sjednotit na binární černou/bílou.
    await page.evaluate(() => localStorage.setItem('pupen_theme', 'dark'));
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);

    const darkGrad = await gradientBg('bg-gradient-to-b from-stone-50 to-stone-100/40');
    expect(darkGrad).toContain('rgb(0, 0, 0)');
    expect(darkGrad).not.toContain('250, 250, 249');
    expect(darkGrad).not.toContain('245, 245, 244');

    const darkGrad2 = await gradientBg('bg-gradient-to-b from-white via-stone-50 to-white');
    expect(darkGrad2).not.toContain('255, 255, 255');
    expect(darkGrad2).not.toContain('250, 250, 249');

    expect(await bg('bg-stone-400')).toBe('rgb(255, 255, 255)');

    await page.evaluate(() => localStorage.removeItem('pupen_theme'));
  });

  test('placeholder variants stay binary in both modes', async ({ page }) => {
    await page.goto('/cs');

    const placeholderColor = async (cls: string) =>
      page.evaluate((c) => {
        const el = document.createElement('input');
        el.className = c;
        el.placeholder = 'test';
        document.body.appendChild(el);
        const value = getComputedStyle(el, '::placeholder').color;
        el.remove();
        return value;
      }, cls);

    // Light režim – šedý placeholder musí být plná barva textu (žádná šedá).
    expect(await placeholderColor('placeholder:text-stone-400')).toBe('rgb(0, 0, 0)');
    expect(await placeholderColor('placeholder:text-stone-500')).toBe('rgb(0, 0, 0)');
    expect(await placeholderColor('placeholder:text-gray-400')).toBe('rgb(0, 0, 0)');

    // Schválená výjimka – placeholder v tmavé ploše (patička) zůstává světlý.
    expect(await placeholderColor('placeholder-stone-500')).toBe('rgb(214, 211, 209)');

    // Dark režim – placeholder uvnitř inputu musí být bílý.
    await page.evaluate(() => localStorage.setItem('pupen_theme', 'dark'));
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);

    expect(
      await placeholderColor('placeholder:text-stone-400 dark:placeholder:text-stone-500'),
    ).toBe('rgb(255, 255, 255)');

    await page.evaluate(() => localStorage.removeItem('pupen_theme'));
  });
});
