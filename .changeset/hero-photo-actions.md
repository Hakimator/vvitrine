---
'@vvitrine/core': minor
'@vvitrine/sections': minor
'@vvitrine/theme-corporate': minor
'@vvitrine/theme-bold': minor
---

The hero shows `basics.image` (or the person's initials) and calls to action: "Download CV (PDF)" with the new `cv`
option, and "Contact me" (an e-mail link by default, or the `contact` option). New `ctx.asset()` resolves files from
`public/` with the base path; project images now use it, which fixes local images on sites served under a sub-path.
