import { describe, expect, it, vi } from 'vitest';
import { createKernel, defineSection, TOKEN_NAMES, type EntriesView } from '@vvitrine/core';
import { memorySource } from '@vvitrine/core/testing';

// Astro compiles the components when the site is built (see the e2e "minimal" project); here they are stand-ins.
vi.mock('../components/Layout.astro', () => ({ default: 'Layout' }));
vi.mock('../components/Entries.astro', () => ({ default: 'Entries' }));
vi.mock('../components/Tags.astro', () => ({ default: 'Tags' }));
vi.mock('../components/Fallback.astro', () => ({ default: 'Fallback' }));
const { default: minimal, defaults } = await import('../index.ts');

/** WCAG 2.2 relative luminance and contrast ratio of two #rrggbb colours. */
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

describe('example theme-minimal', () => {
  it('sets every design token, and keeps text readable in light and dark', () => {
    expect(Object.keys(defaults.light).sort()).toEqual([...TOKEN_NAMES].sort());
    for (const mode of [defaults.light, { ...defaults.light, ...defaults.dark }]) {
      for (const [fg, bg] of [
        [mode.colorText, mode.colorBackground],
        [mode.colorMuted, mode.colorBackground],
        [mode.colorPrimary, mode.colorBackground],
        [mode.colorOnPrimary, mode.colorPrimary],
      ]) {
        expect(contrast(fg!, bg!), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('draws shared view kinds with its components and anything else with its fallback', async () => {
    const work = defineSection({
      name: 'work',
      kind: 'section',
      apiVersion: 1,
      id: 'work',
      viewKind: 'entries',
      present: (): EntriesView => ({ title: 'Work', items: [] }),
    });
    const hello = defineSection({ name: 'hello', kind: 'section', apiVersion: 1, id: 'hello', present: () => ({}) });
    const site = await createKernel(
      {
        site: { defaultLocale: 'en', locales: ['en'] },
        plugins: [memorySource({ en: { basics: { name: 'Jane' } } }), minimal(), work, hello],
        pages: [{ path: '/', sections: ['work', 'hello'] }],
      },
      { root: '/', logger: { info: () => {}, warn: () => {} } },
    ).build();
    expect(site.theme.layout).toBe('Layout');
    expect(site.routes[0]!.sections.map((s) => s.component)).toEqual(['Entries', 'Fallback']);
  });

  it('lets the user change its tokens', () => {
    expect(minimal({ tokens: { light: { colorPrimary: '#003366' } } }).tokens.light.colorPrimary).toBe('#003366');
  });
});
