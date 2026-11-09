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

| Field                | Default                          | Description                                                                                                                        |
| -------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `site.defaultLocale` | `'en'`                           | Language served at `/`. Other languages are served at `/<locale>/`.                                                                |
| `site.locales`       | `[defaultLocale]`                | Must include `defaultLocale`.                                                                                                      |
| `site.favicon`       | `'/favicon.svg'`                 | File in `public/`, or `false`.                                                                                                     |
| `plugins`            | (required)                       | Plugin instances. Call the factories: `corporate()`, not `corporate`.                                                              |
| `pages`              | one home page with every section | Each page: `path` (`/` or `/cv`), optional `title`, ordered `sections`. A page without a hero shows its title as its main heading. |
| `pages[].sections[]` |                                  | A section id, or `{ id, options, nav }`. Options are validated by the section.                                                     |
| `messages`           |                                  | Overrides of any UI string, per locale, and your own texts (e.g. a page title key).                                                |

## Navigation

The header links are generated from your pages: every placed section that has a title gets a link, in page and section
order (the hero has no title, so it gets none). Links on other pages lead back to the right page and section. To hide a
section from the header, set `nav: false`:

```ts
sections: ['hero', 'projects', { id: 'languages', nav: false }],
```

## Footer and privacy page

Pages with `footer: true` are linked from the footer of every page, with their title as the label, instead of from the
header. The demo uses it for the privacy page:

```ts
plugins: [/* ... */, privacy({ host: { name: 'GitHub Pages', url: '<its privacy statement>' } })],
pages: [
  /* ... */
  { path: '/privacy', title: 'page.privacy', footer: true, sections: ['privacy'] },
],
messages: { fr: { 'page.privacy': 'Confidentialité' }, en: { 'page.privacy': 'Privacy' } },
```

