---
'@vvitrine/core': minor
'@vvitrine/astro': minor
'@vvitrine/source-yaml': minor
'@vvitrine/source-markdown': minor
'@vvitrine/yaml-edit': minor
---

Save content changes. `kernel.saveContent(locale, changes)` applies changes (`set`, `remove`, `insert`, `move`) in
memory, validates the result as a build would, and only then lets each source write its own keys (`save`, `accepts`).
The YAML source edits its files in place, keeping comments and layout, through the new `@vvitrine/yaml-edit` library;
the Markdown source edits front matter and text, creates a file for a new item and deletes the file of a removed one.
The files on disk can be written, `memoryFiles()` can be written in tests, and `checkSourceContract()` checks that a
writable source saves what it loaded.
