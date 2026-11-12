---
'@vvitrine/core': minor
'@vvitrine/sections': minor
'@vvitrine/studio-core': minor
---

Editing model for the Studio. `kernel.editingModel()` gives the JSON Schema of `basics` and of every content key (with
its owner) and of every section's options; development endpoints get it too. New field types carry editor hints
(`LongText`, `MarkdownText`, `ImagePath`; `PartialDate` is a date), and sections may add `editor` hints to their
content: the field that names list items, and custom widgets as custom elements. The built-in sections use them. The
new `@vvitrine/studio-core` turns the model into form descriptions: kind of control, label, help, required, choices.
