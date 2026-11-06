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

- `layout`: an Astro component that receives `lang`, `title`, `path`, `t`, `url`, `alternates`, `locales` and renders
  three slots: `head` (inside `<head>`), the default slot (inside `<main id="main">`) and `body-end`;
- `components`: one component per section id (`hero`, `work`...) and per contributed page (`projects:detail`);
- `fallback`: a component for sections it does not know (custom sections then still render);
- `tokens`: default values for every design token, light and dark.

Theme CSS must only use the `--vv-*` variables (never define them): the kernel writes them, merged with user overrides.
Start by copying `themes/corporate`.
