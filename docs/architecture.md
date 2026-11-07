# Architecture (for contributors)

The full design dossier (requirements, UML diagrams, decision records) lives in the project report. This page is the
short version.

## Layers

```
site/ (user)            vvitrine.config.ts, content/, plugins/, public/
packages/astro          composition root: loads the config, injects routes, renders the kernel output
themes/*                theme plugins (Astro components)
packages/sections, seo, source-*  plugins
packages/core           kernel: plugin contracts, registry, content pipeline, i18n, tokens, routes. Framework-free.
```

Dependencies point inward only; `pnpm boundaries` enforces it.

## Build flow

1. Astro starts; `@vvitrine/astro` resolves `vvitrine.config.ts` and injects two routes (pages, generated files).
2. The kernel validates the config and registers plugins (API version, uniqueness, one theme, capabilities, content ownership).
3. For each locale: sources load raw content, `contentLoaded` hooks run, each key is validated by its owner.
4. Pages and plugin-contributed routes are resolved; each section presents a view model; components are picked
   (theme, then the plugin default, then the theme fallback).
5. `head` and `bodyEnd` hooks run for every page; generators produce extra files.
6. Astro renders the layout and components to static HTML.

## Key decisions

- Everything is a plugin, built-ins included (microkernel).
- Each content key is owned and validated by one plugin; the core only owns `basics`.
- Users never write pages: routes are injected, so user folders contain no framework code.
- Exactly one theme per build (Astro bundles the CSS of every imported component).
- All visible strings come from plugin message catalogs; users can override any of them.
