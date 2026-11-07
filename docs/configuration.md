# Configuration reference (`site/vvitrine.config.ts`)

```ts
import { defineConfig } from '@vvitrine/core';

export default defineConfig({
  site: { defaultLocale: 'fr', locales: ['fr', 'en'], favicon: '/favicon.svg' },
  plugins: [/* source, exactly one theme, sections, services, generators */],
  pages: [
    { path: '/', title: 'optional title or message key', sections: ['hero', { id: 'work', options: { limit: 3 } }] },
  ],
  messages: { en: { 'section.work.title': 'Career' } },
});
```

| Field                | Default                          | Description                                                                    |
| -------------------- | -------------------------------- | ------------------------------------------------------------------------------ |
| `site.defaultLocale` | `'en'`                           | Language served at `/`. Other languages are served at `/<locale>/`.            |
| `site.locales`       | `[defaultLocale]`                | Must include `defaultLocale`.                                                  |
| `site.favicon`       | `'/favicon.svg'`                 | File in `public/`, or `false`.                                                 |
| `plugins`            | (required)                       | Plugin instances. Call the factories: `corporate()`, not `corporate`.          |
| `pages`              | one home page with every section | Each page: `path` (`/` or `/cv`), optional `title`, ordered `sections`.        |
| `pages[].sections[]` |                                  | A section id, or `{ id, options, nav }`. Options are validated by the section. |
| `messages`           |                                  | Overrides of any UI string, per locale.                                        |

## Navigation

The header links are generated from your pages: every placed section that has a title gets a link, in page and section
order (the hero has no title, so it gets none). Links on other pages lead back to the right page and section. To hide a
section from the header, set `nav: false`:

```ts
sections: ['hero', 'projects', { id: 'languages', nav: false }],
```

## Rules checked at build time

- exactly one theme plugin;
- unique plugin names and section ids;
- one owner per content key;
- every `requires` capability is provided by some plugin (e.g. an analytics plugin that requires `consent`);
- unique page paths per locale;
- valid options for every placed section.

Every rule fails the build with a message that names the problem and how to fix it.

## Built-in section options

| Section                                                                                  | Options                                      |
| ---------------------------------------------------------------------------------------- | -------------------------------------------- |
| `work`, `education`, `volunteer`, `awards`, `certificates`, `publications`, `references` | `title?: string`, `limit?: number`           |
| `projects`                                                                               | `title?`, `limit?`, `featuredOnly?: boolean` |
| `skills`, `languages`, `interests`                                                       | `title?`                                     |
| `hero`                                                                                   | `cv?: string`, `contact?: string`            |

`hero` options: `cv` is a file in `public/` (e.g. `'/cv.pdf'`) or a full URL; it adds a "Download CV (PDF)" button.
`contact` is the target of the "Contact me" button (e.g. `'#contact'`); by default it opens an e-mail to
`basics.email`, and the button is hidden when there is neither.

## Deployment settings

`SITE_URL` (e.g. `https://jane.dev`) and `BASE_PATH` (e.g. `/repo`) are environment variables read by
`site/astro.config.mjs`. The GitHub Pages workflow sets them for you.
