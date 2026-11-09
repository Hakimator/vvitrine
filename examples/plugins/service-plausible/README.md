# Example: a service plugin (`service-plausible`)

[Plausible Analytics](https://plausible.io): visit statistics without cookies, hosted in the European Union.

```ts
import plausible from './plugins/service-plausible/src/index.ts';

plugins: [/* ... */, plausible({ domain: 'jane.github.io' })],
```

- **Options:** `domain`, your site as registered in Plausible; `src`, the script address Plausible gives you, if it is
  not the default `https://plausible.io/js/script.js` (self-hosting, a proxy, or a newer snippet).
- **No consent banner:** Plausible states that it sets no cookie and stores nothing on the visitor's device (see its
  [data policy](https://plausible.io/data-policy)). The plugin declares `cookies: false`, so `@vvitrine/consent` does
  not show a banner for it. Whether that is enough where you live is your call; the privacy page lists the service in
  any case.
- **Privacy page:** what is collected (page, browser and device, country and city from the IP address, which is not
  stored) and where (EU), in French and English.

What it shows: a `ServicePlugin` that adds a tag to every page (`hooks.head`) and declares the data it handles
(`privacy`). Compare with `@vvitrine/analytics` (Google Analytics), which sets cookies and therefore requires consent
and waits for it. Tests: `test/service-plausible.test.ts`.
