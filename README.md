# VVitrine

**An open-source portfolio framework where everything is a plugin.** Describe your profile in YAML,
pick a theme, choose your sections, and deploy a fast, accessible, bilingual portfolio for free.

- **Content, not code.** Your resume lives in `site/content/` (JSON Resume compatible). You never edit framework code.
- **Everything is a plugin.** Data sources, sections, themes, services (SEO, analytics...) and generators (sitemap, PDF...) all use the same public API, built-ins included.
- **Multilingual.** French and English out of the box; add a language with one file.
- **Fast and accessible by default.** Static HTML, zero JavaScript, WCAG 2.2 AA checked in CI, Lighthouse 100.
- **Free hosting.** One push deploys to GitHub Pages; any static host works.

> VVitrine is pronounced "vitrine" (French for _shop window_), spelled with a double V.

## Quick start

1. Click **Use this template** on GitHub (or clone the repository).
2. Install [Node.js 22+](https://nodejs.org) and pnpm (`npm install -g pnpm`), then run `pnpm install`.
3. Run `pnpm dev` and open http://localhost:4321.
4. Edit `site/content/resume.fr.yaml` and `site/content/resume.en.yaml`, and `site/vvitrine.config.ts`.
5. Push to `main`. Enable **Settings > Pages > Source: GitHub Actions** once, and your site is live.

Full guide: [docs/getting-started.md](docs/getting-started.md).

## What you edit

```
site/
  vvitrine.config.ts   plugins, theme, pages, sections, texts
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
| [Configuration](docs/configuration.md)     | `vvitrine.config.ts` reference                                      |
| [Plugins](docs/plugins.md)                 | Use and write source, section, theme, service and generator plugins |
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
