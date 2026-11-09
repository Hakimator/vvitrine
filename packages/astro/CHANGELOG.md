# @vvitrine/astro

## 1.0.0

### Major Changes

- 0333ef5: First stable release. The plugin API (source, section, theme, service and generator plugins, view kinds, page and
  render contexts), the configuration and the content format are now covered by semantic versioning: a breaking change
  to any of them needs a new major version.

### Minor Changes

- 604893b: Light/dark switch. Themes can offer it with `colorSchemeToggle: true` (`corporate({ colorSchemeToggle: true })`): a
  header button, remembered per visitor and applied before the page is drawn, through a 1 KB inline script. The design
  tokens now honour `data-color-scheme` on `<html>` and set `color-scheme`, and the layout receives `colorScheme`. Off by
  default, so pages keep zero JavaScript.
- 8c0714c: Sticky site header with one link per section, generated from the configured pages. Sections can be hidden from it with
  `nav: false`. On small screens the links are in a menu that works without JavaScript. Layouts now receive `siteName` and
  `nav`.
- 2fdad94: Optimised images: the new `@vvitrine/images` plugin serves local images as responsive WebP variants with their real
  size, generated at build time. `ctx.image()` gives sections and themes `{ src, srcset, width, height }`; themes load
  the hero photo first and the other images lazily.
- 8dbb9ab: Portfolio extras: `testimonials`, key figures (`stats`, new `figures` view kind) and `timeline`, which merges work,
  education and volunteering with your own milestones. Pages without a hero now get their title as main heading
  (`PageContext.heading`, `SectionPlugin.pageHeading`), rendered by both themes.

### Patch Changes

- Updated dependencies [ed5e219]
- Updated dependencies [89d0992]
- Updated dependencies [c3c5dd3]
- Updated dependencies [604893b]
- Updated dependencies [f9534af]
- Updated dependencies [8c0714c]
- Updated dependencies [a815a94]
- Updated dependencies [2fdad94]
- Updated dependencies [8dbb9ab]
- Updated dependencies [0eff61b]
- Updated dependencies [a81ebf1]
- Updated dependencies [1d44e87]
- Updated dependencies [e790d6b]
- Updated dependencies [0333ef5]
  - @vvitrine/core@1.0.0