The `privacy` section writes the page from what your plugins declare: each service that receives visitor data (the
contact form's provider, analytics...), what it receives, when, for how long, where, and whether it sets cookies. It also
names your host, which sees every visit, the person responsible (`basics.name`) with the protected e-mail address, and
the right to complain to a data protection authority. Add a plugin and the page updates itself. It is a starting point,
not legal advice: read it before you publish.

## Resume page and PDF

```ts
import resumePdf from '@vvitrine/resume-pdf';
// ...
plugins: [/* ... */, resumePdf({ page: '/resume', accent: '#1f3a5f' })],
pages: [
  { path: '/', sections: [{ id: 'hero', options: { cv: '/cv-{locale}.pdf' } }, /* ... */] },
  { path: '/resume', title: 'page.resume', footer: true, sections: ['hero', 'work', 'education', 'skills', 'languages'] },
],
```

- The `/resume` page shows what a printed CV holds. Every page prints on A4 in light colours, without the header,
  footer, buttons or cookie banner.
- `resumePdf()` turns that page into `cv-fr.pdf`, `cv-en.pdf`... at build time, from the same data: the hero (name,
  title, e-mail, profiles, summary), then each section of the list (`entries`) and keyword (`tags`) kinds, and languages.
  Testimonials, figures and projects stay on the website.
- The PDF is tagged for accessibility: document language and title, headings, lists and links in its structure, and an
  embedded font (Inter, latin characters; pass `fonts: { regular, bold }` with your own font files for other scripts).
- `cv: '/cv-{locale}.pdf'` in the hero links the PDF of the page language.

## Analytics and cookie consent

```ts
import { ga4 } from '@vvitrine/analytics';
import consent from '@vvitrine/consent';
// ...
plugins: [/* ... */, ga4({ measurementId: 'G-ABC123DEF4' }), consent()],
```

- Nothing is loaded and no cookie is set until the visitor presses "Accept" in the banner. "Refuse" has the same size
  and look, the choice is remembered for 6 months, and "Manage cookies" in the footer opens the banner again.
- Advertising features stay off (consent mode keeps `ad_storage`, `ad_user_data` and `ad_personalization` denied,
  Google signals disabled) and the cookie lasts 390 days, under the 13 months the CNIL recommends.
- Google Analytics appears on the privacy page with what it collects. In your Google Analytics account, also choose a
  short data retention (2 months) if you do not need more.
- `consent()` stays out of the way when no plugin sets cookies: no banner, no footer link, no JavaScript.
- The demo reads the ID from the `GA_MEASUREMENT_ID` environment variable, so the published demo has no analytics.

## Light and dark mode

Both themes follow the visitor's system setting. To add a switch to the header as well:

```ts
plugins: [corporate({ colorSchemeToggle: true }) /* or bold({ ... }) */],
```

The choice is remembered in the visitor's browser (local storage, not a cookie) and applied before the page is drawn,
so there is no flash of the wrong colours. Storing a display preference the visitor set themselves is generally treated
as not needing consent, like a language choice. Off by default: it adds a 1 KB inline script to every page, and without
JavaScript the button is not shown. Printing always uses the light colours.

## Rules checked at build time

- exactly one theme plugin;
- unique plugin names and section ids;
- one owner per content key;
- every `requires` capability is provided by some plugin (e.g. an analytics plugin that requires `consent`);
- unique page paths per locale;
- valid options for every placed section.

Every rule fails the build with a message that names the problem and how to fix it.

## Built-in section options

| Section                                                                                                                       | Options                                                          |
| ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `work`, `education`, `volunteer`, `awards`, `certificates`, `publications`, `references`, `testimonials`, `stats`, `timeline` | `title?: string`, `limit?: number`                               |
| `projects`                                                                                                                    | `title?`, `limit?`, `featuredOnly?: boolean`, `filter?: boolean` |
| `skills`, `languages`, `interests`                                                                                            | `title?`                                                         |
| `hero`                                                                                                                        | `cv?: string`, `contact?: string`                                |

`timeline` also takes a setting when you add the plugin: `timeline({ from: ['work', 'education', 'volunteer'] })` lists
the keys it merges (default: work and education). It is not part of `allSections()`, because it repeats those sections;
the demo puts it on its own page.

`projects` takes two settings when you add the plugin, and `filter` shows links that filter the list by technology:

```ts
plugins: [/* ... */, projects({ path: '/projects', tags: true })],
pages: [
  { path: '/', sections: ['hero', { id: 'projects', nav: false, options: { limit: 6 } }] },
  { path: '/projects', title: 'page.projects', sections: [{ id: 'projects', options: { filter: true } }] },
],
```

- `path` is the page that lists every project: "All projects" links lead there (default `/`, the home page).
- `tags: true` adds one page per technology (`/projects/tag/astro/`, from the projects' `keywords`). The filter links
  open these pages, so filtering works without JavaScript. When every project is on the page, the themes add a small
  inline script (about 1 KB, no request) that filters in place and still updates the address. Pages without the
  filter keep shipping zero JavaScript.
- Keywords become addresses as `c-plus-plus` for `C++`, `c-sharp` for `C#`; `Astro` and `astro` are one technology.

`hero` options: `cv` is a file in `public/` (e.g. `'/cv.pdf'`) or a full URL; it adds a "Download CV (PDF)" button.
`contact` is the target of the "Contact me" button (e.g. `'#contact'`); by default it opens an e-mail to
`basics.email`, and the button is hidden when there is neither.

## Contact form

```ts
import { contact, web3forms } from '@vvitrine/contact';
// ...
plugins: [/* ... */, contact({ provider: web3forms({ accessKey: '<your key>' }) })],
pages: [{ path: '/', sections: [{ id: 'hero', options: { contact: '#contact' } }, /* ... */, 'contact'] }],
```

- The form is plain HTML: it works without JavaScript, and nothing is sent to a third party until the visitor presses
  "Send". The browser checks the required fields first.
- Messages go through [Web3Forms](https://web3forms.com) (250 free messages a month): enter your e-mail address there
  and you receive an access key. The key is visible in the page, which is expected; it only lets people send you
  messages. Spam protection is a hidden field that only bots fill in (no captcha script, no cookie).
- The form says which service receives the message and links to
  [how Web3Forms handles data](https://web3forms.com/dpa): it is run from India, with servers in the EU and on AWS, and
  keeps messages for up to three years. Choose another provider if that does not suit you (see below).
- After sending, visitors come back to a "Message sent" page of your site (`/contact/sent/`) when `SITE_URL` is set;
  otherwise Web3Forms shows its own confirmation.
- `basics.email` is always offered as a fallback. Without a `provider`, the section shows only the e-mail address.
- The demo reads the key from the `WEB3FORMS_ACCESS_KEY` environment variable, so it stays out of the code.

Another provider is one small object implementing `ContactProvider` (`action`, `hiddenFields()`, `honeypot`, `service`,
`privacyUrl`), exported by `@vvitrine/contact`.

## Images

```ts
import images from '@vvitrine/images';
// ...
plugins: [/* ... */, images({ widths: [480, 960, 1440], quality: 80 })],
```

| Option    | Default            | Description                                                    |
| --------- | ------------------ | -------------------------------------------------------------- |
| `dir`     | `'public'`         | Folder of your static files.                                   |
| `widths`  | `[480, 960, 1440]` | Widths of the WebP variants. Wider than the original: skipped. |
| `quality` | `80`               | WebP quality, 1 to 100.                                        |
| `outDir`  | `'/_images'`       | URL folder of the generated files.                             |

The plugin uses `sharp`, which your site lists as a dependency (Astro uses it too). Remove the plugin to serve your
images exactly as they are.

## Deployment settings

`SITE_URL` (e.g. `https://jane.dev`) and `BASE_PATH` (e.g. `/repo`) are environment variables read by
`site/astro.config.mjs`. The GitHub Pages workflow sets them for you.
