# Example: a theme plugin (`theme-minimal`)

The smallest complete theme: a layout, a component for each of two shared view kinds, a fallback for everything else,
and design tokens for light and dark mode. About 250 lines in all.

```ts
import minimal from './plugins/theme-minimal/index.ts';

plugins: [/* sources, sections... */, minimal({ tokens: { light: { colorPrimary: '#0b5394' } } })],
```

What it shows:

- **The layout contract** (`components/Layout.astro`): the props the integration passes (`lang`, `title`, `t`,
  `alternates`, `siteName`, `nav`, `heading`) and the three slots (`head`, the sections, `body-end`). It renders the
  skip link, the header navigation, the language switcher, the page heading and the footer links.
- **Shared view kinds:** `kind:entries` (work, education, awards, the example `now` section...) and `kind:tags`
  (skills, interests) each need one component, whatever section produces them.
- **The fallback** (`components/Fallback.astro`): any other section (hero, projects, languages...) still shows its
  content. Add a component for a section id (for example `hero`) to give it its own look.
- **Design tokens:** every value as a CSS custom property (`--vv-color-primary`...), overridable by the user, with a
  dark variant that follows the system setting.

Tests: `test/theme-minimal.test.ts` checks the tokens (all set, text contrast at least 4.5:1 in both modes) and which
component draws which section. The e2e project `minimal` builds the demo content with this theme and runs an
accessibility scan (WCAG 2.2 AA), as a user's site would be built.
