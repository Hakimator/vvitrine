---
'@vvitrine/core': minor
'@vvitrine/astro': minor
---

Choose the theme in the layout file: `theme: { use: '@vvitrine/theme-bold', options: { colorSchemeToggle: true } }`.
Only that theme is imported, so other installed themes add no CSS to the pages, and switching theme is a one-line data
change. A theme in `plugins` keeps working; one in both places is refused.
