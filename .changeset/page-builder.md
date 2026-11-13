---
'@vvitrine/core': minor
'@vvitrine/astro': minor
'@vvitrine/studio-core': minor
'@vvitrine/studio': minor
---

The Studio arranges your pages: move, hide, add and remove sections, on a page or between pages, from a menu that
works with the keyboard and a single pointer, or by dragging them. Every move is announced and can be undone, and
`site.yaml` is saved in place with its comments. A section placed with `hidden: true` stays on its page, with its
options, without being shown. The kernel reads, checks and saves the layout through the development port
(`readLayout`, `checkLayout`, `saveLayout`), and the Astro integration writes the layout file while `pnpm dev` runs.
