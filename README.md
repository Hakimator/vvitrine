# VVitrine

**An open-source portfolio framework where everything is a plugin.** Describe your profile in YAML,
pick a theme, choose your sections, and deploy a fast, accessible, bilingual portfolio for free.

- **Content, not code.** Your resume lives in `site/content/` (JSON Resume compatible). You never edit framework code.
- **Everything is a plugin.** Data sources, sections, themes, services (SEO, analytics...) and generators (sitemap, PDF...) all use the same public API, built-ins included.
- **Multilingual.** French and English out of the box; add a language with one file.
- **Fast and accessible by default.** Static HTML and zero JavaScript unless you turn on a feature that needs it
  (each adds a small inline script, only where used). WCAG 2.2 AA and Lighthouse 95+ are checked in CI.
- **Private by default.** No cookie and no third-party request until a visitor chooses; the privacy page writes itself
  from the plugins you install.
- **Free hosting.** One push deploys to GitHub Pages; any static host works.

## What a portfolio gets

|                |                                                                                                                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Resume**     | Every JSON Resume section (experience, education, skills, languages, certificates, awards, volunteering, publications, interests, references), a timeline, key figures and testimonials |
| **Projects**   | Cards, a page per project written in Markdown, a technology filter, optimised images                                                                                                    |
| **Writing**    | A blog with reading time, tags and a table of contents                                                                                                                                  |
| **Recruiters** | A printable resume page and an accessible PDF CV in each language, generated at build time                                                                                              |
| **Contact**    | A form that works without JavaScript (Web3Forms), and an e-mail address hidden from spam bots                                                                                           |
| **Sharing**    | SEO tags, sitemap, and a generated share picture for social networks                                                                                                                    |
| **Privacy**    | A generated privacy page; optional Google Analytics behind a consent banner, or a cookie-free tool (Plausible example)                                                                  |
| **Look**       | Two themes (Corporate and Bold), design tokens, automatic dark mode and an optional switch                                                                                              |

> VVitrine is pronounced "vitrine" (French for _shop window_), spelled with a double V.

## Quick start

1. Click **Use this template** on GitHub (or clone the repository).
2. Install [Node.js 22+](https://nodejs.org) and pnpm (`npm install -g pnpm`), then run `pnpm install`.
3. Run `pnpm dev` and open http://localhost:4321.
4. Edit `site/content/resume.fr.yaml` and `site/content/resume.en.yaml`, and `site/site.yaml` (pages, texts, colours).
5. Push to `main`. Enable **Settings > Pages > Source: GitHub Actions** once, and your site is live.

Full guide: [docs/getting-started.md](docs/getting-started.md).

## What you edit

```
site/
  site.yaml            languages, pages and their sections, theme, texts, colours (plain data)
  vvitrine.config.ts   plugins
  content/             your resume and projects (YAML or JSON, one file per language)
  plugins/             your own plugins (optional)
  public/              images, favicon, CNAME
```

Everything else (`packages/`, `themes/`) is the framework.

## Documentation

| Topic                                      |                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------- |
| [Getting started](docs/getting-started.md) | Install, run, deploy                                                |
| [Writing content](docs/content.md)         | Resume format, projects, languages                                  |
| [Configuration](docs/configuration.md)     | `site.yaml` and `vvitrine.config.ts` guide                          |
| [Reference](docs/reference.md)             | Every configuration, content and option field, from the schemas     |
| [Plugins](docs/plugins.md)                 | Use and write source, section, theme, service and generator plugins |
| [Example plugins](examples/plugins/)       | One small, tested plugin of each kind, to copy                      |
| [Themes](docs/themes.md)                   | Switch theme, design tokens, write a theme                          |
| [Deployment](docs/deployment.md)           | GitHub Pages, Cloudflare, Netlify, Vercel, any host                 |
| [Upgrading](docs/upgrading.md)             | Get framework updates without conflicts                             |
| [Architecture](docs/architecture.md)       | For contributors                                                    |

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

The framework is licensed under the [GNU AGPL v3.0 or later](LICENSE), with an [additional permission](LICENSE-EXCEPTION.md)
for your content and the sites you generate.

- **Your portfolio is yours.** Your content and the generated website can be published under any terms, with no
  obligation to share anything.
- **The framework stays open.** Anyone who modifies VVitrine and distributes it, or offers it as an online service,
  must share the modified source under the same licence.
