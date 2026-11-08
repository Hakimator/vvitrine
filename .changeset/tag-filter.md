---
'@vvitrine/core': minor
'@vvitrine/sections': minor
'@vvitrine/theme-corporate': minor
'@vvitrine/theme-bold': minor
---

Filter projects by technology. `projects({ tags: true })` adds one page per technology, and the `filter: true` option
shows links to them, so filtering works without JavaScript; when every project is on the page, themes filter in place
with a 1 KB inline script. `projects({ path })` sets the page that "All projects" links lead to. Route contributions can
now ask the layout for their main heading (`heading`). The Bold header fits eight links on one line.
