import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * The local Studio (US-134, US-135), in `astro dev` (e2e/studio-server.mjs), on a copy of the demo content and layout
 * file: every test saves real files there. The tests run in order, each from the files the previous one left.
 */
test.describe.configure({ mode: 'serial' });

/** The copy the server reads (the same folder as e2e/studio-server.mjs). */
const content = (file: string) => readFileSync(join(tmpdir(), 'vvitrine-studio-e2e', file), 'utf8');

async function open(page: Page, key?: string) {
  await page.goto('/__vvitrine/studio/');
  const nav = page.getByRole('navigation', { name: 'Studio' }).getByRole('list', { name: 'Content' });
  await expect(nav.getByRole('button').first()).toBeVisible();
  if (key) await nav.getByRole('button', { name: key, exact: true }).click();
  return nav;
}

const status = (page: Page) => page.getByRole('status');
const save = (page: Page) => page.getByRole('button', { name: /^Save/ }).click();

test('shows every content key in both languages, with no accessibility violation', async ({ page }) => {
  const nav = await open(page);
  const keys = await nav.getByRole('button').allTextContents();
  expect(keys.length).toBeGreaterThan(10);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  for (const key of keys) {
    await nav.getByRole('button', { name: key, exact: true }).click();
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(key);
    for (const language of ['FR', 'EN']) {
      const section = page.getByRole('region', { name: new RegExp(`^${language}`) });
      await expect(section.locator('input, textarea, select, pre, button').first()).toBeAttached();
    }
  }
});

test('saves a field into its YAML file, keeping the comments', async ({ page }) => {
  await open(page);
  await page.locator('#field-en-basics-label').fill('Software engineering student');
  await save(page);
  await expect(status(page)).toHaveText(/^Saved: \S*resume\.en\.yaml\.$/);
  const file = content('resume.en.yaml');
  expect(file).toContain('  label: Software engineering student\n');
  expect(file).toMatch(/^# Fictional demo content\./);
  expect(content('resume.fr.yaml')).not.toContain('Software engineering student');
});

test('flags a value the build would refuse and does not save it until it is fixed', async ({ page }) => {
  await open(page, 'Work');
  const date = page.locator('#field-en-work-0-startDate');
  await date.fill('June 2025');
  await expect(date).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#field-en-work-0-startDate-issues')).toBeVisible();
  await save(page);
  await expect(status(page)).toHaveText(/^Not saved: 1 problem to fix first/);
  expect(content('resume.en.yaml')).toContain('startDate: 2025-06\n');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(date).toHaveValue('2025-06');
  await expect(date).not.toHaveAttribute('aria-invalid');
  await save(page);
  await expect(status(page)).toHaveText('Nothing to save.');
});

test('shows a field that is filled in one language and missing in the other', async ({ page }) => {
  await open(page);
  await page.locator('#field-fr-basics-label').fill('');
  await expect(page.locator('#field-fr-basics-label-missing')).toHaveText('Missing in FR: filled in EN.');
  await expect(page.locator('#field-en-basics-label-missing')).toHaveCount(0);
});

test('adds an item in every language, duplicates and removes it with a single pointer', async ({ page }) => {
  await open(page, 'Certificates');
  const english = page.getByRole('region', { name: /^EN/ });
  await english.getByRole('button', { name: 'Add to Certificates' }).click();
  await expect(status(page)).toHaveText('New item added to Certificates, at position 2, in every language.');
  await page.locator('#field-en-certificates-1-name').fill('E2E Testing Basics');
  await page.locator('#field-fr-certificates-1-name').fill('Bases des tests de bout en bout');
  await save(page);
  await expect(status(page)).toHaveText(/^Saved: /);
  expect(content('resume.en.yaml')).toContain('E2E Testing Basics');
  expect(content('resume.fr.yaml')).toContain('Bases des tests de bout en bout');

  await page.getByRole('button', { name: 'Move or change E2E Testing Basics (EN)' }).click();
  await page.getByRole('menuitem', { name: 'Duplicate' }).click();
  await expect(status(page)).toHaveText(
    'E2E Testing Basics duplicated, in every language: the copy is at position 3 of 3.',
  );
  await expect(page.locator('#field-fr-certificates-2-name')).toHaveValue('Bases des tests de bout en bout');
  await expect(page.getByRole('button', { name: 'Move or change E2E Testing Basics (EN)' }).last()).toBeFocused();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('#field-en-certificates-2-name')).toHaveCount(0);

  await page.getByRole('button', { name: 'Move or change E2E Testing Basics (EN)' }).click();
  await page.getByRole('menuitem', { name: 'Remove' }).click();
  await expect(status(page)).toHaveText(
    'E2E Testing Basics removed from Certificates, in every language. Undo brings it back.',
  );
  await expect(english.getByRole('button', { name: 'Add to Certificates' })).toBeFocused();
  await save(page);
  await expect(status(page)).toHaveText(/^Saved: /);
  expect(content('resume.en.yaml')).not.toContain('E2E Testing Basics');
  expect(content('resume.fr.yaml')).not.toContain('Bases des tests de bout en bout');
});

