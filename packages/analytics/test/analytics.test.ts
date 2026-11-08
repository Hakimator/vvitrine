import { describe, expect, it } from 'vitest';
import {
  createKernel,
  InvalidPluginOptionsError,
  MissingCapabilityError,
  renderHeadTags,
  type Plugin,
} from '@vvitrine/core';
import { memorySource, stringTheme } from '@vvitrine/core/testing';
import { COOKIE_SECONDS, ga4 } from '../src/index.ts';

const consentProvider: Plugin = { name: 'consent', kind: 'service', apiVersion: 1, provides: ['consent'] };
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

describe('@vvitrine/analytics ga4', () => {
  it('adds one inline script that waits for consent, and no request to Google in the page', async () => {
    const site = await build([consentProvider, ga4({ measurementId: 'G-TEST1234' })]);
    const head = renderHeadTags(site.routes[0]!.head);
    expect(head.match(/<script>/g)).toHaveLength(1);
    expect(head).toContain('addEventListener("vvitrine:consent"');
    expect(head).toContain('("G-TEST1234", 33696000)');
    // gtag.js is only referenced inside the script, never as a <script src>.
    expect(head).not.toMatch(/<script[^>]+src=/);
    expect(head).toContain('allow_google_signals: false');
  });

  it('declares a cookie-setting service for the privacy page and the banner', async () => {
    const site = await build([consentProvider, ga4({ measurementId: 'G-TEST1234' })]);
    const fr = site.routes.find((r) => r.key === 'fr:/')!.context.dataProcessing();
    expect(fr).toEqual([
      expect.objectContaining({
        service: 'Google Analytics',
        when: 'Seulement si vous acceptez dans le bandeau des cookies',
        cookies: true,
        url: 'https://support.google.com/analytics/answer/12017362',
      }),
    ]);
    expect(fr[0]!.data).toHaveLength(4);
  });

  it('keeps its cookie below the 13 months the CNIL recommends', () => {
    expect(COOKIE_SECONDS).toBeLessThan(13 * 30.4 * 24 * 60 * 60);
  });

  it('needs a consent plugin and a valid measurement ID', () => {
    expect(() => build([ga4({ measurementId: 'G-TEST1234' })])).toThrow(MissingCapabilityError);
    expect(() => ga4({ measurementId: 'UA-1234-1' })).toThrow(InvalidPluginOptionsError);
  });
});
