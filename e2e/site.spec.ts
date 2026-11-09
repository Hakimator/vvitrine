import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** Runs for both themes: the same content must behave the same whatever the theme. */

/** Answers the cookie banner in advance (bold fixture), so it does not cover what a test clicks. */
const rememberChoice = (page: Page, granted: boolean) =>
  page.addInitScript((value) => {
    localStorage.setItem('vvitrine:consent', JSON.stringify({ granted: value, at: Date.now() }));
  }, granted);

test('home page renders the configured sections in order, in French by default', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Jeanne Martin');
  const ids = await page.locator('main h2').evaluateAll((els) => els.map((e) => e.id));
  expect(ids).toEqual([
    'stats-title',
    'projects-title',
    'blog-title',
    'work-title',
    'education-title',
    'volunteer-title',
    'skills-title',
    'certificates-title',
    'awards-title',
    'talks-title',
    'languages-title',
    'interests-title',
    'testimonials-title',
    'references-title',
    'contact-title',
  ]);
  await expect(page.locator('#work-title')).toHaveText('Expérience');
  await expect(page.locator('#volunteer-title')).toHaveText('Bénévolat');
  await expect(page.locator('#interests-title')).toHaveText('Centres d’intérêt');
});

test('images are responsive, sized and lazy where they should be', async ({ page }, testInfo) => {
  await page.goto('/en/');
  const card = page.locator('#projects img');
  await expect(card).toHaveAttribute('srcset', /\/_images\/bibliotheque-[0-9a-f]{6}-480\.webp 480w, .*960w, .*1440w$/);
  await expect(card).toHaveAttribute('width', '1600');
  await expect(card).toHaveAttribute('height', '900');
  await expect(card).toHaveAttribute('loading', 'lazy');
  await card.scrollIntoViewIfNeeded();
  await expect.poll(() => card.evaluate((img: HTMLImageElement) => img.currentSrc)).toMatch(/\.webp$/);
  const variant = await card.evaluate((img: HTMLImageElement) => img.currentSrc);
  const response = await page.request.get(variant);
  expect(response.headers()['content-type']).toBe('image/webp');
  if (testInfo.project.name === 'bold') {
    // The hero photo is above the fold: loaded first, never lazily.
    const photo = page.locator('#hero img');
    await expect(photo).toHaveAttribute('fetchpriority', 'high');
    await expect(photo).not.toHaveAttribute('loading', 'lazy');
  }
});

test('a project page shows its Markdown write-up', async ({ page }) => {
  await page.goto('/en/projects/bibliotheque/');
  const article = page.locator('main article');
  await expect(article.getByRole('heading', { level: 2, name: 'The problem' })).toBeVisible();
  await expect(article.locator('pre code')).toContainText('export function canLend');
  await expect(article.getByRole('table')).toContainText('Time to record a loan');
  await page.goto('/projects/bibliotheque/');
  await expect(page.locator('main article').getByRole('heading', { level: 2, name: 'Le problème' })).toBeVisible();
});

test('on a phone, a write-up with wide code and tables stays accessible', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const page = await context.newPage();
  await page.goto('/en/projects/bibliotheque/');
  // The code block scrolls inside itself, so keyboard users must be able to reach it (WCAG 2.1.1).
  await expect(page.locator('main pre')).toHaveAttribute('tabindex', '0');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
  await context.close();
});

test('every page has exactly one main heading', async ({ page }) => {
  const pages = [
    ['/en/', 'Jeanne Martin'],
    ['/en/projects/bibliotheque/', 'Library manager'],
    ['/en/timeline/', 'My journey'],
    ['/timeline/', 'Mon parcours'],
    ['/en/blog/', 'Blog'],
    ['/en/blog/plugin-portfolio/', 'Building a plugin-based portfolio'],
    ['/en/projects/', 'My projects'],
    ['/projects/tag/postgresql/', 'Projets avec PostgreSQL'],
    ['/en/privacy/', 'Privacy'],
    ['/en/resume/', 'Jeanne Martin'],
  ];
  for (const [path, heading] of pages) {
    await page.goto(path!);
    await expect(page.getByRole('heading', { level: 1 }), path).toHaveText([heading!]);
  }
});

