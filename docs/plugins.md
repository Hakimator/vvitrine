# Plugins

Everything in VVitrine is a plugin, including the built-in features. A plugin is a plain object returned by a factory
function. There are five kinds:

| Kind        | Role                                                                            | Built-in examples                                                         |
| ----------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `source`    | Load raw content                                                                | `@vvitrine/source-yaml`                                                   |
| `section`   | Own and validate a content key, turn it into a view model, optionally add pages | `@vvitrine/sections` (hero, work, education, skills, languages, projects) |
| `theme`     | Render: layout, one component per section, design tokens                        | `@vvitrine/theme-corporate`, `@vvitrine/theme-bold`                       |
| `service`   | Add behaviour to every page through hooks (head tags, body-end components)      | `seo()` in `@vvitrine/seo`                                                |
| `generator` | Produce extra files at build time                                               | `sitemap()` in `@vvitrine/seo`                                            |

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
  },
}
```

## Write a section in 5 minutes

See `site/plugins/talks.ts`. A section:

1. declares the content key it **owns** and its Zod schema (`content: { key: 'talks', schema }`);
2. optionally declares keys of other plugins it **reads** (`reads: ['work']`), read-only;
3. turns content into a view model in `present(input, options, ctx)`; return `null` to hide the section;
4. ships its texts in `messages`, and a `defaultComponents` entry so it works with every theme;
5. optionally returns extra pages from `routes(input, ctx)` (see the `projects` section).

`ctx` gives `t(key)` for texts, `formatDate`, `formatPeriod` and `url(path)` for links that respect the language and the
deployment base path. Never hard-code a visible string or an absolute link.

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

## Write a generator

```ts
const jsonResume = (): GeneratorPlugin => ({
  name: 'export-json-resume',
  kind: 'generator',
  apiVersion: 1,
  generate: async ({ routes, base, siteUrl }) => [{ path: '/resume.json', contents: '...' }],
});
```

## Testing helpers

`@vvitrine/core/testing` exports `memorySource()`, `stringTheme()` and `checkSourceContract()`. See the tests in
`packages/*/test/` for examples.
