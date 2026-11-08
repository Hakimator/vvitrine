/**
 * Analytics adapters. Each one is a service plugin that declares what it collects (for the privacy page), requires the
 * `consent` capability when it sets cookies, and waits for the `vvitrine:consent` browser event before loading.
 */
export { ga4, COOKIE_SECONDS, type Ga4Options } from './ga4.ts';
