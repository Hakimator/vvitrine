---
'@vvitrine/core': minor
'@vvitrine/studio-core': minor
---

Editing sessions. `kernel.readContent(locale)` gives the content as written in the files, with each key's file and the
keys whose source cannot save; `kernel.checkContent(locale, content)` gives the problems a build would find, each with
its path as segments (`ContentIssue.at`). `EditSession` in `@vvitrine/studio-core` records every edit as a change with
its exact inverse (undo, redo, typing merged into one step), keeps the changes to save, checks content as it is typed,
and refuses to save content a build would refuse.
