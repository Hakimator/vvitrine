# Deployment

`pnpm build` produces a static site in `site/dist/`. Any static host can serve it.

| Setting     | Meaning                                                                                                    |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| `SITE_URL`  | Absolute URL of the site, e.g. `https://jane.dev`. Enables canonical URLs, hreflang and the sitemap.       |
| `BASE_PATH` | Sub-path when the site is not at the domain root, e.g. `/vvitrine` for `https://user.github.io/vvitrine/`. |

## GitHub Pages (default)

1. Push to `main`.
2. Once: **Settings > Pages > Source: GitHub Actions**.

`.github/workflows/deploy.yml` sets `SITE_URL` and `BASE_PATH` from the Pages configuration. Custom domain: add it in
Settings > Pages and put a `CNAME` file containing the domain in `site/public/`.

The free plan requires a public repository and forbids commercial/e-commerce use (a portfolio is fine).

## Cloudflare Pages

Build command `pnpm build`, output directory `site/dist`, environment variable `SITE_URL=https://<your-domain>`.
Free plan: unlimited static bandwidth, preview deployments for pull requests.

## Netlify / Vercel

Same build command and output directory. Note: Vercel's free (Hobby) plan is for non-commercial use only; Netlify's free
plan is credit-based and pauses sites when credits run out.

## Any server

Copy `site/dist/` to the web root (Nginx, Caddy, Apache, S3...). Directory URLs end with `/` and map to `index.html`.
