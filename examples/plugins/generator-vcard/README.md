# Example: a generator plugin (`generator-vcard`)

Writes `contact.vcf`, a contact card (vCard 4.0) that phones and address books import in one tap: your name, title,
e-mail address, site and profile links, taken from the hero of your home page.

```ts
import vcard from './plugins/generator-vcard/src/index.ts';

plugins: [/* ... */, vcard()],
```

Then link `/contact.vcf` from your site, for example as a profile link in your content
(`profiles: [{ network: 'vCard', url: 'https://jane.github.io/contact.vcf' }]`).

- **Options:** `file` (default `contact.vcf`) and `page` (the page whose hero gives the details, default `/`). The
  default language is used.
- **Format:** RFC 6350, with text escaped, long lines folded at 75 octets and CRLF line endings, so strict readers
  accept it.

What it shows: a `GeneratorPlugin` reads what the pages show (`routes[].sections[].view`) without depending on the
section plugins, and returns files. The e-mail address, protected in the pages, is written plainly here: a card is
meant to be read, and only people who choose to download it get it. Tests: `test/generator-vcard.test.ts`.
