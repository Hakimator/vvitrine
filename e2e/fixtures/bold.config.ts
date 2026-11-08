/**
 * E2E fixture: the demo content rendered with the Bold theme.
 * It must NOT import site/vvitrine.config.ts: that file imports the Corporate theme, and Astro
 * ships the CSS of every imported component (spike finding F1). The e2e suite checks for leaks.
 */
import { defineConfig, definePlugin } from '@vvitrine/core';
import { allSections, projects, timeline } from '@vvitrine/sections';
import { seo, sitemap } from '@vvitrine/seo';
import images from '@vvitrine/images';
import markdownSource from '@vvitrine/source-markdown';
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
    markdownSource(),
    markdownSource({ dir: 'content/blog', key: 'posts' }),
    bold(),
    withPhoto,
    ...allSections().filter((section) => section.id !== 'projects'),
    projects({ path: '/projects', tags: true }),
    timeline({ from: ['work', 'education', 'volunteer'] }),
    talks(),
    seo(),
    sitemap(),
    images(),
  ],
  pages: [
    {
      path: '/',
      sections: [
        // The e2e suite only checks the link; the file itself is out of scope here.
        { id: 'hero', options: { cv: '/cv.pdf' } },
        { id: 'stats', nav: false },
        { id: 'projects', nav: false, options: { limit: 6 } },
        { id: 'blog', nav: false, options: { limit: 2 } },
        'work',
        'education',
        { id: 'volunteer', nav: false },
        'skills',
        { id: 'certificates', nav: false },
        { id: 'awards', nav: false },
        'talks',
        'languages',
        { id: 'interests', nav: false },
        { id: 'testimonials', nav: false },
        { id: 'references', nav: false },
      ],
    },
    { path: '/projects', title: 'page.projects', sections: [{ id: 'projects', options: { filter: true } }] },
    { path: '/timeline', title: 'page.timeline', sections: ['timeline'] },
    { path: '/blog', title: 'page.blog', sections: ['blog'] },
  ],
  messages: {
    fr: { 'page.timeline': 'Mon parcours', 'page.blog': 'Blog', 'page.projects': 'Mes projets' },
    en: { 'page.timeline': 'My journey', 'page.blog': 'Blog', 'page.projects': 'My projects' },
  },
});
