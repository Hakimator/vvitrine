/**
 * E2E fixture: the demo content rendered with the Bold theme (chosen in bold.site.yaml).
 * It must NOT import site/vvitrine.config.ts: that file imports the Corporate theme, and Astro
 * ships the CSS of every imported component (spike finding F1). The e2e suite checks for leaks.
 */
import { ga4 } from '@vvitrine/analytics';
import consent from '@vvitrine/consent';
import { contact, web3forms } from '@vvitrine/contact';
import { defineConfig, definePlugin } from '@vvitrine/core';
import { allSections, privacy, projects, timeline } from '@vvitrine/sections';
import { seo, sitemap } from '@vvitrine/seo';
import images from '@vvitrine/images';
import markdownSource from '@vvitrine/source-markdown';
import yamlSource from '@vvitrine/source-yaml';
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
    // The theme (Bold, with its light/dark switch) is chosen in bold.site.yaml.
    withPhoto,
    ...allSections().filter((section) => section.id !== 'projects'),
    projects({ path: '/projects', tags: true }),
    timeline({ from: ['work', 'education', 'volunteer'] }),
    talks(),
    // A made-up key: the e2e suite checks the form, it never sends it.
    privacy({
      host: {
        name: 'GitHub Pages',
        url: 'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement',
      },
    }),
    contact({ provider: web3forms({ accessKey: '0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b' }) }),
    seo(),
    sitemap(),
    // A made-up ID: the e2e suite checks that nothing reaches Google before consent, and stubs the requests after.
    ga4({ measurementId: 'G-E2ETEST01' }),
    consent(),
    images(),
  ],
  pages: [
    {
      path: '/',
      sections: [
        // The e2e suite only checks the link; the file itself is out of scope here.
        { id: 'hero', options: { cv: '/cv.pdf', contact: '#contact' } },
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
        { id: 'contact', nav: false },
      ],
    },
    { path: '/projects', title: 'page.projects', sections: [{ id: 'projects', options: { filter: true } }] },
    // The resume: what a printed CV holds, from the same data. It prints on A4.
    {
      path: '/resume',
      title: 'page.resume',
      footer: true,
      sections: [
        { id: 'hero', options: { cv: '/cv.pdf' } },
        'work',
        'education',
        'skills',
        'certificates',
        'languages',
        'interests',
      ],
    },
    { path: '/timeline', title: 'page.timeline', sections: ['timeline'] },
    { path: '/blog', title: 'page.blog', sections: ['blog'] },
    // footer: true links the page from the footer of every page instead of the header.
    { path: '/privacy', title: 'page.privacy', footer: true, sections: ['privacy'] },
  ],
  messages: {
    fr: {
      'page.timeline': 'Mon parcours',
      'page.blog': 'Blog',
      'page.projects': 'Mes projets',
      'page.privacy': 'Confidentialité',
      'page.resume': 'CV',
    },
    en: {
      'page.timeline': 'My journey',
      'page.blog': 'Blog',
      'page.projects': 'My projects',
      'page.privacy': 'Privacy',
      'page.resume': 'Resume',
    },
  },
});
