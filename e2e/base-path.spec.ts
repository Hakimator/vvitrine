import { expect, test } from '@playwright/test';

/** Deployed under a sub-path, as on GitHub project pages (https://user.github.io/repo/). */

test('every internal link respects the base path', async ({ page }) => {
  await page.goto('/demo/');
  const hrefs = await page.locator('a[href^="/"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')!));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) expect(href, href).toMatch(/^\/demo\//);
  await page.getByRole('link', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/demo\/en\/$/);
});

test('canonical, hreflang and sitemap use the absolute site URL', async ({ page, request }) => {
  await page.goto('/demo/en/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://example.github.io/demo/en/');
  await expect(page.locator('link[hreflang="x-default"]')).toHaveAttribute('href', 'https://example.github.io/demo/');
  const sitemap = await (await request.get('/demo/sitemap.xml')).text();
  expect(sitemap).toContain('<loc>https://example.github.io/demo/en/projects/bibliotheque/</loc>');
});