test('saves a project into its Markdown file, keeping the write-up', async ({ page }) => {
  await open(page, 'Projects');
  const ids = await page
    .locator('input[id^="field-en-projects-"][id$="-name"]')
    .evaluateAll((inputs) =>
      inputs.filter((input) => (input as HTMLInputElement).value === 'Weather dashboard').map((input) => input.id),
    );
  expect(ids).toHaveLength(1);
  const before = content('projects/meteo.en.md');
  await page.locator(`#${ids[0]}`).fill('Weather board');
  await save(page);
  await expect(status(page)).toHaveText(/^Saved: /);
  const after = content('projects/meteo.en.md');
  expect(after).toContain('name: Weather board\n');
  expect(after.split('---').at(-1)).toBe(before.split('---').at(-1));
});

// ---------- The page builder (US-135) ----------

async function openPages(page: Page) {
  await page.goto('/__vvitrine/studio/');
  await page.getByRole('navigation', { name: 'Studio' }).getByRole('button', { name: 'Pages', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Pages');
}

const region = (page: Page, name: RegExp) => page.getByRole('region', { name });
const names = (page: Page, name: RegExp) => region(page, name).locator('.placed .name').allTextContents();

test('arranges the pages with the keyboard only, each move announced, and saves the layout in place', async ({
  page,
}) => {
  await openPages(page);
  const before = content('site.yaml');
  const menu = page.getByRole('button', { name: 'Move or change Experience on Home page' });
  await menu.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem').first()).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Enter'); // Move up
  await expect(status(page)).toHaveText('Experience moved to position 4 of 16 on Home page.');
  await expect(menu).toBeFocused();

  // Up opens the menu on its last action; Escape closes it and gives the focus back.
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('menuitem', { name: 'Remove from this page' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(menu).toBeFocused();

  // To another page: Talks joins the timeline page, and keeps the keyboard.
  await page.getByRole('button', { name: 'Move or change Talks on Home page' }).focus();
  await page.keyboard.press('Enter');
  const item = page.getByRole('menuitem', { name: 'Move to My journey' });
  while (!(await item.evaluate((element) => element === document.activeElement)))
    await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(status(page)).toHaveText('Talks moved to My journey, position 2 of 2.');
  await expect(page.getByRole('button', { name: 'Move or change Talks on My journey' })).toBeFocused();
  expect(await names(page, /^My journey/)).toEqual(['Timeline', 'Talks']);

  await page.keyboard.press('Control+s');
  await expect(status(page)).toHaveText(/^Saved: \S*site\.yaml\.$/);
  const after = content('site.yaml');
  // Work moved above the blog, which keeps its comment.
  expect(after).toContain('      - work\n      # The two latest articles');
  expect(after).toContain('    sections: [timeline, talks]\n');
  expect(after.match(/^\s*#.*$/gm)).toEqual(before.match(/^\s*#.*$/gm));
});

test('hides, adds and removes sections with a single pointer, and the site follows', async ({ page }) => {
  await openPages(page);
  await page.getByRole('button', { name: 'Move or change Awards on Home page' }).click();
  await page.getByRole('menuitem', { name: 'Hide on this page' }).click();
  await expect(status(page)).toHaveText('Awards hidden on Home page. It keeps its place and its options.');
  await expect(region(page, /^Home page/).locator('.placed', { hasText: 'Awards' })).toContainText(
    '(hidden, not in the menu)',
  );

  // "Add a section" lists the installed sections that are not on the page yet.
  await page.getByRole('button', { name: 'Add a section to Resume' }).click();
  const choices = await page.getByRole('menuitem').allTextContents();
  expect(choices).toContain('Awards');
  expect(choices).not.toContain('Experience');
  await page.getByRole('menuitem', { name: 'Awards' }).click();
  await expect(status(page)).toHaveText('Awards added to Resume, position 8 of 8.');
  await page.getByRole('button', { name: 'Move or change Awards on Resume' }).click();
  await page.getByRole('menuitem', { name: 'Remove from this page' }).click();
  await expect(status(page)).toHaveText('Awards removed from Resume.');
  await expect(page.getByRole('button', { name: 'Add a section to Resume' })).toBeFocused();
  await page.getByRole('button', { name: 'Undo' }).click();
  expect((await names(page, /^Resume/)).at(-1)).toBe('Awards');

  await save(page);
  await expect(status(page)).toHaveText(/^Saved: /);
  const file = content('site.yaml');
  expect(file).toContain('      - { id: awards, nav: false, hidden: true }\n');
  expect(file).toContain('      - interests\n      - awards\n');
  // The site itself: hidden on the home page, shown on the resume. The dev server sees the saved file a moment
  // later (its file watcher), so the page is loaded again until it does.
  const shows = async (path: string, count: number) =>
    expect(async () => {
      await page.goto(path);
      await expect(page.locator('#awards')).toHaveCount(count, { timeout: 500 });
    }).toPass({ timeout: 15_000 });
  await shows('/en/', 0);
  await shows('/en/resume/', 1);
});

test('moves a section by dragging it by its handle, the same move as the menu', async ({ page }) => {
  // Both ends of the drag in view: the test's pointer does not scroll the page while it drags, as a person's would.
  await page.setViewportSize({ width: 1280, height: 1600 });
  await openPages(page);
  const home = region(page, /^Home page/);
  await home
    .locator('.placed', { hasText: 'Contact' })
    .locator('.grip')
    .dragTo(home.locator('.placed').first(), { targetPosition: { x: 10, y: 2 } });
  await expect(status(page)).toHaveText(/^Contact moved to position 1 of \d+ on Home page\.$/);
  expect((await names(page, /^Home page/))[0]).toBe('Contact');
  await page.getByRole('button', { name: 'Undo' }).click();
  expect((await names(page, /^Home page/))[0]).toBe('Hero');
});

// ---------- List items (US-136) ----------

test('reorders list items in every language with the keyboard only, and saves both files', async ({ page }) => {
  await open(page, 'Skills');
  const menu = page.getByRole('button', { name: 'Move or change Tools (EN)' });
  await menu.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Move up' })).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Enter');
  await expect(status(page)).toHaveText('Tools moved to position 1 of 2 in Skills, in every language.');
  await expect(menu).toBeFocused();
  await expect(page.locator('#field-fr-skills-0-name')).toHaveValue('Outils');
  await page.keyboard.press('Control+s');
  await expect(status(page)).toHaveText(/^Saved: /);
  const before = (file: string, first: string, second: string) =>
    content(file).indexOf(`name: ${first}`) < content(file).indexOf(`name: ${second}`);
  expect(before('resume.en.yaml', 'Tools', 'Languages')).toBe(true);
  expect(before('resume.fr.yaml', 'Outils', 'Langages')).toBe(true);
});

test('reorders the items of a nested list by dragging one by its handle', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1600 });
  await open(page, 'Skills');
  const keywords = page.locator('section[lang="en"] [id="field-en-skills-0-keywords-item-0"]');
  await expect(keywords).toBeVisible();
  const rows = page.locator('section[lang="en"] .list .list').first().locator(':scope > ol > li');
  const second = await page.locator('#field-en-skills-0-keywords-1').inputValue();
  await rows
    .nth(1)
    .locator(':scope > .grip')
    .dragTo(rows.nth(0), { targetPosition: { x: 30, y: 3 } });
  await expect(status(page)).toHaveText(
    new RegExp(`^${second} moved to position 1 of \\d+ in Keywords, in every language\\.$`),
  );
  await expect(page.locator('#field-en-skills-0-keywords-0')).toHaveValue(second);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('#field-en-skills-0-keywords-1')).toHaveValue(second);
});