test('the timeline page merges work, education, volunteering and milestones, most recent first', async ({ page }) => {
  await page.goto('/en/');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Timeline' }).click();
  await expect(page).toHaveURL(/\/en\/timeline\/#timeline$/);
  await expect(page.locator('#timeline h3')).toHaveText([
    /Software engineering intern/,
    /Volunteer developer/,
    /Engineering degree/,
    /First open-source contribution/,
  ]);
});

test('key figures and testimonials are shown on the home page', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('#stats li')).toHaveText(['12 projects shipped', '2 years of team projects', /40 %/]);
  await expect(page.locator('#testimonials figcaption')).toContainText('Camille Bernard');
});

test('references are quotations with their author', async ({ page }) => {
  await page.goto('/en/');
  const quote = page.locator('#references figure');
  await expect(quote.locator('blockquote')).toContainText('Reliable, curious and a pleasure to work with.');
  await expect(quote.locator('figcaption')).toContainText('Alex Dupont');
  await expect(quote.locator('figcaption')).toContainText('Engineering manager, Fictional Company');
});

test('header links never overlap and stay inside the header, whatever the font', async ({ page }) => {
  // Font widths differ between machines (DejaVu Sans on Linux CI is about 10% wider than Segoe UI or San Francisco),
  // so links may wrap onto a second line. What must hold everywhere: each link is whole, readable and clickable.
  await page.setViewportSize({ width: 1024, height: 700 });
  for (const path of ['/', '/en/']) {
    for (const spacing of ['normal', '0.1em']) {
      await page.goto(path);
      await page.addStyleTag({ content: `.site-header a { letter-spacing: ${spacing} !important; }` });
      const { links, header, width } = await page.evaluate(() => {
        const box = (e: Element) => {
          const r = e.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        };
        return {
          links: [...document.querySelectorAll('.nav-inline a, .locales a')].map(box),
          header: box(document.querySelector('.site-header')!),
          width: document.documentElement.clientWidth,
        };
      });
      const where = `${path} (letter-spacing ${spacing})`;
      expect(links.length, where).toBeGreaterThan(1);
      for (const [i, a] of links.entries()) {
        expect(a.left, where).toBeGreaterThanOrEqual(0);
        expect(a.right, where).toBeLessThanOrEqual(width);
        expect(a.top, where).toBeGreaterThanOrEqual(header.top);
        expect(a.bottom, where).toBeLessThanOrEqual(header.bottom);
        for (const b of links.slice(i + 1)) {
          const apart = a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
          expect(apart, `${where}: two links overlap`).toBe(true);
        }
      }
    }
  }
});

