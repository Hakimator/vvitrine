import type { IncomingMessage, ServerResponse } from 'node:http';

/** The development endpoints' folder (see `DevEndpoint` in @vvitrine/core). */
export const DEV_PREFIX = '/__vvitrine/';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Why a request to a development endpoint is refused, or undefined when it may go on (SEC-15).
 * - Its Host must be this computer: a page on another site that points its own domain at 127.0.0.1 (DNS rebinding)
 *   sends its own host name and is refused.
 * - When the browser says which page sent it (Origin), that page must be on the same host: other sites open in the
 *   same browser cannot use the endpoints.
 * A server started with `--host` (reachable from the network) therefore refuses them too.
 */
export function refusal(host: string | undefined, origin: string | undefined): string | undefined {
  const name = host?.replace(/:\d+$/, '');
  if (!name || !LOCAL_HOSTS.has(name)) return 'development endpoints answer on localhost only';
  if (origin !== undefined && origin !== `http://${host}`)
    return 'development endpoints answer pages of this site only';
  return undefined;
}

/** A Node request as a standard Request (body read for methods that have one). */
export async function toRequest(req: IncomingMessage): Promise<Request> {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }
  const method = req.method ?? 'GET';
  let body: ArrayBuffer | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const all = Buffer.concat(chunks);
    body = all.buffer.slice(all.byteOffset, all.byteOffset + all.byteLength) as ArrayBuffer;
  }
  return new Request(`http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`, {
    method,
    headers,
    ...(body ? { body } : {}),
  });
}

/** Send a standard Response through Node's response. */
export async function send(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, name) => res.setHeader(name, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}