test('takes the order of the files after adding a project, so later edits reach its file', async ({ page }) => {
  await open(page, 'Projects');
  const english = page.getByRole('region', { name: /^EN/ });
  await expect(english.getByText(/^Each item is a file of its own/)).toBeVisible();
  const before = await page.locator('section[lang="fr"] input[id$="-name"]').count();
  // A project is a file per language: adding one in English adds no French file.
  await english.getByRole('button', { name: 'Add to Projects' }).click();
  await expect(status(page)).toHaveText('New item added to Projects, at position 3, in EN only.');
  expect(await page.locator('section[lang="fr"] input[id$="-name"]').count()).toBe(before);
  await page.locator('#field-en-projects-2-name').fill('Atlas');
  await save(page);
  // Atlas comes first in the folder (files are read by name): the Studio now shows it first too.
  await expect(status(page)).toHaveText(/^Saved: \S*atlas\.en\.md\. Items are now in the order of their files\.$/);
  await expect(page.locator('#field-en-projects-0-name')).toHaveValue('Atlas');
  const library = content('projects/bibliotheque.en.md');
  await page.locator('#field-en-projects-0-name').fill('Atlas map');
  await save(page);
  await expect(status(page)).toHaveText(/^Saved: \S*atlas\.en\.md\.$/);
  expect(content('projects/atlas.en.md')).toContain('name: Atlas map\n');
  expect(content('projects/bibliotheque.en.md')).toBe(library);

  await page.getByRole('button', { name: 'Move or change Atlas map (EN)' }).click();
  expect(await page.getByRole('menuitem').allTextContents()).toEqual(['Duplicate', 'Remove']);
  await page.getByRole('menuitem', { name: 'Remove' }).click();
  await expect(status(page)).toHaveText('Atlas map removed from Projects, in EN only. Undo brings it back.');
  await save(page);
  await expect(status(page)).toHaveText(/^Saved: /);
  expect(() => content('projects/atlas.en.md')).toThrow();
});
