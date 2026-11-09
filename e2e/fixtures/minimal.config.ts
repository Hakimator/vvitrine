/**
 * E2E fixture: the demo content with the example theme (examples/plugins/theme-minimal) and the example section, to
 * check that the examples work in a real build, as an adopter would use them (imported from their folder).
 */
import { defineConfig } from '@vvitrine/core';
import { allSections, timeline } from '@vvitrine/sections';
import markdownSource from '@vvitrine/source-markdown';
import yamlSource from '@vvitrine/source-yaml';
import now from '../../examples/plugins/section-now/src/index.ts';
import minimal from '../../examples/plugins/theme-minimal/index.ts';
import talks from '../../site/plugins/talks.ts';

export default defineConfig({
  site: { defaultLocale: 'fr', locales: ['fr', 'en'] },
  plugins: [
    yamlSource(),
    markdownSource(),
    markdownSource({ dir: 'content/blog', key: 'posts' }),
    minimal(),
    ...allSections(),
    timeline({ from: ['work', 'education', 'volunteer'] }),
    talks(),
    now(),
    {
      // The demo content has no "now" list: this one is added for the example section.
      name: 'e2e-now',
      kind: 'service',
      apiVersion: 1,
      hooks: {
        contentLoaded(raw) {
          raw.now = { updated: '2026-11', items: [{ text: 'Looking for an internship' }] };
        },
      },
    },
  ],
  pages: [
    {
      path: '/',
      sections: ['hero', 'now', 'work', 'education', 'skills', 'languages', 'projects', 'talks'],
    },
    { path: '/timeline', title: 'page.timeline', sections: ['timeline'] },
  ],
  messages: {
    fr: { 'page.timeline': 'Mon parcours' },
    en: { 'page.timeline': 'My journey' },
  },
});
