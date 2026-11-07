---
'@vvitrine/core': minor
'@vvitrine/astro': minor
'@vvitrine/images': minor
'@vvitrine/sections': minor
'@vvitrine/theme-corporate': minor
'@vvitrine/theme-bold': minor
---

Optimised images: the new `@vvitrine/images` plugin serves local images as responsive WebP variants with their real
size, generated at build time. `ctx.image()` gives sections and themes `{ src, srcset, width, height }`; themes load
the hero photo first and the other images lazily.
