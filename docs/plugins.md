# Plugins

Everything in VVitrine is a plugin, including the built-in features. A plugin is a plain object returned by a factory
function. There are five kinds:

| Kind        | Role                                                                            | Built-in examples                                                         |
| ----------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `source`    | Load raw content                                                                | `@vvitrine/source-yaml`, `@vvitrine/source-markdown`                      |
| `section`   | Own and validate a content key, turn it into a view model, optionally add pages | `@vvitrine/sections` (hero, work, education, skills, languages, projects) |
| `theme`     | Render: layout, one component per section, design tokens                        | `@vvitrine/theme-corporate`, `@vvitrine/theme-bold`                       |
| `service`   | Add behaviour to every page through hooks (head tags, body-end components)      | `seo()` in `@vvitrine/seo`                                                |
| `generator` | Produce extra files at build time                                               | `sitemap()` in `@vvitrine/seo`                                            |

To start your own, copy one of the [example plugins](../examples/plugins/): one of each kind (`source-github`,
`section-now`, `theme-minimal`, `service-plausible`, `generator-vcard`), small, documented and tested, and written
only against the public API of `@vvitrine/core`, as yours will be. The architecture check (`pnpm boundaries`) keeps
them that way.

## Common fields

```ts
{
  name: 'my-plugin',            // unique
  kind: 'section',
  apiVersion: 1,                // checked by the kernel
  provides?: ['consent'],       // capabilities offered to other plugins
  requires?: ['consent'],       // capabilities that must be provided by another plugin
  messages?: { fr: { 'my.key': '...' }, en: { 'my.key': '...' } },
  hooks?: {
    contentLoaded?(raw, ctx),   // transform raw content before validation
    head?(page) => HeadTag[],   // tags for <head>, escaped by the kernel
    bodyEnd?(page) => [{ component, props }],
    footerLinks?(ctx) => NavItem[],
    devEndpoints?() => DevEndpoint[], // local endpoints of `pnpm dev` (see below)
  },
}
```

### Development endpoints

A tool that works on the site while you edit it (the Studio, a content checker...) adds local endpoints with
`devEndpoints`. They are served by `pnpm dev` only and never built:

```ts
hooks: {
  devEndpoints: () => [
    {
      path: '/__vvitrine/my-tool/languages', // under /__vvitrine/<tool>/; ending with "/" answers everything below it
      handle: (request, { site }) => Response.json({ locales: site.locales }),
    },
  ],
},
```

- Handlers take a standard `Request` and return a `Response` (no framework), so the same code can run elsewhere.
- `site` gives what tools need:
  - `locales`;
  - `editingModel()`: the schemas of the content and of the sections' options;
  - `readContent(locale)`: the content as written in the files, with each key's file and the keys that cannot be saved;
  - `checkContent(locale, content)`: the problems a build would find;
  - `saveContent(locale, changes)`: saving through the sources.

  `EditSession` in `@vvitrine/studio-core` builds on these: changes with undo and redo, checks as you type, and
  saving only valid content.

- They answer requests to `localhost` only, from pages of the site itself: other sites open in the browser, and other
  computers when the server is started with `--host`, are refused. Do not change anything on a `GET`: a page on another
  site can still make the browser send one, even if it cannot read the answer.
- Two plugins cannot use the same path, and a path outside `/__vvitrine/<tool>/` is refused at startup.

A plugin that sends visitor data to a third party, or stores it, says so with `privacy(ctx)`. The privacy section lists
these declarations, in the reader's language; plugins that are not in use (a section placed on no page) are left out:

```ts
privacy: (ctx) => [
  {
    service: 'Web3Forms',
    purpose: ctx.t('my.purpose'),       // why
    when: ctx.t('my.when'),             // e.g. "Only when you send the form"
    data: [ctx.t('my.data.email')],     // what
    retention: ctx.t('my.retention'),   // optional: how long
    location: ctx.t('my.location'),     // optional: where the company or data is
    cookies: false,
    url: 'https://web3forms.com/dpa',   // the service's own terms
  },
],
```

## Write a section in 5 minutes

See `site/plugins/talks.ts`. A section:

1. declares the content key it **owns** and its Zod schema (`content: { key: 'talks', schema }`);
2. optionally declares keys of other plugins it **reads** (`reads: ['work']`), read-only;
3. turns content into a view model in `present(input, options, ctx)`; return `null` to hide the section. If the view
   has a string `title`, the section gets a link in the site header;
