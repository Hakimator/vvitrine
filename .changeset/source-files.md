---
'@vvitrine/core': minor
'@vvitrine/astro': minor
'@vvitrine/source-yaml': patch
'@vvitrine/source-markdown': patch
---

Sources read the project's files through `ctx.files` (`read`, `list`), a port the build fills with the files on disk.
`memoryFiles()` in `@vvitrine/core/testing` gives files in memory for tests. The YAML and Markdown sources use it, so
they also work on files that are not on disk. `pnpm dev` now reloads the page when any file that is not code changes,
wherever the content folder is; `contentDir` only adds a folder outside the project.
