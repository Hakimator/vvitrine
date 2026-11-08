---
'@vvitrine/core': minor
'@vvitrine/consent': minor
'@vvitrine/analytics': minor
---

Analytics with consent. New `@vvitrine/consent`: a banner with equal Accept and Refuse buttons, shown only when a plugin
in use sets cookies, a choice remembered for 6 months, and "Manage cookies" in the footer. New `@vvitrine/analytics`
with `ga4()`: Google Analytics 4 loaded only after the visitor accepts, advertising features off, cookies kept under 13
months, cookies removed on refusal, and listed on the privacy page. Plugins can add footer links (`hooks.footerLinks`).
