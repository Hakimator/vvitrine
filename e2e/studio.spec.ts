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

test('adds an item to a list and removes it', async ({ page }) => {
  await open(page, 'Certificates');
  const english = page.getByRole('region', { name: /^EN/ });
  await english.getByRole('button', { name: 'Add to Certificates' }).click();
  await page.locator('#field-en-certificates-1-name').fill('E2E Testing Basics');
  await save(page);
  await expect(status(page)).toHaveText(/^Saved: /);
  expect(content('resume.en.yaml')).toContain('E2E Testing Basics');

  await english.getByRole('button', { name: 'Remove E2E Testing Basics' }).click();
  await save(page);
  await expect(status(page)).toHaveText(/^Saved: /);
  expect(content('resume.en.yaml')).not.toContain('E2E Testing Basics');
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
  // The site itself: hidden on the home page, shown on the resume.
  await page.goto('/en/');
  await expect(page.locator('#awards')).toHaveCount(0);
  await page.goto('/en/resume/');
  await expect(page.locator('#awards')).toHaveCount(1);
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
