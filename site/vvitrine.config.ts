/**
 * Your portfolio configuration: the only file you need to change (with content/).
 * Everything is a plugin: add, remove or replace any line in `plugins`.
 */
import { defineConfig } from '@vvitrine/core';
import {
  awards,
  certificates,
  education,
  hero,
  interests,
  languages,
  projects,
  references,
  skills,
  volunteer,
  work,
} from '@vvitrine/sections';
import { seo, sitemap } from '@vvitrine/seo';
import yamlSource from '@vvitrine/source-yaml';
import corporate from '@vvitrine/theme-corporate';
import talks from './plugins/talks.ts';

export default defineConfig({
  site: { defaultLocale: 'fr', locales: ['fr', 'en'] },

  plugins: [
    // Where content comes from: content/resume.fr.yaml, content/resume.en.yaml
    yamlSource({ dir: 'content', file: 'resume' }),
    // Exactly one theme. Override any design token here.
    corporate({ tokens: { light: { colorPrimary: '#1f3a5f' } } }),
    // Sections you can place on pages
    hero(),
    projects(),
    work(),
    education(),
    volunteer(),
    skills(),
    certificates(),
    awards(),
    languages(),
    interests(),
    references(),
    talks(), // a local plugin (see plugins/talks.ts)
    // Services and generators
    seo(),
    sitemap(),
  ],

  // Pages and the order of their sections. Remove this block to show every section on one page.
  pages: [
    {
      path: '/',
      sections: [
        'hero',
        { id: 'projects', options: { limit: 6 } },
        'work',
        'education',
        // nav: false keeps a section out of the header menu (it stays on the page).
        { id: 'volunteer', nav: false },
        'skills',
        { id: 'certificates', nav: false },
        { id: 'awards', nav: false },
        'talks',
        'languages',
        { id: 'interests', nav: false },
        { id: 'references', nav: false },
      ],
    },
  ],

  // Override any text, in any language.
  messages: {
    en: { 'section.work.title': 'Experience' },
  },
});
