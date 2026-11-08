/**
 * Consent banner (ADR-006): shown only when a plugin in use declares a service that sets cookies (see
 * `BasePlugin.privacy`), with equal Accept and Refuse buttons, and a "Manage cookies" link in the footer. Services
 * listen to the `vvitrine:consent` browser event (see consent.browser.ts) and load nothing before consent.
 */
import Banner from './Banner.astro';
import { consentPlugin, type ConsentSettings } from './plugin.ts';

export type { ConsentBannerProps, ConsentSettings } from './plugin.ts';

export default function consent(settings: ConsentSettings = {}) {
  return consentPlugin(Banner, settings);
}