4. ships its texts in `messages`. If its view has one of the shared shapes (`entries`, `tags`, `quotes`, see
   [Themes](themes.md#view-kinds)), it declares `viewKind` and every theme draws it with no component of its own;
   otherwise it ships a `defaultComponents` entry so it works with every theme;
5. optionally returns extra pages from `routes(input, ctx)` (see the `projects` section);
6. sets `pageHeading: true` if it renders the page's `<h1>` (like the hero); other pages get their title as heading.

`ctx` gives `t(key)` for texts, `formatDate`, `formatPeriod`, `url(path)` for links that respect the language and the
deployment base path, `asset(path)` for files in `public/`, and `image(path)` for images: `{ src, srcset?, width?,
height? }`, filled in by the image plugin when one is installed. Never hard-code a visible string or an absolute link.

### Make a section editable in the Studio

The Studio builds the form of a section's content and options from its schemas: field names become labels, and
`.describe()` texts become help. Use the core's field types where they fit, so that the Studio picks the right
control:

| Type (from `@vvitrine/core`) | Control                              |
| ---------------------------- | ------------------------------------ |
| `z.string()`                 | one-line text                        |
| `LongText`                   | text area (a summary, a description) |
| `MarkdownText`               | Markdown editor                      |
| `PartialDate`                | date (YYYY, YYYY-MM or YYYY-MM-DD)   |
| `ImagePath`                  | picture in `public/`                 |
| `Url`, `z.email()`           | web address, e-mail address          |
| `z.enum([...])`              | list of choices                      |

Two optional hints go next to the schema:

```ts
content: {
  key: 'now',
  schema: NowContent,
  editor: {
    itemTitle: 'text', // the field that names each list item (default: the first one-line text)
    widgets: { updated: { element: 'now-month', module: monthInputModule } }, // a control of your own
  },
},
```

A widget is a custom element (a web standard): the Studio sets its `value` property and listens to its `change`
event, so your plugin does not depend on the Studio's user interface library. `module` is the JavaScript that defines
it. Paths use `*` for any position in a list (`'*.color'`). The example section `section-now` has one.

## Write an image plugin

An image plugin is a generator with an `images` field (at most one per site): the kernel calls `images.prepare()` once
before rendering, `images.describe(path)` for each local image a page uses, then the plugin's `generate()`, which returns
the optimised files. See `@vvitrine/images`.

Add it to `plugins` and place it on a page: no framework file changes.

## Write a source

```ts
const notion = (): SourcePlugin => ({
  name: 'source-notion',
  kind: 'source',
  apiVersion: 1,
  load: async ({ locale }) => ({ data: { projects: await fetchProjects(locale) } }),
});
```

Several sources can be combined; later ones override keys of earlier ones. Test any source with
`checkSourceContract()` from `@vvitrine/core/testing`.

A source that reads files uses `ctx.files`, not `node:fs`:

```ts
const csv = (): SourcePlugin => ({
  name: 'source-csv',
  kind: 'source',
  apiVersion: 1,
  load: async ({ files }) => {
    const text = await files.read('content/skills.csv'); // undefined when the file does not exist
    return { data: text ? { skills: parseCsv(text) } : {}, origin: { skills: 'content/skills.csv' } };
  },
});
```

- `files.read(path)` gives a file's text and `files.list(dir)` the names in a folder (sorted); both give `undefined` when
  there is nothing. Paths are relative to the project root, with `/`.
- The build gives the files on disk, and `pnpm dev` reloads the page when they change. Tests give files in memory with
  `memoryFiles({ 'content/skills.csv': '...' })`. The Studio will give files from elsewhere, such as a Git repository.
  A source written this way works in all these places; one that uses `node:fs` would only work on disk (the built-in
  sources are checked for this by `pnpm boundaries`).

### Make a source writable

The Studio saves content through the source that provides it, in that source's format. A source becomes writable with
two optional members:

```ts
save: async (changes, { files, locale }) => {
  // changes: { op: 'set' | 'remove' | 'insert' | 'move', path: ['skills', 0, 'name'], ... }[], for your keys only
  const text = (await files.read('content/skills.csv')) ?? '';
  await files.write('content/skills.csv', writeCsv(changes.reduce(applyChange, readCsv(text))));
},
accepts: (key) => key === 'skills', // may a key no source has yet be created here?
```

- The kernel (`saveContent(locale, changes)`) applies the changes in memory and validates the result exactly as a build
  would. Your `save` is called only when it is valid, and only with changes to the keys you provide (or `accepts`).
- `applyChange` (from `@vvitrine/core`) applies one change to plain data. To keep a YAML file's comments and layout,
  edit its text with `editYaml(text, changes)` from `@vvitrine/yaml-edit`, as the YAML and Markdown sources do.
- A source without `save` is read-only: the Studio shows its content without editing it.
- `checkSourceContract(source, { root, locales, files: memoryFiles({...}) })` also checks that saving a value
  unchanged gives the same content back.

## Write a service

```ts
const plausible = (domain: string): ServicePlugin => ({
  name: 'plausible',
  kind: 'service',
  apiVersion: 1,
  hooks: {
    head: () => [
      { tag: 'script', attrs: { defer: true, 'data-domain': domain, src: 'https://plausible.io/js/script.js' } },
    ],
  },
});
```

A service that sets cookies must declare `requires: ['consent']`, so it cannot be used without a consent plugin.

### Analytics and consent

An analytics plugin (see `@vvitrine/analytics` for Google Analytics 4) follows three rules:

1. **Declare what it collects** with `privacy(ctx)` and `cookies: true` if it sets cookies. The privacy page lists it,
   and the consent banner (`@vvitrine/consent`) appears only because of it, with "Manage cookies" in the footer.
2. **Require consent**: `requires: ['consent']`. The build fails without a consent plugin.
3. **Load nothing before consent.** Its `head` script waits for the `vvitrine:consent` browser event, then loads the
   tracker; on `granted: false` it stops and deletes its cookies:

```js
addEventListener('vvitrine:consent', (event) => {
  if (event.detail.granted) loadTracker();
  else removeCookies();
});
```

The banner sends this event once per page when the visitor's choice is known (remembered for 6 months, as the CNIL
recommends), and again whenever the visitor changes it. Visitors without JavaScript see no banner and are never tracked.

## Write a generator

```ts
const jsonResume = (): GeneratorPlugin => ({
  name: 'export-json-resume',
  kind: 'generator',
  apiVersion: 1,
  generate: async ({ routes, base, siteUrl }) => [{ path: '/resume.json', contents: '...' }],
});
```

Each route gives its `page` (the configured path, the same in every language) and its `sections`, each with its `view`
and `viewKind`: a generator can lay out what a page shows without knowing the sections (see `@vvitrine/resume-pdf`).

## Testing helpers

`@vvitrine/core/testing` exports `memorySource()`, `memoryFiles()` (readable and writable, with `snapshot()`),
`stringTheme()` and `checkSourceContract()`. See the tests in
`packages/*/test/` for examples.
