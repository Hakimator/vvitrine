import type { ContentChange, DevContext, DevEndpoint, Plugin } from '@vvitrine/core';
import { studioPage } from './page.ts';
import { newToken, sameToken } from './token.ts';

/** Where the Studio answers (a development endpoint folder, US-153). */
export const STUDIO_PATH = '/__vvitrine/studio/';
/** The header that carries the token. A custom header: other sites cannot send it without asking the server first. */
export const TOKEN_HEADER = 'x-vvitrine-studio-token';

const SECURITY_HEADERS = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'cross-origin-resource-policy': 'same-origin',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...SECURITY_HEADERS },
  });
const problem = (status: number, message: string) => json({ error: message }, status);

/**
 * The local Studio (ADR-015, US-133): edit the site from `pnpm dev`, with no account. It is a plugin like any other:
 * remove `studio()` from the plugins, and every Studio route is gone. Builds never contain it (development endpoints).
 *
 * Its page opens at http://localhost:4321/__vvitrine/studio/. Its API needs the token of this run, which only the
 * Studio's page receives: on top of the development server's own checks (localhost, same-site pages only), a page of
 * another site cannot use the API even through a request the browser sends without an origin.
 */
export default function studio(): Plugin {
  const token = newToken();

  /** The API: what the Studio's page asks, with the token. */
  const api: Record<
    string,
    { method: 'GET' | 'POST'; answer: (request: Request, ctx: DevContext) => Promise<Response> }
  > = {
    model: { method: 'GET', answer: async (_request, { site }) => json(site.editingModel()) },
    content: {
      method: 'GET',
      answer: async (request, { site }) => {
        const locale = new URL(request.url).searchParams.get('locale') ?? site.locales[0]!;
        if (!site.locales.includes(locale)) return problem(400, `Unknown language "${locale}".`);
        return json(await site.readContent(locale));
      },
    },
    check: {
      method: 'POST',
      answer: async (request, { site }) => {
        const body = (await request.json()) as { locale?: string; content?: Record<string, unknown> };
        if (!body.locale || !site.locales.includes(body.locale) || typeof body.content !== 'object') {
          return problem(400, 'Send { locale, content }.');
        }
        return json({ issues: await site.checkContent(body.locale, body.content) });
      },
    },
    save: {
      method: 'POST',
      answer: async (request, { site }) => {
        const body = (await request.json()) as { locale?: string; changes?: ContentChange[] };
        if (!body.locale || !site.locales.includes(body.locale) || !Array.isArray(body.changes)) {
          return problem(400, 'Send { locale, changes }.');
        }
        return json(await site.saveContent(body.locale, body.changes));
      },
    },
  };

  const page: DevEndpoint = {
    path: STUDIO_PATH,
    handle: async (request, { site }) => {
      if (new URL(request.url).pathname !== STUDIO_PATH) return problem(404, 'No such Studio page.');
      if (request.method !== 'GET') return problem(405, 'The Studio page answers GET only.');
      const nonce = newToken().slice(0, 32);
      const [locale] = site.locales;
      const html = studioPage({
        token,
        nonce,
        locales: site.locales,
        model: site.editingModel(),
        written: await site.readContent(locale!),
      });
      return new Response(html, {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'content-security-policy': `default-src 'none'; style-src 'nonce-${nonce}'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
          ...SECURITY_HEADERS,
        },
      });
    },
  };

  const endpoints: DevEndpoint[] = Object.entries(api).map(([name, { method, answer }]) => ({
    path: `${STUDIO_PATH}api/${name}`,
    handle: async (request, ctx) => {
      if (!sameToken(token, request.headers.get(TOKEN_HEADER))) {
        return problem(403, 'The Studio API needs the token of this run: open the Studio page again.');
      }
      if (request.method !== method) return problem(405, `Use ${method}.`);
      try {
        return await answer(request, ctx);
      } catch (error) {
        // Invalid content, an impossible change, a read-only source: the Studio shows the message.
        return problem(error instanceof SyntaxError ? 400 : 422, (error as Error).message);
      }
    },
  }));

  return {
    name: '@vvitrine/studio',
    kind: 'service',
    apiVersion: 1,
    provides: ['studio'],
    hooks: { devEndpoints: () => [page, ...endpoints] },
  };
}
