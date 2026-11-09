---
'@vvitrine/core': minor
'@vvitrine/astro': minor
'@vvitrine/theme-corporate': minor
'@vvitrine/theme-bold': minor
---

Light/dark switch. Themes can offer it with `colorSchemeToggle: true` (`corporate({ colorSchemeToggle: true })`): a
header button, remembered per visitor and applied before the page is drawn, through a 1 KB inline script. The design
tokens now honour `data-color-scheme` on `<html>` and set `color-scheme`, and the layout receives `colorScheme`. Off by
default, so pages keep zero JavaScript.
