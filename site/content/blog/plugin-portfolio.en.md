---
title: Building a plugin-based portfolio
date: 2026-11-07
summary: Why every part of this site, from the sections to the theme, is a plugin.
tags: [Architecture, Astro]
---

> Fictional demo article: replace the files in `content/blog/` with your own.

# Why everything is a plugin

Most portfolio templates mix your content with their code. Updating the template then means merging your CV into
someone else's components. Here, the framework only knows plugins: sources load content, sections turn it into views,
and a theme draws them.

# Content owned by plugins

Each section owns the part of the content it shows and checks it. A typo in a date fails the build with the file and
the line, instead of producing an empty page.

```ts
plugins: [yamlSource(), corporate(), hero(), projects(), blog()],
```

# Shared shapes

Most sections are lists of dated entries, groups of keywords or quotes. A theme draws each shape once, and any new
section that uses one of them looks right in every theme.

# Lessons learned

Writing the contracts first took longer, but adding a section now takes an hour instead of a day.
