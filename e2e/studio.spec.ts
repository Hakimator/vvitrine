import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * The local Studio (US-134), in `astro dev` (e2e/studio-server.mjs), on a copy of the demo content: every test saves
 * real files there. The tests run in order, each from the files the previous one left.
 */
test.describe.configure({ mode: 'serial' });

/** The copy the server reads (the same folder as e2e/studio-server.mjs). */
const content = (file: string) => readFileSync(join(tmpdir(), 'vvitrine-studio-e2e', file), 'utf8');

async function open(page: Page, key?: string) {
  await page.goto('/__vvitrine/studio/');
  const nav = page.getByRole('navigation', { name: 'Content' });
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
