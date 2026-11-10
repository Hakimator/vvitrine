---
'@vvitrine/core': minor
'@vvitrine/astro': minor
---

Layout file: languages, pages and their sections, texts and design token overrides can live in `site.yaml` (or
`site.yml`, `site.json`) next to `vvitrine.config.ts`, as plain data that people and tools can edit. Token overrides in
the layout apply over any theme. `pages`, `site` and `messages` in `vvitrine.config.ts` keep working; setting one in both
files is an error that names both. `pnpm dev` reloads the page when the layout file changes, and
`docs/layout.schema.json` lets editors check it.