test('header links lead to each section, without the sticky header covering its title', async ({ page }) => {
  await page.goto('/en/');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link')).toHaveText([
    'Experience',
    'Education',
    'Skills',
    'Talks',
    'Languages',
    'Projects',
    'Timeline',
    'Articles',
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
  // The demo points the button at its contact section (by default it opens an e-mail).
  await expect(contact).toHaveAttribute('href', '#contact');
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
    // The demo links the PDF generated for the page language.
    await expect(hero.getByRole('link', { name: 'Download CV (PDF)' })).toHaveAttribute('href', '/cv-en.pdf');
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
  await expect(page).toHaveURL(/\/en\/projects\/#projects$/);
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

test('the blog lists articles, newest first, and each article has its own page', async ({ page }) => {
  await page.goto('/en/');
  // The home page shows a teaser of the latest articles.
  await expect(page.locator('#blog h3')).toHaveText([
    'Building a plugin-based portfolio',
    'WCAG 2.2 in practice for students',
  ]);

  await page.goto('/en/blog/');
  await page.getByRole('link', { name: 'Building a plugin-based portfolio' }).click();
  await expect(page).toHaveURL(/\/en\/blog\/plugin-portfolio\/$/);
  await expect(page.locator('time')).toHaveAttribute('datetime', '2026-11-07');
  await expect(page.getByText('1 min read')).toBeVisible();

  // The table of contents links to the article's sections.
  const toc = page.getByRole('navigation', { name: 'On this page' });
  await expect(toc.getByRole('link')).toHaveText([
    'Why everything is a plugin',
    'Content owned by plugins',
    'Shared shapes',
    'Lessons learned',
  ]);
  await toc.getByRole('link', { name: 'Shared shapes' }).click();
  await expect(page).toHaveURL(/#shared-shapes$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Shared shapes' })).toBeInViewport();

  await page.getByRole('link', { name: 'All articles' }).click();
  await expect(page).toHaveURL(/\/en\/blog\/$/);
});

test('article headings in the table of contents are shown as written', async ({ page }) => {
  await page.goto('/blog/plugin-portfolio/');
  await expect(page.getByRole('navigation', { name: 'Sur cette page' }).getByRole('link').last()).toHaveText(
    "Ce que j'en retiens",
  );
});

test('the contact form is a plain HTML form that needs no JavaScript', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'bold', 'The demo has no form key; the bold fixture sets one.');
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/en/');
  await page.locator('#hero').getByRole('link', { name: 'Contact me' }).click();
  await expect(page).toHaveURL(/#contact$/);

  const section = page.locator('#contact');
  const form = section.locator('form');
  await expect(form).toHaveAttribute('action', 'https://api.web3forms.com/submit');
  await expect(form).toHaveAttribute('method', 'post');
  for (const [label, type] of [
    ['Name', 'text'],
    ['E-mail address', 'email'],
  ] as const) {
    await expect(section.getByLabel(label)).toHaveAttribute('type', type);
    await expect(section.getByLabel(label)).toHaveAttribute('required', '');
  }
  await expect(section.getByLabel('Message')).toHaveAttribute('required', '');
  // The honeypot is invisible and unreachable for people.
  await expect(form.locator('input[name="botcheck"]')).toBeHidden();
  await expect(form.locator('input[type="hidden"][name="access_key"]')).toHaveCount(1);

  // The browser checks the fields before anything is sent.
  await section.getByRole('button', { name: 'Send' }).click();
  await expect(page).toHaveURL(/\/en\/#contact$/);
  expect(await section.getByLabel('Name').evaluate((e: HTMLInputElement) => e.validity.valueMissing)).toBe(true);

  await expect(section.getByRole('link', { name: 'How Web3Forms handles your data' })).toHaveAttribute(
    'href',
    'https://web3forms.com/dpa',
  );
  await expect(section.locator('a[href^="mailto:"]')).toHaveText('jeanne.martin@example.dev', { useInnerText: true });
  await context.close();
});

test('without a form key, the contact section offers the e-mail address only', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'corporate', 'The bold fixture sets a form key.');
  await page.goto('/');
  const section = page.locator('#contact');
  await expect(section.locator('form')).toHaveCount(0);
  await expect(section).toContainText('Mon adresse e-mail :');
  await expect(section.locator('a[href^="mailto:"]')).toHaveText('jeanne.martin@example.dev', { useInnerText: true });
});

test('the e-mail address is shown, copied and opened correctly, but never written plainly in the page', async ({
  page,
  request,
  context,
}) => {
  for (const path of ['/', '/en/', '/projects/bibliotheque/', '/blog/plugin-portfolio/']) {
    const html = await (await request.get(path)).text();
    expect(html, path).not.toContain('jeanne.martin@example.dev');
  }
  await page.goto('/en/');
  const link = page.locator('#contact a[href^="mailto:"]');
  // The browser decodes the link it opens.
  expect(decodeURIComponent((await link.getAttribute('href'))!)).toBe('mailto:jeanne.martin@example.dev');
  await expect(link).toHaveText('jeanne.martin@example.dev', { useInnerText: true });
  // Copying the address gives the real one, without the hidden decoys.
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await link.selectText();
  await page.keyboard.press('ControlOrMeta+C');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('jeanne.martin@example.dev');
  // Screen readers announce the real address too (Chromium's accessibility tree).
  const cdp = await context.newCDPSession(page);
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  expect(nodes.some((n) => n.role?.value === 'link' && n.name?.value === 'jeanne.martin@example.dev')).toBe(true);
});

test('the "message sent" page has a heading and leads back to the site', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'bold', 'Only a site with a form key has this page.');
  await page.goto('/contact/sent/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Message envoyé');
  await page.getByRole('link', { name: 'Retour au site' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('every page links to the privacy page from its footer, not from its header', async ({ page }, testInfo) => {
  // The bold fixture has analytics, so its footer also offers to change the cookie choice.
  const links = testInfo.project.name === 'bold' ? ['Resume', 'Privacy', 'Manage cookies'] : ['Resume', 'Privacy'];
  await rememberChoice(page, false);
  for (const path of ['/en/', '/en/projects/bibliotheque/', '/en/blog/']) {
    await page.goto(path);
    const footer = page.getByRole('contentinfo');
    await expect(footer.getByRole('navigation', { name: 'Footer links' }).getByRole('link')).toHaveText(links);
    await expect(footer).toContainText(`© ${new Date().getFullYear()} Jeanne Martin`);
    await expect(page.getByRole('banner').getByRole('link', { name: 'Privacy' })).toHaveCount(0);
  }
  await page.getByRole('contentinfo').getByRole('link', { name: 'Privacy' }).click();
  await expect(page).toHaveURL(/\/en\/privacy\/$/);
});

test('the privacy page lists what leaves the site, generated from the plugins', async ({ page }, testInfo) => {
  await page.goto('/en/privacy/');
  const section = page.locator('#privacy');
  await expect(section.getByRole('link', { name: 'GitHub Pages privacy statement' })).toBeVisible();
  await expect(section.locator('a[href^="mailto:"]')).toHaveText('jeanne.martin@example.dev', { useInnerText: true });
  if (testInfo.project.name === 'bold') {
    // The bold fixture has analytics and a contact form key: both services are listed.
    await expect(section).toContainText('Some services below set cookies: they only do so with your consent.');
    // In the order of the plugins in the configuration.
    await expect(section.getByRole('article').getByRole('heading', { level: 3 })).toHaveText([
      'Web3Forms',
      'Google Analytics',
    ]);
    const analytics = section.getByRole('article').last();
    await expect(analytics).toContainText('Only if you accept in the cookie banner');
    await expect(analytics.getByRole('definition').last()).toHaveText('Yes');
    const service = section.getByRole('article').first();
    await expect(service).toContainText('Only when you send the form');
    await expect(service).toContainText('Up to 3 years');
    await expect(service.getByRole('link', { name: 'Web3Forms terms' })).toHaveAttribute(
      'href',
      'https://web3forms.com/dpa',
    );
  } else {
    await expect(section).toContainText('This site sets no cookies and sends no data to third-party services');
    await expect(section.getByRole('article')).toHaveCount(0);
  }
});

test('the resume page prints on A4 in light colours, without navigation or buttons', async ({ page }) => {
  await page.emulateMedia({ media: 'print', colorScheme: 'dark' });
  await page.goto('/en/resume/');
  for (const hidden of ['.site-header', '.site-footer', '.skip', '#hero .button']) {
    await expect(page.locator(hidden).first(), hidden).toBeHidden();
  }
  const colours = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    return [body.backgroundColor, body.color];
  });
  expect(colours[0]).toBe('rgb(255, 255, 255)');
  // Dark text on paper: each channel well under the middle.
  expect(
    colours[1]!
      .match(/\d+/g)!
      .slice(0, 3)
      .every((c) => Number(c) < 100),
  ).toBe(true);
  await expect(page.locator('#work')).toBeVisible();
  // The browser lays it out on A4 pages.
  const pdf = await page.pdf({ preferCSSPageSize: true });
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
});

test('the CV is a PDF generated for each language', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'corporate', 'The demo generates the PDF; the bold fixture links a static file.');
  for (const locale of ['fr', 'en']) {
    const response = await request.get(`/cv-${locale}.pdf`);
    expect(response.headers()['content-type']).toContain('application/pdf');
    const body = await response.body();
    expect(body.subarray(0, 8).toString()).toBe('%PDF-1.7');
    expect(body.toString('latin1')).toContain(`/Lang (${locale})`);
  }
  await page.goto('/');
  await expect(page.locator('#hero').getByRole('link', { name: 'Télécharger le CV (PDF)' })).toHaveAttribute(
    'href',
    '/cv-fr.pdf',
  );
});

