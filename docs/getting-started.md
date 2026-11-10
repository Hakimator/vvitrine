# Getting started

## 1. Get your copy

Click **Use this template** on the GitHub repository page, or clone it. You need [Node.js 22+](https://nodejs.org) and
pnpm (`npm install -g pnpm`).

```bash
pnpm install
pnpm dev
```

Open http://localhost:4321. The page reloads when you save a content file or `site/site.yaml`.

## 2. Put in your content

Edit `site/content/resume.fr.yaml` and `site/content/resume.en.yaml` (see [Writing content](content.md)).
Only want one language? Set `site: { defaultLocale: en, locales: [en] }` in `site/site.yaml` and keep a single
`resume.yaml`.

If something is wrong, the build stops and tells you the file, the field and how to fix it:

```
Invalid content for locale "en" (1 problem):
  - content/resume.en.yaml > work[0].startDate: expected a date as YYYY, YYYY-MM or YYYY-MM-DD
      hint: example: 2024-09
```

## 3. Choose your sections and theme

In `site/site.yaml` (plain data):

- `pages` places sections on pages, in order, with options (`{ id: projects, options: { limit: 6 } }`).
- `messages` overrides any text (`en: { section.work.title: Career }`).
- `theme.tokens` changes colours and fonts.

In `site/vvitrine.config.ts`, `plugins` lists everything the site can use: the source, **one** theme, the sections,
services and generators.

See [Configuration](configuration.md).

## 4. Publish

Push to `main`, then once: **Settings > Pages > Source: GitHub Actions**. The workflow in
`.github/workflows/deploy.yml` builds and publishes the site. Other hosts: [Deployment](deployment.md).

## Useful commands

| Command      | What it does                      |
| ------------ | --------------------------------- |
| `pnpm dev`   | Local site with live reload       |
| `pnpm build` | Static site in `site/dist/`       |
| `pnpm check` | Every quality gate (what CI runs) |
