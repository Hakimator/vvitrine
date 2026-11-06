import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/** Runs for both themes: the same content must behave the same whatever the theme. */

test('home page renders the configured sections in order, in French by default', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Jeanne Martin');
  const ids = await page.locator('main h2').evaluateAll((els) => els.map((e) => e.id));
  expect(ids).toEqual([
    'projects-title',
    'work-title',
    'education-title',
    'skills-title',
    'talks-title',
    'languages-title',
  ]);
  await expect(page.locator('#work-title')).toHaveText('Expérience');
});

test('language switcher leads to the English version', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Langue' }).getByRole('link', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/en\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#work-title')).toHaveText('Experience');
  await expect(page.locator('#talks-title')).toHaveText('Talks');
});

test('a project card opens its detail page, which links back to the list', async ({ page }) => {
  await page.goto('/en/');
  await page.getByRole('link', { name: 'Library manager', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/projects\/bibliotheque\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Library manager');
  await expect(page.getByRole('link', { name: 'Source code' })).toHaveAttribute(
    'href',
    'https://github.com/example/library',
  );
  await page.getByRole('link', { name: /All projects/ }).click();
  await expect(page).toHaveURL(/\/en\/#projects$/);
});

for (const path of ['/', '/en/', '/projects/bibliotheque/']) {
  test(`no accessibility violations (WCAG 2.2 AA) on ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
  });

  test(`no accessibility violations in dark mode on ${path}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
  });
}

test('ships zero JavaScript and makes no third-party requests (privacy by default)', async ({ page, baseURL }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith(baseURL!)) external.push(r.url());
  });
  await page.goto('/');
  const scripts = await page.locator('script:not([type="application/ld+json"])').count();
  expect(scripts).toBe(0);
  expect(external).toEqual([]);
});

test('skip link moves focus to the main content', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Aller au contenu' });
  await expect(skip).toBeFocused();
  await skip.press('Enter');
  await expect(page).toHaveURL(/#main$/);
});

test('no horizontal scrolling on a 320 px wide screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const path of ['/', '/en/projects/bibliotheque/']) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test('the other theme leaks no CSS into this build (spike finding F1)', async ({ page, request }, testInfo) => {
  await page.goto('/');
  const hrefs = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((els) => els.map((e) => (e as HTMLLinkElement).href));
  const inline = await page.locator('style').evaluateAll((els) => els.map((e) => e.textContent ?? '').join('\n'));
  const external = await Promise.all(hrefs.map(async (href) => (await request.get(href)).text()));
  const css = [inline, ...external].join('\n');
  // Each theme has selectors the other one does not use.
  const foreign = testInfo.project.name === 'bold' ? '.timeline' : '.featured';
  expect(css).not.toContain(foreign);
});

test('robots.txt is generated', async ({ request }) => {
  const response = await request.get('/robots.txt');
  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain('User-agent: *');
});