test('without JavaScript, the technology filter opens one page per technology', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/en/projects/');
  const filter = page.getByRole('navigation', { name: 'Filter by technology' });
  await expect(filter.getByRole('link', { name: 'All' })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#projects li[data-tags]')).toHaveCount(2);

  await filter.getByRole('link', { name: 'Python' }).click();
  await expect(page).toHaveURL(/\/en\/projects\/tag\/python\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Projects with Python');
  await expect(page.locator('#projects li[data-tags]')).toHaveCount(1);
  await expect(page.locator('#projects h3')).toHaveText('Weather dashboard');
  const current = page.getByRole('navigation', { name: 'Filter by technology' }).getByRole('link', { name: 'Python' });
  await expect(current).toHaveAttribute('aria-current', 'page');

  await page.getByRole('navigation', { name: 'Filter by technology' }).getByRole('link', { name: 'All' }).click();
  await expect(page).toHaveURL(/\/en\/projects\/#projects$/);
  await context.close();
});

test('with JavaScript, the technology filter works in place and keeps a shareable address', async ({ page }) => {
  await page.goto('/en/projects/');
  // One small inline script, no file to download.
  await expect(page.locator('script[src]')).toHaveCount(0);
  const filter = page.getByRole('navigation', { name: 'Filter by technology' });
  const cards = page.locator('#projects li[data-tags]');

  await filter.getByRole('link', { name: 'Python' }).click();
  await expect(page).toHaveURL(/\/en\/projects\/tag\/python\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('My projects');
  await expect(cards.filter({ visible: true })).toHaveCount(1);
  await expect(page.getByRole('status')).toHaveText('1 project shown');
  await expect(filter.getByRole('link', { name: 'Python' })).toHaveAttribute('aria-current', 'page');
  await expect(filter.getByRole('link', { name: 'All' })).not.toHaveAttribute('aria-current');

  await filter.getByRole('link', { name: 'PostgreSQL' }).click();
  await expect(cards.filter({ visible: true })).toHaveCount(2);
  await expect(page.getByRole('status')).toHaveText('2 projects shown');

  await page.goBack();
  await expect(page).toHaveURL(/\/tag\/python\/$/);
  await expect(cards.filter({ visible: true })).toHaveCount(1);
  await page.goBack();
  await expect(page).toHaveURL(/\/en\/projects\/$/);
  await expect(cards.filter({ visible: true })).toHaveCount(2);
});

test('the home page ships no JavaScript even with the filter on another page', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'bold', 'The bold fixture adds analytics, which needs a consent script.');
  await page.goto('/projects/');
  await expect(page.locator('script:not([type="application/ld+json"])')).toHaveCount(1);
  await page.goto('/');
  await expect(page.locator('script:not([type="application/ld+json"])')).toHaveCount(0);
});

for (const path of [
  '/',
  '/en/',
  '/projects/bibliotheque/',
  '/en/timeline/',
  '/blog/plugin-portfolio/',
  '/en/projects/',
  '/projects/tag/postgresql/',
  '/privacy/',
  '/resume/',
]) {
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

test('ships zero JavaScript and makes no third-party requests (privacy by default)', async ({
  page,
  baseURL,
}, testInfo) => {
  const external: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith(baseURL!)) external.push(r.url());
  });
  await page.goto('/');
  // Even with analytics installed (bold fixture), nothing leaves the site before the visitor chooses.
  expect(external).toEqual([]);
  if (testInfo.project.name !== 'bold') {
    expect(await page.locator('script:not([type="application/ld+json"])').count()).toBe(0);
  }
});

