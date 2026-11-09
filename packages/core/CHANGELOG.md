# @vvitrine/core

## 1.0.0

### Major Changes

- 0333ef5: First stable release. The plugin API (source, section, theme, service and generator plugins, view kinds, page and
  render contexts), the configuration and the content format are now covered by semantic versioning: a breaking change
  to any of them needs a new major version.

### Minor Changes

- ed5e219: Generated reference. `docs/reference.md` (every configuration, content and option field) and
  `docs/content.schema.json` (for editors that check YAML as you type) are generated from the schemas with
  `pnpm reference`, and a test fails when they are out of date. `@vvitrine/core` exports `ConfigSchema`, and the schemas
  now describe their fields.
- 89d0992: Analytics with consent. New `@vvitrine/consent`: a banner with equal Accept and Refuse buttons, shown only when a plugin
  in use sets cookies, a choice remembered for 6 months, and "Manage cookies" in the footer. New `@vvitrine/analytics`
  with `ga4()`: Google Analytics 4 loaded only after the visitor accepts, advertising features off, cookies kept under 13
  months, cookies removed on refusal, and listed on the privacy page. Plugins can add footer links (`hooks.footerLinks`).
- c3c5dd3: New `@vvitrine/contact` package: a contact section with a plain HTML form (no JavaScript, nothing sent until the visitor
  presses "Send") delivered through Web3Forms by default, a honeypot against spam, a privacy notice, a "Message sent"
  page, and the e-mail address as a fallback. Other providers implement the small `ContactProvider` interface. Sections
  now receive the absolute site URL (`ctx.siteUrl`).
- 604893b: Light/dark switch. Themes can offer it with `colorSchemeToggle: true` (`corporate({ colorSchemeToggle: true })`): a
  header button, remembered per visitor and applied before the page is drawn, through a 1 KB inline script. The design
  tokens now honour `data-color-scheme` on `<html>` and set `color-scheme`, and the layout receives `colorScheme`. Off by
  default, so pages keep zero JavaScript.
- f9534af: The e-mail address is no longer written plainly in the pages. New `protectEmail()` in `@vvitrine/core` returns a
  percent-encoded `mailto:` link and the visible text with hidden decoy parts, so harvesters miss it while visitors still
  see, click, copy and hear the real address, without JavaScript. `HeroView.email` and `ContactView.email` now use this
  shape (breaking for custom themes that drew `email.address`).
- 8c0714c: Sticky site header with one link per section, generated from the configured pages. Sections can be hidden from it with
  `nav: false`. On small screens the links are in a menu that works without JavaScript. Layouts now receive `siteName` and
  `nav`.
- a815a94: The hero shows `basics.image` (or the person's initials) and calls to action: "Download CV (PDF)" with the new `cv`
  option, and "Contact me" (an e-mail link by default, or the `contact` option). New `ctx.asset()` resolves files from
  `public/` with the base path; project images now use it, which fixes local images on sites served under a sub-path.
- 2fdad94: Optimised images: the new `@vvitrine/images` plugin serves local images as responsive WebP variants with their real
  size, generated at build time. `ctx.image()` gives sections and themes `{ src, srcset, width, height }`; themes load
  the hero photo first and the other images lazily.
- 8dbb9ab: Portfolio extras: `testimonials`, key figures (`stats`, new `figures` view kind) and `timeline`, which merges work,
  education and volunteering with your own milestones. Pages without a hero now get their title as main heading
  (`PageContext.heading`, `SectionPlugin.pageHeading`), rendered by both themes.
- 0eff61b: Privacy page generated from the plugins. Plugins declare the visitor data they handle with `privacy(ctx)` (service,
  purpose, when, data, retention, location, cookies, terms), and the new `privacy` section lists them with the host and
  the person responsible. Pages with `footer: true` are linked from the footer (`nav.footer`) instead of the header. Both
  themes now have a footer with these links and a copyright line. The contact form declares what it sends to Web3Forms.
- a81ebf1: Printable resume and PDF. New `@vvitrine/resume-pdf` generator: an A4, tagged PDF of your resume page in each
  language, built from the same data. Both themes print on A4 without navigation or buttons, and printing always uses the
  light colours. Generators now receive each route's `page` and section views. The hero's `cv` option accepts `{locale}`.
- 1d44e87: Every JSON Resume section is now built in: volunteer, awards, certificates, publications, interests and references join
  work, education, skills, languages and projects. New view kinds (`entries`, `tags`, `quotes`) let a theme draw any
  section that returns one of these shapes, so new sections need no theme component. Breaking for custom themes: the work,
  education and skills views now use the shared `entries` and `tags` shapes.
- e790d6b: Filter projects by technology. `projects({ tags: true })` adds one page per technology, and the `filter: true` option
  shows links to them, so filtering works without JavaScript; when every project is on the page, themes filter in place
  with a 1 KB inline script. `projects({ path })` sets the page that "All projects" links lead to. Route contributions can
  now ask the layout for their main heading (`heading`). The Bold header fits eight links on one line.
