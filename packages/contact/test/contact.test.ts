import { describe, expect, it } from 'vitest';
import { createKernel, InvalidPluginOptionsError, protectEmail, type BuiltSite } from '@vvitrine/core';
import { memorySource, stringTheme } from '@vvitrine/core/testing';
import { contact, web3forms, type ContactSentView, type ContactSettings, type ContactView } from '../src/index.ts';

const KEY = '0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b';
const basics = { name: 'Jane Doe', email: 'jane@example.dev' };

const build = (settings: ContactSettings, options: { siteUrl?: string; data?: Record<string, unknown> } = {}) =>
  createKernel(
    {
      site: { defaultLocale: 'en', locales: ['en', 'fr'] },
      plugins: [
        memorySource({ en: options.data ?? { basics }, fr: options.data ?? { basics } }),
        stringTheme({}, 'Fallback'),
        contact(settings),
      ],
      pages: [{ path: '/', sections: ['contact'] }],
    },
    { root: '/', base: '/demo/', logger: { info: () => {}, warn: () => {} }, ...options },
  ).build();

const view = (site: BuiltSite, key: string) =>
  site.routes.find((r) => r.key === key)!.sections.find((s) => s.id === 'contact')?.view as ContactView | undefined;

describe('@vvitrine/contact', () => {
  it('builds a plain HTML form for Web3Forms, with a honeypot and a page to return to', async () => {
    const site = await build({ provider: web3forms({ accessKey: KEY }) }, { siteUrl: 'https://jane.dev/' });
    const form = view(site, 'fr:/')!.form!;
    expect(form.action).toBe('https://api.web3forms.com/submit');
    expect(form.hidden).toEqual([
      { name: 'access_key', value: KEY },
      { name: 'subject', value: 'Nouveau message sur le site de Jane Doe' },
      { name: 'from_name', value: 'Jane Doe' },
      { name: 'redirect', value: 'https://jane.dev/demo/fr/contact/sent/' },
    ]);
    expect(form.honeypot).toBe('botcheck');
    expect(form.labels).toEqual({ name: 'Nom', email: 'Adresse e-mail', message: 'Message', submit: 'Envoyer' });
    expect(form.privacy).toEqual({
      text: 'Votre message passe par Web3Forms, qui me l’envoie par e-mail. Il sert uniquement à vous répondre.',
      linkLabel: 'Comment Web3Forms traite vos données',
      url: 'https://web3forms.com/dpa',
    });
    expect(view(site, 'en:/')!.email).toEqual({ label: 'Prefer e-mail?', ...protectEmail('jane@example.dev') });
  });

  it('contributes a "message sent" page with its own heading', async () => {
    const site = await build({ provider: web3forms({ accessKey: KEY }) });
    const sent = site.routes.find((r) => r.key === 'en:/contact/sent')!;
    expect(sent.context.heading).toBe('Message sent');
    expect(sent.sections[0]!.view as ContactSentView).toEqual({
      text: 'Thank you! I will answer as soon as I can.',
      backLabel: 'Back to the site',
      backHref: '/demo/',
    });
  });

  it('lets the provider show its own confirmation when the site URL is unknown', async () => {
    const site = await build({ provider: web3forms({ accessKey: KEY }) });
    expect(view(site, 'en:/')!.form!.hidden.map((f) => f.name)).not.toContain('redirect');
  });

  it('shows only the e-mail address without a provider, and nothing without either', async () => {
    const site = await build({});
    expect(view(site, 'en:/')).toEqual({
      title: 'Contact',
      intro: 'A question, an internship, a project? Write to me.',
      email: { label: 'My e-mail address:', ...protectEmail('jane@example.dev') },
    });
    expect(site.routes.some((r) => r.key.endsWith('/contact/sent'))).toBe(false);
    expect(view(await build({}, { data: { basics: { name: 'Jane Doe' } } }), 'en:/')).toBeUndefined();
  });

  it('tells the privacy page what the form sends, to whom and for how long', async () => {
    const site = await build({ provider: web3forms({ accessKey: KEY }) });
    const page = (key: string) => site.routes.find((r) => r.key === key)!.context;
    expect(page('fr:/').dataProcessing()).toEqual([
      {
        service: 'Web3Forms',
        purpose: 'M’envoyer les messages du formulaire de contact, pour que je puisse vous répondre',
        when: 'Seulement quand vous envoyez le formulaire',
        data: [
          'votre nom',
          'votre adresse e-mail',
          'votre message',
          'des données techniques vues par le service (adresse IP, navigateur)',
        ],
        retention: 'Jusqu’à 3 ans',
        location: 'Pays de l’entreprise : Inde',
        cookies: false,
        url: 'https://web3forms.com/dpa',
      },
    ]);
    expect(page('en:/').dataProcessing()[0]).toMatchObject({
      retention: 'Up to 3 years',
      location: 'Company based in India',
    });
    // Without a provider, nothing leaves the site.
    expect((await build({})).routes[0]!.context.dataProcessing()).toEqual([]);
  });

  it('rejects an access key that does not look like one', () => {
    expect(() => web3forms({ accessKey: 'my-key' })).toThrow(InvalidPluginOptionsError);
  });
});
