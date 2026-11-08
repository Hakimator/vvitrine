import { describe, expect, it } from 'vitest';
import { createKernel, definePlugin, MissingCapabilityError, type BuiltSite } from '@vvitrine/core';
import { memorySource, stringTheme } from '@vvitrine/core/testing';
import { consentPlugin, type ConsentBannerProps } from '../src/plugin.ts';
import { consentScript } from '../src/consent.browser.ts';

const tracker = (cookies: boolean, extra: object = {}) =>
  definePlugin({
    name: `tracker-${cookies}`,
    kind: 'service',
    apiVersion: 1,
    privacy: () => [{ service: 'Stats', purpose: '', when: '', data: [], cookies, url: 'https://stats.example' }],
    ...extra,
  });

const build = (plugins: object[], footer = true) =>
  createKernel(
    {
      site: { defaultLocale: 'en', locales: ['en', 'fr'] },
      plugins: [
        memorySource({ en: { basics: { name: 'Jane' } }, fr: { basics: { name: 'Jane' } } }),
        stringTheme({}, 'Any'),
        ...(plugins as never[]),
      ],
      pages: [
        { path: '/', sections: [] },
        { path: '/privacy', title: 'Privacy', footer, sections: [] },
      ],
    },
    { root: '/', logger: { info: () => {}, warn: () => {} } },
  ).build();

const route = (site: BuiltSite, key: string) => site.routes.find((r) => r.key === key)!;

describe('@vvitrine/consent', () => {
  it('shows a banner and a "Manage cookies" link when a service sets cookies', async () => {
    const site = await build([consentPlugin('Banner'), tracker(true)]);
    const fr = route(site, 'fr:/');
    expect(fr.bodyEnd).toHaveLength(1);
    expect(fr.bodyEnd[0]!.component).toBe('Banner');
    const props = fr.bodyEnd[0]!.props as unknown as ConsentBannerProps;
    expect(props).toMatchObject({
      id: 'vvitrine-consent',
      title: 'Cookies et statistiques',
      accept: 'Accepter',
      refuse: 'Refuser',
      privacy: { label: 'En savoir plus', href: '/fr/privacy/' },
      script: consentScript,
    });
    expect(props.text).toContain('utiliser Stats, qui dépose des cookies');
    expect(fr.context.nav.footer).toEqual([
      { id: '/privacy', label: 'Privacy', href: '/fr/privacy/' },
      { id: 'consent', label: 'Gérer les cookies', href: '#vvitrine-consent' },
    ]);
  });

  it('stays out of the way when no service sets cookies', async () => {
    const site = await build([consentPlugin('Banner'), tracker(false)]);
    expect(route(site, 'en:/').bodyEnd).toEqual([]);
    expect(route(site, 'en:/').context.nav.footer.map((l) => l.id)).toEqual(['/privacy']);
  });

  it('links to the privacy page only when it is in the footer', async () => {
    const site = await build([consentPlugin('Banner', { privacyPage: '/legal' }), tracker(true)]);
    expect((route(site, 'en:/').bodyEnd[0]!.props as unknown as ConsentBannerProps).privacy).toBeUndefined();
  });

  it('is required by services that need consent', async () => {
    const needy = tracker(true, { requires: ['consent'] });
    // Checked when the plugins are registered, before anything is built.
    expect(() => build([needy])).toThrow(MissingCapabilityError);
    await expect(build([needy, consentPlugin('Banner')])).resolves.toBeDefined();
  });

  it('ships one self-contained inline script that remembers the choice for 6 months', () => {
    expect(consentScript).toMatch(/^\(function vvitrineConsent\(script\) \{[\s\S]*\}\)\(document\.currentScript\);$/);
    expect(consentScript).not.toMatch(/\bimport\b|\brequire\(/);
    expect(consentScript).toContain('182 * 24 * 60 * 60 * 1e3');
  });
});
