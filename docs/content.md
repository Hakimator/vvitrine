# Writing content

Content is a YAML (or JSON) document per language, read by the `@vvitrine/source-yaml` plugin:

- `content/resume.<locale>.yaml` is used for that locale (e.g. `resume.en.yaml`);
- otherwise `content/resume.yaml` is used.

The format follows [JSON Resume](https://jsonresume.org/schema), so you can reuse an existing `resume.json`.
Fields specific to VVitrine live under `x-vvitrine` and do not break JSON Resume tools.

## Who validates what

The core validates `basics` (your identity). **Every other key is validated by the plugin that owns it**: `work` by the
work section, `projects` by the projects section, `talks` by your own talks plugin, and so on. Unused keys produce a
warning, never a silent error.

## Keys provided by the built-in sections

| Key            | Section        | Main fields                                                                                                                                                    |
| -------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `basics`       | core / `hero`  | `name` (required), `label`, `image`, `email`, `summary`, `location { city, region, countryCode }`, `profiles [{ network, url }]`, `x-vvitrine.availability`    |
| `work`         | `work`         | `name`, `position`, `startDate`, `endDate` (omit = ongoing), `location`, `url`, `summary`, `highlights`                                                        |
| `education`    | `education`    | `institution`, `studyType`, `area`, `startDate`, `endDate`, `score`, `courses`                                                                                 |
| `volunteer`    | `volunteer`    | `organization`, `position`, `url`, `startDate`, `endDate`, `summary`, `highlights`                                                                             |
| `awards`       | `awards`       | `title`, `date`, `awarder`, `summary`                                                                                                                          |
| `certificates` | `certificates` | `name`, `date`, `issuer`, `url`                                                                                                                                |
| `publications` | `publications` | `name`, `publisher`, `releaseDate`, `url`, `summary`                                                                                                           |
| `skills`       | `skills`       | `name`, `level`, `keywords`                                                                                                                                    |
| `languages`    | `languages`    | `language`, `fluency`                                                                                                                                          |
| `interests`    | `interests`    | `name`, `keywords`                                                                                                                                             |
| `references`   | `references`   | `name`, `reference` (the quotation), `x-vvitrine.role` (e.g. "Team lead at Acme")                                                                              |
| `projects`     | `projects`     | `name`, `description`, `highlights`, `keywords`, `roles`, `startDate`, `endDate`, `url`, `x-vvitrine { slug, repository, featured, image { src, alt }, body }` |

Dates are `YYYY`, `YYYY-MM` or `YYYY-MM-DD`. They are displayed in the reader's language (`juin 2025`, `Jun 2025`).

Each project gets its own page at `/projects/<slug>/` (the slug comes from the name unless you set
`x-vvitrine.slug`). Images need an `alt` text: the build refuses an image without one (accessibility).

Image and file paths such as `basics.image: /photo.jpg` point to files in `site/public/`; the deployment base path is
added for you. Full URLs (`https://...`) work too. Without `basics.image`, themes show your initials.

With the `@vvitrine/images` plugin (enabled in the starter), local JPEG, PNG, WebP and AVIF images are served as WebP at
480, 960 and 1440 px wide, never wider than your file, with their real size so pages do not jump while loading. Put the
largest version you have in `public/`: the plugin makes the smaller ones. Images from full URLs are used as they are.

### Portfolio extras (not part of JSON Resume)

| Key            | Section        | Main fields                                                                                              |
| -------------- | -------------- | -------------------------------------------------------------------------------------------------------- |
| `stats`        | `stats`        | `value` (text or number, e.g. `12`, `3+`, `40 %`), `label`                                               |
| `testimonials` | `testimonials` | `quote`, `author`, `role`                                                                                |
| `timeline`     | `timeline`     | your own milestones: `title`, `date`, `endDate`, `summary`, `url` (work, education... are added for you) |
| `posts`        | `blog`         | `title`, `date`, `summary`, `tags`, `draft` (see [Blog](#blog))                                          |

Every top-level JSON Resume section has a built-in section. Dated lists are shown most recent first.

## Projects as Markdown files

A project page can hold a full case study. Write it in `x-vvitrine.body` (Markdown), or, easier, give each project its
own file with `@vvitrine/source-markdown`:

```ts
plugins: [yamlSource(), markdownSource({ dir: 'content/projects' }), /* ... */],
```

```markdown
---
name: Library manager
description: Book lending web app for a non-profit.
startDate: 2025-10
keywords: [TypeScript, Astro]
x-vvitrine: { featured: true }
---

# The problem

Text, lists, `code`, tables and images: ![Screenshot of the app](/images/library.png)
```

- One file per project: `content/projects/<slug>.md`, or one per language: `<slug>.fr.md`, `<slug>.en.md` (a language
  file wins over the shared one). The file name is the page address: `/projects/<slug>/`.
- The front matter holds the same fields as a `projects` entry; the text below it is the write-up.
- When this source is used, it provides the whole `projects` list: remove `projects` from your YAML file.
- `#` headings become sub-headings of the project page, local images and links get the base path, and every image needs
  an alt text (the build says which one is missing).

## Blog

The `blog` section lists your articles and gives each one its own page. Write one Markdown file per article, read by a
second `@vvitrine/source-markdown`:

```ts
plugins: [
  markdownSource({ dir: 'content/blog', key: 'posts' }),
  blog({ path: '/blog' }),
  /* ... */
],
pages: [
  { path: '/', sections: ['hero', { id: 'blog', nav: false, options: { limit: 2 } }, /* ... */] },
  { path: '/blog', title: 'page.blog', sections: ['blog'] },
],
```

```markdown
---
title: Building a plugin-based portfolio
date: 2026-11-07
summary: Why every part of this site is a plugin.
tags: [Architecture, Astro]
---

# Why everything is a plugin

...
```

- Articles live at `<path>/<slug>/`, e.g. `/blog/plugin-portfolio/`; the slug is the file name (or `x-vvitrine.slug`).
- The newest article comes first. `draft: true` keeps an article out of the build.
- Each page shows the date, an estimated reading time and, from three `#` headings on, a table of contents.
- The same rules as project write-ups apply: headings become sub-headings, every image needs an alt text.

## Privacy

Only publish what you want public. References quote other people: ask them before publishing their name and words. No field is required except `basics.name`. There is no phone field in the built-in
sections on purpose.
