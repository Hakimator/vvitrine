---
'@vvitrine/core': minor
'@vvitrine/sections': minor
'@vvitrine/contact': minor
'@vvitrine/theme-corporate': patch
'@vvitrine/theme-bold': patch
---

The e-mail address is no longer written plainly in the pages. New `protectEmail()` in `@vvitrine/core` returns a
percent-encoded `mailto:` link and the visible text with hidden decoy parts, so harvesters miss it while visitors still
see, click, copy and hear the real address, without JavaScript. `HeroView.email` and `ContactView.email` now use this
shape (breaking for custom themes that drew `email.address`).
