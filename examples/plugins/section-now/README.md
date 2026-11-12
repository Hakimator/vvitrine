# Example: a section plugin (`section-now`)

A "now" section: what you are doing at the moment, and when you last updated it (the idea comes from
[nownownow.com](https://nownownow.com/about)).

```ts
import now from './plugins/section-now/src/index.ts';

plugins: [/* ... */, now()],
// site.yaml: pages: [{ path: /, sections: [hero, { id: now, options: { limit: 3 } }, projects] }]
```

```yaml
# content/content.en.yaml
now:
  updated: 2026-11
  items:
    - text: Looking for a six-month internship from February 2027
    - text: Writing a plugin-based portfolio framework
      details: Astro, TypeScript, accessibility tests in CI
```

What it shows:

- **Owned content:** the section owns the `now` key and validates it with its zod schema; a mistake gives a clear
  build error naming the file and the field.
- **Options and messages:** `title` and `limit`, and its texts in French and English.
- **Shared view kind:** it returns an `entries` view (`EntriesView` from `@vvitrine/core`), so every theme draws it,
  including themes written before it existed. A theme can still give it its own look with a `now` component.

- **Editing in the Studio:** its form comes from the schema. `editor` adds two things: list items are named by their
  `text`, and the `updated` month uses the plugin's own control, `<now-month>` (`src/month-input.browser.ts`). It is a
  custom element (a `value` property and a `change` event), so the plugin does not depend on the Studio's UI library.

Tests: `test/section-now.test.ts` builds a site with the kernel and checks the view in both languages, the form the
Studio gets, and the `<now-month>` element.
