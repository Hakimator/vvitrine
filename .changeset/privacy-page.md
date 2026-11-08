---
'@vvitrine/core': minor
'@vvitrine/sections': minor
'@vvitrine/contact': minor
'@vvitrine/theme-corporate': minor
'@vvitrine/theme-bold': minor
---

Privacy page generated from the plugins. Plugins declare the visitor data they handle with `privacy(ctx)` (service,
purpose, when, data, retention, location, cookies, terms), and the new `privacy` section lists them with the host and
the person responsible. Pages with `footer: true` are linked from the footer (`nav.footer`) instead of the header. Both
themes now have a footer with these links and a copyright line. The contact form declares what it sends to Web3Forms.
