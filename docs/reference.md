# Configuration reference

<!-- Generated from the schemas by `pnpm reference`. Do not edit by hand: change the schema and run it again. -->

Every field VVitrine reads, with its type, whether it is required, and its default. The guides explain how to use
them: [Configuration](configuration.md), [Content](content.md), [Themes](themes.md).

## `vvitrine.config.ts`

The plugins, and the options that need code. `site`, `pages` and `messages` can live here or in `site.yaml`,
not in both.

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `site` | object |  | `{"defaultLocale":"en","favicon":"/favicon.svg"}` | Languages and icon. |
| `site.defaultLocale` | text |  | `"en"` | Language of the site root, e.g. "fr": its pages have no prefix. |
| `site.locales` | list of text |  |  | Every language of the site; the others live under /en/, /de/... Must include defaultLocale. |
| `site.favicon` | text or `false` |  | `"/favicon.svg"` | Site icon in public/, or false for none. |
| `plugins` | list of any | yes |  | Plugin instances: sources, sections, exactly one theme, services, generators. Call the factories. |
| `pages` | list of object |  |  | Pages and the sections on each. Default: one page with every section. |
| `pages[].path` | text | yes |  | Address without the language prefix, e.g. "/" or "/resume". |
| `pages[].title` | text |  |  | Message key or text; default: your name. |
| `pages[].footer` | `true` or `false` |  |  | Link the page from the footer instead of the header (e.g. privacy). |
| `pages[].sections` | list of text or object | yes |  | Section ids in order, or { id, options, nav } to set options or leave out the header link. |
| `messages` | map |  |  | Replace any text, per language: { en: { 'section.work.title': 'Career' } }. |

## `site.yaml`

The layout of the site, as plain data: languages, pages, texts and design tokens. It sits next to
`vvitrine.config.ts` (`site.yaml`, `site.yml` or `site.json`). Editors can check it with
[`layout.schema.json`](layout.schema.json): add `# yaml-language-server: $schema=<path to it>` at the top.

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `site` | object |  |  | Languages and icon. |
| `site.defaultLocale` | text |  | `"en"` | Language of the site root, e.g. "fr": its pages have no prefix. |
| `site.locales` | list of text |  |  | Every language of the site; the others live under /en/, /de/... Must include defaultLocale. |
| `site.favicon` | text or `false` |  | `"/favicon.svg"` | Site icon in public/, or false for none. |
| `theme` | object |  |  | Look of the site, whatever the theme. |
| `theme.tokens` | object |  |  | Design token overrides, applied over the active theme, for light and dark mode. |
| `theme.tokens.light` | object |  |  | Design tokens: colorPrimary, colorAccent, colorText, colorMuted, colorBackground, colorSurface, colorBorder, colorOnPrimary, fontBody, fontHeading, radius, contentWidth. |
| `theme.tokens.light.colorPrimary` | text |  |  |  |
| `theme.tokens.light.colorAccent` | text |  |  |  |
| `theme.tokens.light.colorText` | text |  |  |  |
| `theme.tokens.light.colorMuted` | text |  |  |  |
| `theme.tokens.light.colorBackground` | text |  |  |  |
| `theme.tokens.light.colorSurface` | text |  |  |  |
| `theme.tokens.light.colorBorder` | text |  |  |  |
| `theme.tokens.light.colorOnPrimary` | text |  |  |  |
| `theme.tokens.light.fontBody` | text |  |  |  |
| `theme.tokens.light.fontHeading` | text |  |  |  |
| `theme.tokens.light.radius` | text |  |  |  |
| `theme.tokens.light.contentWidth` | text |  |  |  |
| `theme.tokens.dark` | object |  |  | Design tokens: colorPrimary, colorAccent, colorText, colorMuted, colorBackground, colorSurface, colorBorder, colorOnPrimary, fontBody, fontHeading, radius, contentWidth. |
| `theme.tokens.dark.colorPrimary` | text |  |  |  |
| `theme.tokens.dark.colorAccent` | text |  |  |  |
| `theme.tokens.dark.colorText` | text |  |  |  |
| `theme.tokens.dark.colorMuted` | text |  |  |  |
| `theme.tokens.dark.colorBackground` | text |  |  |  |
| `theme.tokens.dark.colorSurface` | text |  |  |  |
| `theme.tokens.dark.colorBorder` | text |  |  |  |
| `theme.tokens.dark.colorOnPrimary` | text |  |  |  |
| `theme.tokens.dark.fontBody` | text |  |  |  |
| `theme.tokens.dark.fontHeading` | text |  |  |  |
| `theme.tokens.dark.radius` | text |  |  |  |
| `theme.tokens.dark.contentWidth` | text |  |  |  |
| `pages` | list of object |  |  | Pages and the sections on each. Default: one page with every section. |
| `pages[].path` | text | yes |  | Address without the language prefix, e.g. "/" or "/resume". |
| `pages[].title` | text |  |  | Message key or text; default: your name. |
| `pages[].footer` | `true` or `false` |  |  | Link the page from the footer instead of the header (e.g. privacy). |
| `pages[].sections` | list of text or object | yes |  | Section ids in order, or { id, options, nav } to set options or leave out the header link. |
| `messages` | map |  |  | Replace any text, per language: { en: { 'section.work.title': 'Career' } }. |

