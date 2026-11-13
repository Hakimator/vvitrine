---
'@vvitrine/studio': minor
---

The local Studio, as a plugin: `studio()` serves the Studio at `/__vvitrine/studio/` while `pnpm dev` runs. Its page
lists what can be edited; its API gives the editing model and the content, checks content and saves changes, and needs
the token of the run, which only the Studio's page receives. Builds never contain it.
