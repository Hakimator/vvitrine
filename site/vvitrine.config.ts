/**
 * Your portfolio configuration: the only file you need to change (with content/).
 * Everything is a plugin: add, remove or replace any line in `plugins`.
 */
import { ga4 } from '@vvitrine/analytics';
import resumePdf from '@vvitrine/resume-pdf';
import consent from '@vvitrine/consent';
import { contact, web3forms } from '@vvitrine/contact';
import { defineConfig } from '@vvitrine/core';
import {
  awards,
  blog,
  certificates,
  education,
  hero,
  interests,
  languages,
  privacy,
  projects,
  references,
  skills,
  stats,
  testimonials,
  timeline,
  volunteer,
  work,
} from '@vvitrine/sections';
import { seo, sitemap } from '@vvitrine/seo';
import images from '@vvitrine/images';
import markdownSource from '@vvitrine/source-markdown';
import yamlSource from '@vvitrine/source-yaml';
import corporate from '@vvitrine/theme-corporate';
import talks from './plugins/talks.ts';

const accessKey = process.env.WEB3FORMS_ACCESS_KEY;
const measurementId = process.env.GA_MEASUREMENT_ID;
const GITHUB_PAGES = {
  name: 'GitHub Pages',
  url: 'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement',
};

export default defineConfig({
  site: { defaultLocale: 'fr', locales: ['fr', 'en'] },

  plugins: [
    // Where content comes from: content/resume.fr.yaml, content/resume.en.yaml
    yamlSource({ dir: 'content', file: 'resume' }),
    // One Markdown file per project in content/projects/ (front matter + write-up). Replaces "projects" from YAML.
    markdownSource({ dir: 'content/projects' }),
    // One Markdown file per article in content/blog/ (a second instance, for the "posts" key).
    markdownSource({ dir: 'content/blog', key: 'posts' }),
    // Exactly one theme. Override any design token here.
    corporate({ tokens: { light: { colorPrimary: '#1f3a5f' } } }),
    // Sections you can place on pages
    hero(),
    stats(),
    // tags: one page per technology, for the filter on the /projects page.
    projects({ path: '/projects', tags: true }),
    work(),
    education(),
    volunteer(),
    skills(),
    certificates(),
    awards(),
    languages(),
    interests(),
    testimonials(),
    references(),
    // One chronological list built from work, education and volunteer, plus its own milestones.
    timeline({ from: ['work', 'education', 'volunteer'] }),
    // Articles live under /blog: place the blog section on that page.
    blog({ path: '/blog' }),
    talks(), // a local plugin (see plugins/talks.ts)
    // Contact form: get a free access key at https://web3forms.com and set WEB3FORMS_ACCESS_KEY when you build.
    // Without a key, the section shows your e-mail address only.
    contact({ provider: accessKey ? web3forms({ accessKey }) : undefined }),
    // Privacy page, generated from what the plugins above declare. Name your host: it sees every visit.
    privacy({ host: GITHUB_PAGES }),
    // Services and generators
    seo(),
    sitemap(),
    // A PDF of the /resume page in each language (cv-fr.pdf, cv-en.pdf), linked from the hero.
    resumePdf({ page: '/resume', accent: '#1f3a5f' }),
    // Google Analytics, only after the visitor accepts: set GA_MEASUREMENT_ID (e.g. G-ABC123DEF4) when you build.
    // The consent banner appears only when a plugin sets cookies, so it stays out of the way without analytics.
    ...(measurementId ? [ga4({ measurementId })] : []),
    consent(),
    // Responsive WebP variants and real sizes for the images in public/.
    images(),
  ],

  // Pages and the order of their sections. Remove this block to show every section on one page.
  pages: [
    {
      path: '/',
      sections: [
        // The "Contact me" button leads to the contact section below (by default it opens an e-mail).
        { id: 'hero', options: { cv: '/cv-{locale}.pdf', contact: '#contact' } },
        { id: 'stats', nav: false },
        // The latest projects; the header links to the /projects page, which has the technology filter.
        { id: 'projects', nav: false, options: { limit: 6 } },
        // The two latest articles; the header links to the /blog page instead.
        { id: 'blog', nav: false, options: { limit: 2 } },
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
        { id: 'testimonials', nav: false },
        { id: 'references', nav: false },
        { id: 'contact', nav: false },
      ],
    },
    { path: '/projects', title: 'page.projects', sections: [{ id: 'projects', options: { filter: true } }] },
    // A second page: its sections get header links too (here /timeline/#timeline).
    // The resume: what a printed CV holds, from the same data. It prints on A4, and resume-pdf turns it into a PDF.
    {
      path: '/resume',
      title: 'page.resume',
      footer: true,
      sections: [
        { id: 'hero', options: { cv: '/cv-{locale}.pdf' } },
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

  // Override any text, or add your own (here the title of the /timeline page), in any language.
  messages: {
    fr: {
      'page.timeline': 'Mon parcours',
      'page.blog': 'Blog',
      'page.projects': 'Mes projets',
      'page.privacy': 'Confidentialité',
      'page.resume': 'CV',
    },
    en: {
      'section.work.title': 'Experience',
      'page.timeline': 'My journey',
      'page.blog': 'Blog',
      'page.projects': 'My projects',
      'page.privacy': 'Privacy',
      'page.resume': 'Resume',
    },
  },
});
