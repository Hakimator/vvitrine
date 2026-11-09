import { describe, expect, it } from 'vitest';
import { createKernel, InvalidPluginOptionsError, renderHeadTags, type Plugin } from '@vvitrine/core';
import { memorySource, stringTheme } from '@vvitrine/core/testing';
import plausible from '../src/index.ts';

const build = (plugins: Plugin[]) =>
  createKernel(
    {
      site: { defaultLocale: 'en', locales: ['en', 'fr'] },
      plugins: [
        memorySource({ en: { basics: { name: 'Jane' } }, fr: { basics: { name: 'Jane' } } }),
        stringTheme(),
        ...plugins,
      ],
      pages: [{ path: '/', sections: [] }],
    },
    { root: '/', logger: { info: () => {}, warn: () => {} } },
  ).build();

describe('example service-plausible', () => {
  it('adds the Plausible script to every page', async () => {
    const site = await build([plausible({ domain: 'jane.github.io' })]);
    expect(renderHeadTags(site.routes[0]!.head)).toBe(
      '<script defer data-domain="jane.github.io" src="https://plausible.io/js/script.js"></script>',
    );
    const own = await build([plausible({ domain: 'jane.dev', src: 'https://stats.jane.dev/js/script.js' })]);
    expect(renderHeadTags(own.routes[0]!.head)).toContain('src="https://stats.jane.dev/js/script.js"');
  });

  it('is listed on the privacy page, as a service without cookies', async () => {
    const site = await build([plausible({ domain: 'jane.github.io' })]);
    const fr = site.routes.find((r) => r.locale === 'fr')!.context.dataProcessing();
    expect(fr).toEqual([
      expect.objectContaining({ service: 'Plausible Analytics', when: 'À chaque page vue', cookies: false }),
    ]);
    expect(fr[0]!.data).toHaveLength(3);
  });

  it('needs no consent plugin, and rejects invalid options', async () => {
    // A cookie-setting service would require `consent`; this one builds alone.
    await expect(build([plausible({ domain: 'jane.github.io' })])).resolves.toBeDefined();
    expect(() => plausible({ domain: 'not a domain' })).toThrow(InvalidPluginOptionsError);
    expect(() => plausible({ domain: 'jane.dev', src: 'http://insecure.example/script.js' })).toThrow(
      InvalidPluginOptionsError,
    );
  });
});
