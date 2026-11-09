import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/** The example theme and section (examples/plugins), in a real build of the demo content. */

for (const path of ['/', '/en/', '/en/timeline/']) {
  test(`the example theme passes WCAG 2.2 AA on ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });
}

test('the example theme draws every section, with its own components or its fallback', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Jeanne Martin');
  // Shared view kinds: entries and tags.
  await expect(page.locator('#work article h3').first()).toBeVisible();
  await expect(page.locator('#skills dt').first()).toBeVisible();
  // Fallback: languages and projects have no component in this theme, and still show their content.
  await expect(page.locator('#languages li').first()).toBeVisible();
  await expect(page.locator('#projects h2')).toHaveText('Projects');
  // The header links to the sections, and the language switcher works.
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Experience' }).click();
  await expect(page).toHaveURL(/#work$/);
  await page.getByRole('link', { name: 'Français' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('the example section is drawn by a theme that has never heard of it', async ({ page }) => {
  await page.goto('/en/');
  const now = page.locator('#now');
  await expect(now.getByRole('heading', { level: 2 })).toHaveText('Now');
  await expect(now.locator('h3')).toHaveText('Looking for an internship');
  await expect(now).toContainText('Updated Nov 2026');
});

test('the example theme fits a 320 px screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(
    0,
  );
});
