# Themes

## Switch theme

Replace the theme in `plugins` (exactly one theme is allowed):

```ts
import bold from '@vvitrine/theme-bold';
// ...
plugins: [yamlSource(), bold(), hero(), /* ... */],
```

Import only the theme you use: Astro ships the CSS of every imported component, so importing two themes would mix their
styles. The build refuses two themes for this reason.

## Change colours and fonts

Every theme uses the same design tokens. Override them through the theme options:

```ts
corporate({ tokens: { light: { colorPrimary: '#0b6e4f' }, dark: { colorPrimary: '#7fd1b0' } } });
```

| Token                                                              | CSS variable                          |
| ------------------------------------------------------------------ | ------------------------------------- |
| `colorPrimary`, `colorAccent`, `colorText`, `colorMuted`           | `--vv-color-primary`, ...             |
| `colorBackground`, `colorSurface`, `colorBorder`, `colorOnPrimary` | `--vv-color-background`, ...          |
| `fontBody`, `fontHeading`                                          | `--vv-font-body`, `--vv-font-heading` |
| `radius`, `contentWidth`                                           | `--vv-radius`, `--vv-content-width`   |

Check contrast (WCAG AA: 4.5:1 for text) when you change colours; `pnpm e2e` checks it automatically.

## Write a theme

A theme plugin provides:

- `layout`: an Astro component that receives `lang`, `title`, `path`, `t`, `url`, `alternates`, `locales`, `siteName`,
  `nav` and `heading`, and renders three slots: `head` (inside `<head>`), the default slot (inside `<main id="main">`) and
  `body-end`. `nav` is `{ home, items: [{ id, label, href }] }`: render it as the site navigation. Each section is
  rendered with `id` equal to its section id, so `href` (e.g. `/#work`) scrolls to it. `heading` is set on pages where
  no section renders the `<h1>` (pages without a hero): render it as the page's `<h1>`;
- `components`: one component per view kind (`kind:entries`, `kind:tags`, `kind:quotes`, `kind:figures`, see below), per section id
  when a section needs its own layout (`hero`, `projects`, `languages`), and per contributed page (`projects:detail`, and `blog:post`, which receives `ArticleView` from `@vvitrine/sections`);
- `fallback`: a component for sections it does not know (custom sections then still render);
- `tokens`: default values for every design token, light and dark.

### View kinds

Most sections share a few shapes, so a theme draws each shape once and every section that uses it, built-in or
third-party, looks right. The shapes are exported by `@vvitrine/core`:

| Kind      | View                                                                              | Built-in sections                                                              |
| --------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `entries` | `{ title, items: [{ title, subtitle?, url?, meta: string[], summary?, notes }] }` | work, education, volunteer, awards, certificates, publications, timeline, blog |
| `tags`    | `{ title, groups: [{ name, level?, keywords }] }`                                 | skills, interests                                                              |
| `quotes`  | `{ title, items: [{ quote, author, role? }] }`                                    | references, testimonials                                                       |
| `figures` | `{ title, items: [{ value, label }] }`                                            | stats                                                                          |

For a section, the theme component is chosen in this order: the component for its id, then the one for its view kind,
then the section's own default component, then `fallback`.

### Technology filter

When a projects placement sets `filter: true`, `ProjectsView.filter` holds the links ("All", then one per technology,
with `count` and `current`). Draw them as links, inside the section, with `aria-current="page"` on the current one.
When `filter.instant` is true, you can also filter in place with the shared script from `@vvitrine/sections`:

```astro
<a href={link.href} data-tag={link.slug} aria-current={link.current ? 'page' : undefined}>
  {link.name}
</a>
<!-- after the links -->
<p
  class="visually-hidden"
  role="status"
  data-tag-status
  data-one={filter.status.one}
  data-other={filter.status.other}
/>
<script is:inline set:html={tagFilterScript} />
<!-- each card -->
<li data-tags={project.keywordSlugs.join(' ')}>...</li>
```

Print the script only when `filter.instant` is true, so other pages stay free of JavaScript.

### Images

Images in views (`hero.photo`, project `image`) come as `{ src, srcset?, width?, height?, alt }`. Render `srcset` with a
`sizes` value that matches the displayed width, and `width`/`height` so the browser reserves the space. Use
`loading="lazy"` below the fold, and `fetchpriority="high"` for an image at the top of the page, such as the hero photo.

Theme CSS must only use the `--vv-*` variables (never define them): the kernel writes them, merged with user overrides.
Start by copying `themes/corporate`.
