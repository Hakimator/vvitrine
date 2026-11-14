---
'@vvitrine/core': minor
'@vvitrine/source-markdown': minor
'@vvitrine/astro': patch
'@vvitrine/studio-core': minor
'@vvitrine/studio': minor
---

The Studio reorders, duplicates and removes list items (jobs, skills, keywords...) from a menu that works with the
keyboard and a single pointer, or by dragging them, in every language at once, each action announced and undoable.
Items of a key with a file per item (Markdown projects and articles) keep the order of their files: the kernel names
those keys (`fixedOrder`), they change in one language at a time, and after saving the Studio takes the order of the
files. A new item is saved whole, so its file is named after what was typed. The dev server now reloads the layout in
every module runner when its file changes.
