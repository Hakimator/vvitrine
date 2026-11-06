import type { GeneratorPlugin, HeadTag, PageContext, ServicePlugin } from '@vvitrine/core';

/**
 * Service plugin: meta description, Open Graph, canonical URL, hreflang alternates and a
 * JSON-LD `Person`. Absolute URLs need the site URL (set by the deploy workflow via SITE_URL).
 */
export function seo(): ServicePlugin {
  return {
    name: '@vvitrine/seo',
    kind: 'service',
    apiVersion: 1,
    hooks: { head: headTags },
  };
}

function headTags(ctx: PageContext): HeadTag[] {
  const { basics, siteUrl } = ctx;
  const description = basics.summary ?? [basics.name, basics.label].filter(Boolean).join(' – ');
  const tags: HeadTag[] = [
    { tag: 'meta', attrs: { name: 'description', content: description } },
    { tag: 'meta', attrs: { property: 'og:type', content: 'profile' } },
    { tag: 'meta', attrs: { property: 'og:title', content: ctx.title } },
    { tag: 'meta', attrs: { property: 'og:description', content: description } },
    { tag: 'meta', attrs: { property: 'og:locale', content: ctx.locale } },
  ];
  if (siteUrl) {
    const absolute = (href: string) => new URL(href, `${siteUrl}/`).href;
    const self = ctx.alternates.find((a) => a.locale === ctx.locale)?.href ?? ctx.url(ctx.path);
    tags.push({ tag: 'link', attrs: { rel: 'canonical', href: absolute(self) } });
    tags.push({ tag: 'meta', attrs: { property: 'og:url', content: absolute(self) } });
    for (const alternate of ctx.alternates) {
      tags.push({
        tag: 'link',
        attrs: { rel: 'alternate', hreflang: alternate.locale, href: absolute(alternate.href) },
      });
    }
    const fallback = ctx.alternates.find((a) => a.locale === ctx.defaultLocale);
    if (fallback)
      tags.push({ tag: 'link', attrs: { rel: 'alternate', hreflang: 'x-default', href: absolute(fallback.href) } });
  }
  if (ctx.path === '/' || /^\/[a-z]{2}(-[A-Z]{2})?\/$/.test(ctx.path)) {
    const person = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: basics.name,
      ...(basics.label ? { jobTitle: basics.label } : {}),
      ...(siteUrl ? { url: siteUrl } : {}),
      sameAs: basics.profiles.flatMap((p) => (p.url ? [p.url] : [])),
    };
    tags.push({ tag: 'script', attrs: { type: 'application/ld+json' }, content: JSON.stringify(person) });
  }
  return tags;
}

let warnedMissingUrl = false;

/** Generator plugin: sitemap.xml and robots.txt. Skipped (with one warning) without a site URL. */
export function sitemap(): GeneratorPlugin {
  return {
    name: '@vvitrine/sitemap',
    kind: 'generator',
    apiVersion: 1,
    generate: async ({ siteUrl, routes, base: basePath }) => {
      const sitemapHref = `${basePath}sitemap.xml`;
      if (!siteUrl) {
        if (!warnedMissingUrl) {
          console.warn(
            '[vvitrine] sitemap skipped: SITE_URL is not set (it is set automatically by the deploy workflow).',
          );
          warnedMissingUrl = true;
        }
        return [{ path: '/robots.txt', contents: 'User-agent: *\nAllow: /\n' }];
      }
      const base = new URL(`${siteUrl}/`);
      const urls = routes
        .map((r) => new URL(r.href, base).href)
        .map((loc) => `  <url><loc>${loc}</loc></url>`)
        .join('\n');
      return [
        {
          path: '/sitemap.xml',
          contents: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
        },
        { path: '/robots.txt', contents: `User-agent: *\nAllow: /\nSitemap: ${new URL(sitemapHref, base).href}\n` },
      ];
    },
  };
}