test.describe('light/dark switch (bold fixture, which turns it on)', () => {
  test('follows the system first, then the visitor, on every page', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'bold', 'The demo keeps zero JavaScript: no switch.');
    await rememberChoice(page, false);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/en/');
    const toggle = page.getByRole('banner').getByRole('button', { name: 'Dark mode' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(await background()).toBe('rgb(255, 255, 255)');

    // Remembered on the next page, and applied before the page is drawn (the script is first in <head>).
    await page.goto('/en/projects/');
    await expect(page.getByRole('banner').getByRole('button', { name: 'Dark mode' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(await background()).toBe('rgb(255, 255, 255)');
    expect(await page.locator('head > script').first().textContent()).toContain('vvitrine:color-scheme');

    // Paper stays light, whatever was chosen.
    await page.getByRole('banner').getByRole('button', { name: 'Dark mode' }).click();
    await page.emulateMedia({ media: 'print' });
    expect(await background()).toBe('rgb(255, 255, 255)');
  });

  test('is hidden without JavaScript, and absent where the theme does not offer it', async ({ browser }, testInfo) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/en/');
    const toggle = page.locator('[data-color-scheme-toggle]');
    if (testInfo.project.name === 'bold') await expect(toggle).toBeHidden();
    else await expect(toggle).toHaveCount(0);
    await context.close();
  });
});

test.describe('consent banner (bold fixture, which has Google Analytics)', () => {
  const google = /googletagmanager\.com|google-analytics\.com/;

  test('asks first, with Refuse as easy as Accept, and loads nothing before a choice', async ({
    page,
    context,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'bold', 'Only the bold fixture has analytics.');
    const requests: string[] = [];
    await context.route(google, (route) => {
      requests.push(route.request().url());
      return route.fulfill({ contentType: 'text/javascript', body: '' });
    });
    await page.goto('/en/');
    const banner = page.getByRole('region', { name: 'Cookies and statistics' });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Google Analytics');
    const accept = banner.getByRole('button', { name: 'Accept' });
    const refuse = banner.getByRole('button', { name: 'Refuse' });
    // Same size and same look.
    const [a, r] = [await accept.boundingBox(), await refuse.boundingBox()];
    expect(Math.round(a!.width)).toBe(Math.round(r!.width));
    expect(Math.round(a!.height)).toBe(Math.round(r!.height));
    const look = (button: typeof accept) =>
      button.evaluate((e) => {
        const style = getComputedStyle(e);
        return [style.backgroundColor, style.color, style.fontSize, style.fontWeight];
      });
    expect(await look(accept)).toEqual(await look(refuse));
    await expect(banner.getByRole('link', { name: 'Learn more' })).toHaveAttribute('href', '/en/privacy/');
    await page.waitForTimeout(300);
    expect(requests).toEqual([]);
  });

  test('refusing loads nothing, is remembered, and removes analytics cookies', async ({ page, context }, testInfo) => {
    test.skip(testInfo.project.name !== 'bold', 'Only the bold fixture has analytics.');
    const requests: string[] = [];
    await context.route(google, (route) => {
      requests.push(route.request().url());
      return route.fulfill({ contentType: 'text/javascript', body: '' });
    });
    await page.goto('/en/');
    await page.evaluate(() => {
      document.cookie = '_ga=GA1.1.1; path=/';
      document.cookie = '_ga_E2ETEST01=GS1; path=/';
    });
    await page.getByRole('button', { name: 'Refuse' }).click();
    await expect(page.getByRole('region', { name: 'Cookies and statistics' })).toBeHidden();
    expect(await page.evaluate(() => document.cookie)).not.toContain('_ga');
    await page.reload();
    await expect(page.getByRole('region', { name: 'Cookies and statistics' })).toBeHidden();
    await page.waitForTimeout(300);
    expect(requests).toEqual([]);
  });

  test('accepting loads Google Analytics, without advertising features, and can be undone from the footer', async ({
    page,
    context,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'bold', 'Only the bold fixture has analytics.');
    const requests: string[] = [];
    await context.route(google, (route) => {
      requests.push(route.request().url());
      return route.fulfill({ contentType: 'text/javascript', body: '' });
    });
    await page.goto('/en/');
    await page.getByRole('button', { name: 'Accept' }).click();
    await expect.poll(() => requests).toEqual(['https://www.googletagmanager.com/gtag/js?id=G-E2ETEST01']);
    const layer = await page.evaluate(() =>
      (window as unknown as { dataLayer: IArguments[] }).dataLayer.map((args) => JSON.stringify([...args])),
    );
    expect(layer[0]).toContain('"ad_storage":"denied"');
    expect(layer[0]).toContain('"analytics_storage":"granted"');
    expect(layer[2]).toContain('"allow_google_signals":false');

    // The choice is remembered on the next page.
    await page.goto('/en/projects/');
    await expect(page.getByRole('region', { name: 'Cookies and statistics' })).toBeHidden();
    // "Manage cookies" opens the banner again, with the focus on it.
    await page.getByRole('contentinfo').getByRole('link', { name: 'Manage cookies' }).click();
    const banner = page.getByRole('region', { name: 'Cookies and statistics' });
    await expect(banner).toBeVisible();
    await expect(banner).toBeFocused();
    await banner.getByRole('button', { name: 'Refuse' }).click();
    await expect(banner).toBeHidden();
  });

  test('without JavaScript there is no banner, and nothing can track the visitor', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'bold', 'Only the bold fixture has analytics.');
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/en/');
    await expect(page.locator('#vvitrine-consent')).toBeHidden();
    await context.close();
  });
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
  for (const path of ['/', '/en/projects/bibliotheque/', '/blog/plugin-portfolio/', '/projects/', '/privacy/']) {
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
