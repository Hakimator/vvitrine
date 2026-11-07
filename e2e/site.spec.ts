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
    'volunteer-title',
    'skills-title',
    'certificates-title',
    'awards-title',
    'talks-title',
    'languages-title',
    'interests-title',
    'references-title',
  ]);
  await expect(page.locator('#work-title')).toHaveText('Expérience');
  await expect(page.locator('#volunteer-title')).toHaveText('Bénévolat');
  await expect(page.locator('#interests-title')).toHaveText('Centres d’intérêt');
});

test('references are quotations with their author', async ({ page }) => {
  await page.goto('/en/');
  const quote = page.locator('#references figure');
  await expect(quote.locator('blockquote')).toContainText('Reliable, curious and a pleasure to work with.');
  await expect(quote.locator('figcaption')).toContainText('Alex Dupont');
  await expect(quote.locator('figcaption')).toContainText('Engineering manager, Fictional Company');
});

test('header links lead to each section, without the sticky header covering its title', async ({ page }) => {
  await page.goto('/en/');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link')).toHaveText([
    'Projects',
    'Experience',
    'Education',
    'Skills',
    'Talks',
    'Languages',
  ]);
  await nav.getByRole('link', { name: 'Education' }).click();
  await expect(page).toHaveURL(/\/en\/#education$/);
  const header = await page.locator('.site-header').boundingBox();
  const title = await page.locator('#education-title').boundingBox();
  expect(title!.y).toBeGreaterThanOrEqual(header!.y + header!.height);

  await page.goto('/en/projects/bibliotheque/');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Skills' }).click();
  await expect(page).toHaveURL(/\/en\/#skills$/);
});

test('on a phone, the section links are in a menu that works without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 700 }, javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/en/');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav).toBeHidden();
  await page.locator('summary', { hasText: 'Menu' }).click();
  await expect(nav).toBeVisible();
  await nav.getByRole('link', { name: 'Experience' }).click();
  await expect(page).toHaveURL(/\/en\/#work$/);
  await context.close();
});

test('hero shows a photo or initials and its calls to action', async ({ page }, testInfo) => {
  await page.goto('/en/');
  const hero = page.locator('#hero');
  const contact = hero.getByRole('link', { name: 'Contact me' });
  await expect(contact).toHaveAttribute('href', 'mailto:jeanne.martin@example.dev');
  if (testInfo.project.name === 'bold') {
    // The bold fixture adds a photo and a CV (e2e/fixtures/bold.config.ts).
    await expect(hero.getByRole('img', { name: 'Photo of Jeanne Martin' })).toHaveAttribute('src', '/favicon.svg');
    const cv = hero.getByRole('link', { name: 'Download CV (PDF)' });
    await expect(cv).toHaveAttribute('href', '/cv.pdf');
    await expect(cv).toHaveAttribute('download', '');
    await expect(hero.locator('.button')).toHaveText(['Download CV (PDF)', 'Contact me']);
  } else {
    await expect(hero.getByRole('img')).toHaveCount(0);
    await expect(hero.locator('.initials')).toHaveText('JM');
    await expect(hero.getByRole('link', { name: /CV/ })).toHaveCount(0);
  }
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

test('each project card is a single link that covers the whole card', async ({ page }) => {
  await page.goto('/en/');
  const cards = page.locator('#projects > ul > li');
  await expect(cards).not.toHaveCount(0);
  for (const card of await cards.all()) await expect(card.getByRole('link')).toHaveCount(1);
  const featured = cards.filter({ hasText: 'Library manager' });
  await expect(featured).toContainText('Featured');
  // Whatever part of the card is pointed at (here the description), the link receives the click.
  await featured.scrollIntoViewIfNeeded();
  const box = (await featured.getByText('Book lending web app').boundingBox())!;
  const target = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x!, y!)?.closest('a')?.getAttribute('href'),
    [box.x + box.width / 2, box.y + box.height / 2],
  );
  expect(target).toBe('/en/projects/bibliotheque/');
  await featured.click();
  await expect(page).toHaveURL(/\/en\/projects\/bibliotheque\/$/);
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
  const overflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  for (const path of ['/', '/en/projects/bibliotheque/']) {
    await page.goto(path);
    expect(await overflow(), path).toBeLessThanOrEqual(0);
    // Fallback fonts differ between machines (DejaVu Sans on Linux CI is wide). Widening every glyph
    // makes long words (e-mail addresses, "Recommandations") overflow here as they would on CI.
    await page.addStyleTag({ content: '* { letter-spacing: 0.25em !important; }' });
    expect(await overflow(), `${path} with wide text`).toBeLessThanOrEqual(0);
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