## Content

Each key of your content files is owned and checked by one section. Fields of the
[JSON Resume](https://jsonresume.org/schema) standard keep their usual meaning; `x-vvitrine` holds the extensions.
Editors that read JSON Schema (VS Code with the YAML extension, for example) can check your files with
[`content.schema.json`](content.schema.json): add `# yaml-language-server: $schema=<path to it>` at the top.

### `basics`

Owner: the core.

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `basics` | object | yes |  |  |
| `basics.name` | text | yes |  |  |
| `basics.label` | text |  |  |  |
| `basics.image` | text |  |  | Your photo in public/, e.g. /photo.jpg; initials are shown without it. |
| `basics.email` | text |  |  | Never written plainly in the pages (protected from spam harvesters). |
| `basics.url` | URL |  |  |  |
| `basics.summary` | text |  |  |  |
| `basics.location` | object |  |  |  |
| `basics.location.city` | text |  |  |  |
| `basics.location.region` | text |  |  |  |
| `basics.location.countryCode` | text |  |  |  |
| `basics.profiles` | list of object |  | `[]` |  |
| `basics.profiles[].network` | text | yes |  |  |
| `basics.profiles[].username` | text |  |  |  |
| `basics.profiles[].url` | URL |  |  |  |
| `basics.x-vvitrine` | object |  |  |  |
| `basics.x-vvitrine.availability` | text |  |  | Shown under your name, e.g. "Looking for an internship". |

### `awards`

Owner: the `awards` section.

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `awards` | list of object |  | `[]` |  |
| `awards[].title` | text | yes |  |  |
| `awards[].date` | date (YYYY, YYYY-MM or YYYY-MM-DD) |  |  |  |
| `awards[].awarder` | text |  |  |  |
| `awards[].summary` | text |  |  |  |

### `certificates`

Owner: the `certificates` section.

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `certificates` | list of object |  | `[]` |  |
| `certificates[].name` | text | yes |  |  |
| `certificates[].date` | date (YYYY, YYYY-MM or YYYY-MM-DD) |  |  |  |
| `certificates[].issuer` | text |  |  |  |
| `certificates[].url` | URL |  |  |  |

### `education`

Owner: the `education` section.

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `education` | list of object |  | `[]` |  |
| `education[].institution` | text | yes |  |  |
| `education[].url` | URL |  |  |  |
| `education[].area` | text |  |  |  |
| `education[].studyType` | text |  |  |  |
| `education[].startDate` | date (YYYY, YYYY-MM or YYYY-MM-DD) |  |  |  |
| `education[].endDate` | date (YYYY, YYYY-MM or YYYY-MM-DD) |  |  |  |
| `education[].score` | text |  |  |  |
| `education[].courses` | list of text |  | `[]` |  |

### `interests`

Owner: the `interests` section.

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `interests` | list of object |  | `[]` |  |
| `interests[].name` | text | yes |  |  |
| `interests[].keywords` | list of text |  | `[]` |  |

### `languages`

Owner: the `languages` section.

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `languages` | list of object |  | `[]` |  |
| `languages[].language` | text | yes |  |  |
| `languages[].fluency` | text |  |  |  |

### `posts`

Owner: the `blog` section.

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `posts` | list of object |  | `[]` |  |
| `posts[].title` | text | yes |  |  |
| `posts[].date` | date (YYYY, YYYY-MM or YYYY-MM-DD) | yes |  |  |
| `posts[].summary` | text |  |  |  |
| `posts[].tags` | list of text |  | `[]` |  |
| `posts[].draft` | `true` or `false` |  | `false` | Keep the article out of the site. |
| `posts[].x-vvitrine` | object |  | `{}` |  |
| `posts[].x-vvitrine.slug` | text |  |  | Address of the article, /blog/<slug>; default: the file name. |
| `posts[].x-vvitrine.body` | text |  |  | The article in Markdown (the text of the Markdown file). |

### `projects`

Owner: the `projects` section.

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `projects` | list of object |  | `[]` |  |
| `projects[].name` | text | yes |  |  |
| `projects[].description` | text |  |  |  |
| `projects[].highlights` | list of text |  | `[]` |  |
| `projects[].keywords` | list of text |  | `[]` |  |
| `projects[].roles` | list of text |  | `[]` |  |
| `projects[].startDate` | date (YYYY, YYYY-MM or YYYY-MM-DD) |  |  |  |
| `projects[].endDate` | date (YYYY, YYYY-MM or YYYY-MM-DD) |  |  |  |
| `projects[].url` | URL |  |  |  |
| `projects[].x-vvitrine` | object |  | `{"featured":false}` |  |
| `projects[].x-vvitrine.slug` | text |  |  | Address of the project page, /projects/<slug>; default: made from the name. |
| `projects[].x-vvitrine.repository` | URL |  |  | Source code, linked from the project page. |
| `projects[].x-vvitrine.featured` | `true` or `false` |  | `false` | Shown first, with a "Featured" label. |
| `projects[].x-vvitrine.image` | object |  |  |  |
| `projects[].x-vvitrine.image.src` | text | yes |  | Picture in public/, e.g. /projects/app.png. |
| `projects[].x-vvitrine.image.alt` | text | yes |  | What the picture shows, for people who cannot see it. |
| `projects[].x-vvitrine.body` | text |  |  | Write-up in Markdown, shown on the project page (the text of a Markdown file). |

### `publications`

Owner: the `publications` section.

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `publications` | list of object |  | `[]` |  |
| `publications[].name` | text | yes |  |  |
| `publications[].publisher` | text |  |  |  |
| `publications[].releaseDate` | date (YYYY, YYYY-MM or YYYY-MM-DD) |  |  |  |
| `publications[].url` | URL |  |  |  |
| `publications[].summary` | text |  |  |  |

### `references`

Owner: the `references` section.

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `references` | list of object |  | `[]` |  |
| `references[].name` | text | yes |  |  |
| `references[].reference` | text | yes |  |  |
| `references[].x-vvitrine` | object |  |  |  |
| `references[].x-vvitrine.role` | text |  |  | Who the person is, e.g. "Team lead at Acme". |

### `skills`

Owner: the `skills` section.

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `skills` | list of object |  | `[]` |  |
| `skills[].name` | text | yes |  |  |
| `skills[].level` | text |  |  |  |
| `skills[].keywords` | list of text |  | `[]` |  |

### `stats`

Owner: the `stats` section.

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `stats` | list of object | yes |  |  |
| `stats[].value` | text or number | yes |  |  |
| `stats[].label` | text | yes |  |  |

### `testimonials`

Owner: the `testimonials` section.

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `testimonials` | list of object |  | `[]` |  |
| `testimonials[].quote` | text | yes |  |  |
| `testimonials[].author` | text | yes |  |  |
| `testimonials[].role` | text |  |  |  |

### `timeline`

Owner: the `timeline` section.

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `timeline` | list of object |  | `[]` |  |
| `timeline[].title` | text | yes |  |  |
| `timeline[].date` | date (YYYY, YYYY-MM or YYYY-MM-DD) | yes |  |  |
| `timeline[].endDate` | date (YYYY, YYYY-MM or YYYY-MM-DD) |  |  |  |
| `timeline[].summary` | text |  |  |  |
| `timeline[].url` | URL |  |  |  |

### `volunteer`

Owner: the `volunteer` section.

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `volunteer` | list of object |  | `[]` |  |
| `volunteer[].organization` | text | yes |  |  |
| `volunteer[].position` | text |  |  |  |
| `volunteer[].url` | URL |  |  |  |
| `volunteer[].startDate` | date (YYYY, YYYY-MM or YYYY-MM-DD) |  |  |  |
| `volunteer[].endDate` | date (YYYY, YYYY-MM or YYYY-MM-DD) |  |  |  |
| `volunteer[].summary` | text |  |  |  |
| `volunteer[].highlights` | list of text |  | `[]` |  |

### `work`

Owner: the `work` section.

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `work` | list of object |  | `[]` |  |
| `work[].name` | text | yes |  |  |
| `work[].position` | text | yes |  |  |
| `work[].location` | text |  |  |  |
| `work[].url` | URL |  |  |  |
| `work[].startDate` | date (YYYY, YYYY-MM or YYYY-MM-DD) | yes |  |  |
| `work[].endDate` | date (YYYY, YYYY-MM or YYYY-MM-DD) |  |  |  |
| `work[].summary` | text |  |  |  |
| `work[].highlights` | list of text |  | `[]` |  |

## Section options

Set per placement: `{ id: 'work', options: { limit: 3 } }`.

### `awards`

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `title` | text |  |  | Heading of the section, instead of the default one. |
| `limit` | whole number |  |  | Show at most this many items. |

### `blog`

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `title` | text |  |  | Heading of the section, instead of the default one. |
| `limit` | whole number |  |  | Show at most this many items. |

### `certificates`

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `title` | text |  |  | Heading of the section, instead of the default one. |
| `limit` | whole number |  |  | Show at most this many items. |

### `contact`

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `title` | text |  |  | Heading of the section, instead of the default one. |

### `education`

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `title` | text |  |  | Heading of the section, instead of the default one. |
| `limit` | whole number |  |  | Show at most this many items. |

### `hero`

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `cv` | text |  |  | Adds a "Download CV" button: a file in public/ or a URL; {locale} becomes the page language. |
| `contact` | text |  |  | Target of the "Contact me" button, e.g. #contact; default: your protected e-mail address. |

### `interests`

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `title` | text |  |  | Heading of the section, instead of the default one. |

### `languages`

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `title` | text |  |  | Heading of the section, instead of the default one. |

### `privacy`

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `title` | text |  |  | Heading of the section, instead of the default one. |

### `projects`

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `title` | text |  |  | Heading of the section, instead of the default one. |
| `limit` | whole number |  |  | Show at most this many items. |
| `featuredOnly` | `true` or `false` |  | `false` | Show featured projects only. |
| `filter` | `true` or `false` |  | `false` | Show links that filter by technology; needs projects({ tags: true }). |

### `publications`

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `title` | text |  |  | Heading of the section, instead of the default one. |
| `limit` | whole number |  |  | Show at most this many items. |

### `references`

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `title` | text |  |  | Heading of the section, instead of the default one. |
| `limit` | whole number |  |  | Show at most this many items. |

### `skills`

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `title` | text |  |  | Heading of the section, instead of the default one. |

### `stats`

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `title` | text |  |  | Heading of the section, instead of the default one. |
| `limit` | whole number |  |  | Show at most this many items. |

### `testimonials`

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `title` | text |  |  | Heading of the section, instead of the default one. |
| `limit` | whole number |  |  | Show at most this many items. |

### `timeline`

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `title` | text |  |  | Heading of the section, instead of the default one. |
| `limit` | whole number |  |  | Show at most this many items. |

### `volunteer`

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `title` | text |  |  | Heading of the section, instead of the default one. |
| `limit` | whole number |  |  | Show at most this many items. |

### `work`

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `title` | text |  |  | Heading of the section, instead of the default one. |
| `limit` | whole number |  |  | Show at most this many items. |
