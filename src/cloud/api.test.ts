import { describe, expect, it, vi } from 'vitest';
import { CloudError, createCloudApi, isCloudError, toCloudError } from './api';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

function fakeFetch(respond: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    return respond(url, init);
  });
  return { api: createCloudApi(fetch as typeof globalThis.fetch), calls };
}

const header = (init: RequestInit, name: string) => new Headers(init.headers).get(name);

describe('toCloudError', () => {
  it('uses the ApiError code and details from a JSON body', () => {
    const error = toCloudError(409, 'application/json', JSON.stringify({ code: 'conflict', message: 'stale', details: { revision: 7 } }));
    expect(error).toBeInstanceOf(CloudError);
    expect(error).toMatchObject({ code: 'conflict', status: 409, message: 'stale', details: { revision: 7 } });
  });

  it('treats answers that are not the API as unavailable', () => {
    expect(toCloudError(404, 'text/html', '<!doctype html>').code).toBe('unavailable');
    expect(toCloudError(502, 'text/plain', 'Bad gateway').code).toBe('unavailable');
    expect(toCloudError(500, null, '').code).toBe('unavailable');
    expect(toCloudError(401, 'text/html', 'login page').code).toBe('unavailable');
  });

  it('falls back to the status for JSON without a known code', () => {
    expect(toCloudError(429, 'application/json', '{"error":"slow down"}').code).toBe('rate_limited');
    expect(toCloudError(413, 'application/json', '{"code":"nope"}').code).toBe('too_large');
    expect(toCloudError(401, 'application/json', 'not json').code).toBe('unauthorized');
  });

  it('maps HEAD statuses without a body', () => {
    expect(toCloudError(404, null, '', true).code).toBe('not_found');
    expect(toCloudError(401, null, '', true).code).toBe('unauthorized');
    expect(toCloudError(502, null, '', true).code).toBe('unavailable');
  });

  it('marks network and server trouble as transient, refusals not', () => {
    expect(new CloudError('network', 0, '').transient).toBe(true);
    expect(new CloudError('server_error', 500, '').transient).toBe(true);
    expect(new CloudError('rate_limited', 429, '').transient).toBe(true);
    expect(new CloudError('conflict', 409, '').transient).toBe(false);
    expect(new CloudError('plan_limit', 403, '').transient).toBe(false);
  });
});

describe('createCloudApi', () => {
  it('sends the CSRF header on mutations only, with same-origin credentials', async () => {
    const me = { id: 'u1', email: 'a@b.c', name: 'A' };
    const { api, calls } = fakeFetch((url) => (url.endsWith('/me') ? json(200, me) : json(200, me)));
    await api.me();
    await api.login({ email: 'a@b.c', password: 'secret123' });
    expect(calls[0]!.url).toBe('/api/me');
    expect(header(calls[0]!.init, 'X-Brandfolio')).toBeNull();
    expect(calls[0]!.init.credentials).toBe('same-origin');
    expect(calls[1]!.init.method).toBe('POST');
    expect(header(calls[1]!.init, 'X-Brandfolio')).toBe('1');
    expect(header(calls[1]!.init, 'Content-Type')).toBe('application/json');
    expect(JSON.parse(String(calls[1]!.init.body))).toEqual({ email: 'a@b.c', password: 'secret123' });
  });

  it('throws typed errors from ApiError bodies', async () => {
    const { api } = fakeFetch(() => json(401, { code: 'unauthorized', message: 'signed out' }));
    const error = await api.me().catch((e: unknown) => e);
    expect(isCloudError(error, 'unauthorized')).toBe(true);
  });

  it('reports a static host that answers /api with index.html as unavailable', async () => {
    const { api } = fakeFetch(() => new Response('<!doctype html><html></html>', { status: 200, headers: { 'Content-Type': 'text/html' } }));
    await expect(api.me()).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('reports a failed connection as network', async () => {
    const { api } = fakeFetch(() => {
      throw new TypeError('Failed to fetch');
    });
    await expect(api.listProjects()).rejects.toMatchObject({ code: 'network', status: 0 });
  });

  it('uploads asset bytes with their MIME type and encodes IDs', async () => {
    const { api, calls } = fakeFetch(() => new Response(null, { status: 204 }));
    await api.putAsset('a_1', 'p 1', new Blob(['<svg/>'], { type: 'image/svg+xml' }));
    expect(calls[0]!.url).toBe('/api/assets/a_1?project=p%201');
    expect(calls[0]!.init.method).toBe('PUT');
    expect(header(calls[0]!.init, 'Content-Type')).toBe('image/svg+xml');
    expect(header(calls[0]!.init, 'X-Brandfolio')).toBe('1');
    expect(calls[0]!.init.body).toBeInstanceOf(Blob);
  });

  it('answers hasAsset from HEAD', async () => {
    const { api } = fakeFetch((url) => new Response(null, { status: url.endsWith('/yes') ? 200 : 404 }));
    expect(await api.hasAsset('yes')).toBe(true);
    expect(await api.hasAsset('no')).toBe(false);
  });

  it('sends the share password header, percent-encoded, when given', async () => {
    const { api, calls } = fakeFetch(() => json(200, { project: {}, badge: true, updatedAt: '' }));
    await api.getShared('slug', 'пароль 1');
    await api.getShared('slug');
    expect(header(calls[0]!.init, 'X-Share-Password')).toBe('%D0%BF%D0%B0%D1%80%D0%BE%D0%BB%D1%8C%201');
    expect(header(calls[1]!.init, 'X-Share-Password')).toBeNull();
  });
});
