/**
 * E2E fixture: the demo content rendered with the Bold theme.
 * It must NOT import site/vvitrine.config.ts: that file imports the Corporate theme, and Astro
 * ships the CSS of every imported component (spike finding F1). The e2e suite checks for leaks.
 */
import { defineConfig, definePlugin } from '@vvitrine/core';
import { education, hero, languages, projects, skills, work } from '@vvitrine/sections';
import { seo, sitemap } from '@vvitrine/seo';
import yamlSource from '@vvitrine/source-yaml';
import bold from '@vvitrine/theme-bold';
import talks from '../../site/plugins/talks.ts';

/** The demo has no photo (corporate shows initials); this build adds one to cover both cases. */
const withPhoto = definePlugin({
  name: 'e2e-photo',
  kind: 'service',
  apiVersion: 1,
  hooks: {
    contentLoaded(raw) {
      (raw.basics as Record<string, unknown>).image = '/favicon.svg';
    },
  },
});

export default defineConfig({
  site: { defaultLocale: 'fr', locales: ['fr', 'en'] },
  plugins: [
    yamlSource(),
    bold(),
    withPhoto,
    hero(),
    projects(),
    work(),
    education(),
    skills(),
    languages(),
    talks(),
    seo(),
    sitemap(),
  ],
  pages: [
    {
      path: '/',
      sections: [
        // The e2e suite only checks the link; the file itself is out of scope here.
        { id: 'hero', options: { cv: '/cv.pdf' } },
        { id: 'projects', options: { limit: 6 } },
        'work',
        'education',
        'skills',
        'talks',
        'languages',
      ],
    },
  ],
});
