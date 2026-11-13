/**
 * Your portfolio configuration: the plugins your site uses (with site.yaml and content/).
 * Everything is a plugin: add, remove or replace any line in `plugins`.
 */
import { ga4 } from '@vvitrine/analytics';
import ogImage from '@vvitrine/og-image';
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
import studio from '@vvitrine/studio';
import yamlSource from '@vvitrine/source-yaml';
import talks from './plugins/talks.ts';

const accessKey = process.env.WEB3FORMS_ACCESS_KEY;
const measurementId = process.env.GA_MEASUREMENT_ID;
const GITHUB_PAGES = {
  name: 'GitHub Pages',
  url: 'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement',
};

// Languages, pages, texts and colours live in site.yaml, next to this file: plain data that you (or the Studio) can
// edit without touching code. This file installs the plugins.
export default defineConfig({
  plugins: [
    // Where content comes from: content/resume.fr.yaml, content/resume.en.yaml
    yamlSource({ dir: 'content', file: 'resume' }),
    // One Markdown file per project in content/projects/ (front matter + write-up). Replaces "projects" from YAML.
    markdownSource({ dir: 'content/projects' }),
    // One Markdown file per article in content/blog/ (a second instance, for the "posts" key).
    markdownSource({ dir: 'content/blog', key: 'posts' }),
    // The theme is chosen in site.yaml (theme.use), with its colours and fonts.
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
    // The picture shown when a page is shared, drawn by og-image below (needs SITE_URL, set by the deploy workflow).
    seo({ image: '/og-{locale}.png' }),
    ogImage({ background: '#1f3a5f' }),
    sitemap(),
    // A PDF of the /resume page in each language (cv-fr.pdf, cv-en.pdf), linked from the hero.
    resumePdf({ page: '/resume', accent: '#1f3a5f' }),
    // Google Analytics, only after the visitor accepts: set GA_MEASUREMENT_ID (e.g. G-ABC123DEF4) when you build.
    // The consent banner appears only when a plugin sets cookies, so it stays out of the way without analytics.
    ...(measurementId ? [ga4({ measurementId })] : []),
    consent(),
    // Responsive WebP variants and real sizes for the images in public/.
    images(),
    // The Studio: edit this site from `pnpm dev` at http://localhost:4321/__vvitrine/studio/. Never in the built site.
    studio(),
  ],
});
