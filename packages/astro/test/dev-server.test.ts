import { PassThrough } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';
import { refusal, send, toRequest } from '../src/dev-server.ts';

describe('development endpoints in the dev server', () => {
  it('answer this computer only, and pages of this site only', () => {
    expect(refusal('localhost:4321', undefined)).toBeUndefined();
    expect(refusal('127.0.0.1:4321', 'http://127.0.0.1:4321')).toBeUndefined();
    expect(refusal('[::1]:4321', undefined)).toBeUndefined();
    // DNS rebinding: another site's name pointed at this computer.
    expect(refusal('evil.example:4321', undefined)).toBe('development endpoints answer on localhost only');
    // A server reachable from the network (astro dev --host).
    expect(refusal('192.168.1.20:4321', undefined)).toBe('development endpoints answer on localhost only');
    expect(refusal(undefined, undefined)).toBe('development endpoints answer on localhost only');
    // Another site open in the same browser.
    expect(refusal('localhost:4321', 'https://evil.example')).toBe(
      'development endpoints answer pages of this site only',
    );
    expect(refusal('localhost:4321', 'http://localhost:9999')).toBe(
      'development endpoints answer pages of this site only',
    );
  });

  it('turn a Node request into a standard Request, with its body', async () => {
    const stream = new PassThrough();
    const req = Object.assign(stream, {
      method: 'POST',
      url: '/__vvitrine/studio/save?locale=en',
      headers: { host: 'localhost:4321', 'content-type': 'application/json', 'x-list': ['a', 'b'] },
    }) as unknown as IncomingMessage;
    stream.end('{"changes":[]}');
    const request = await toRequest(req);
    expect(request.url).toBe('http://localhost:4321/__vvitrine/studio/save?locale=en');
    expect(request.method).toBe('POST');
    expect(request.headers.get('content-type')).toBe('application/json');
    expect(request.headers.get('x-list')).toBe('a, b');
    expect(await request.json()).toEqual({ changes: [] });
  });

  it('send a standard Response through Node', async () => {
    const sent: { status?: number; headers: Record<string, string>; body?: string } = { headers: {} };
    const res = {
      set statusCode(status: number) {
        sent.status = status;
      },
      setHeader: (name: string, value: string) => (sent.headers[name] = value),
      end: (body: Buffer) => (sent.body = body.toString()),
    } as unknown as ServerResponse;
    await send(res, Response.json({ ok: true }, { status: 201 }));
    expect(sent).toEqual({ status: 201, headers: { 'content-type': 'application/json' }, body: '{"ok":true}' });
  });
});
