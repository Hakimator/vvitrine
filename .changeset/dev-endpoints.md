---
'@vvitrine/core': minor
'@vvitrine/astro': minor
---

Development endpoints: a plugin can add local endpoints under `/__vvitrine/<tool>/` with `hooks.devEndpoints`, written
with standard `Request` and `Response` and given the site (its languages and `saveContent`). `pnpm dev` serves them,
to `localhost` and pages of the site only; builds never contain them.
