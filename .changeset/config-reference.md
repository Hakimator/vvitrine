---
'@vvitrine/core': minor
'@vvitrine/sections': patch
'@vvitrine/contact': patch
---

Generated reference. `docs/reference.md` (every configuration, content and option field) and
`docs/content.schema.json` (for editors that check YAML as you type) are generated from the schemas with
`pnpm reference`, and a test fails when they are out of date. `@vvitrine/core` exports `ConfigSchema`, and the schemas
now describe their fields.
