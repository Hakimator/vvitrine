---
'@vvitrine/core': minor
'@vvitrine/sections': minor
'@vvitrine/theme-corporate': minor
'@vvitrine/theme-bold': minor
---

Every JSON Resume section is now built in: volunteer, awards, certificates, publications, interests and references join
work, education, skills, languages and projects. New view kinds (`entries`, `tags`, `quotes`) let a theme draw any
section that returns one of these shapes, so new sections need no theme component. Breaking for custom themes: the work,
education and skills views now use the shared `entries` and `tags` shapes.
