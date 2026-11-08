---
'@vvitrine/contact': minor
'@vvitrine/core': minor
'@vvitrine/theme-corporate': minor
'@vvitrine/theme-bold': minor
---

New `@vvitrine/contact` package: a contact section with a plain HTML form (no JavaScript, nothing sent until the visitor
presses "Send") delivered through Web3Forms by default, a honeypot against spam, a privacy notice, a "Message sent"
page, and the e-mail address as a fallback. Other providers implement the small `ContactProvider` interface. Sections
now receive the absolute site URL (`ctx.siteUrl`).
