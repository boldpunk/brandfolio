import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CloudProject, CloudProjectSummary, Me, ShareSettings, SharedBrandbook } from '@/cloud/contract';
import { createEmptyProject } from '@/domain/project';
import type { Project } from '@/domain/schema';
import { createApp } from './app';
import { runCli } from './cli';
import { readConfig } from './config';
import { Store } from './store';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

let dataDir: string;
let store: Store;
let clock: Date;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bf-server-'));
  store = new Store(dataDir);
  clock = new Date('2026-01-01T00:00:00Z');
  app = createApp({ store, adminEmails: new Set(['admin@example.com']), secureCookie: false, now: () => clock });
});

afterEach(() => {
  store.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

/** A browser-like client: keeps the session cookie and sends the CSRF header. */
function client(ip = '10.0.0.1') {
  let cookie = '';
  const call = async (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) => {
    const init: RequestInit = { method, headers: { 'X-Brandfolio': '1', 'X-Real-IP': ip, ...headers } };
    if (cookie) (init.headers as Record<string, string>).Cookie = cookie;
    if (body instanceof Uint8Array) init.body = new Uint8Array(body);
    else if (body !== undefined) {
      init.body = JSON.stringify(body);
      (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
    }
    const res = await app.request(url, init);
    const set = res.headers.get('Set-Cookie');
    if (set) {
      const value = set.split(';')[0] ?? '';
      cookie = value.endsWith('=') ? '' : value;
    }
    return res;
  };
  return {
    call,
    get: (url: string, headers?: Record<string, string>) => call('GET', url, undefined, headers),
    post: (url: string, body?: unknown) => call('POST', url, body),
    put: (url: string, body?: unknown, headers?: Record<string, string>) => call('PUT', url, body, headers),
    del: (url: string) => call('DELETE', url),
    register: (email: string, password = 'correct horse') =>
      call('POST', '/api/auth/register', { email, password, name: 'Test', locale: 'en' }),
  };
}

type Client = ReturnType<typeof client>;

function newProject(title = 'Brand'): Project {
  return createEmptyProject(title, 'editorial', new Date('2026-01-01T00:00:00Z'), 'en');
}

function withLogo(project: Project, assetId: string): Project {
  return {
    ...project,
    assetIds: [...project.assetIds, assetId],
    brand: { ...project.brand, logo: { ...project.brand.logo, variants: { ...project.brand.logo.variants, primary: assetId } } },
  };
}

async function putProject(c: Client, project: Project, baseRevision: number | null = null) {
  return c.put(`/api/projects/${project.id}`, { project, baseRevision });
}

async function upload(c: Client, id: string, projectId: string, bytes: Uint8Array, type = 'image/png') {
  return c.put(`/api/assets/${id}?project=${projectId}`, bytes, { 'Content-Type': type });
}

async function makeAdmin(): Promise<Client> {
  const admin = client('10.0.0.99');
  expect((await admin.register('admin@example.com')).status).toBe(201);
  return admin;
}

async function grant(email: string, plan: 'pro' | 'free', days: number | null = null) {
  const admin = await makeAdmin();
  const res = await admin.post('/api/admin/plan', { email, plan, days });
  expect(res.status).toBe(200);
  return (await res.json()) as Me;
}

describe('health and routing', () => {
  it('answers health and 404s unknown routes with ApiError JSON', async () => {
    expect(await (await app.request('/api/health')).json()).toEqual({ ok: true });
    const res = await app.request('/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ code: 'not_found' });
  });
});

describe('auth', () => {
  it('registers, reads me, logs out and logs in', async () => {
    const c = client();
    const res = await c.register('  Ann@Example.com ');
    expect(res.status).toBe(201);
    expect(res.headers.get('Set-Cookie')).toMatch(/bf_session=.+; Max-Age=2592000; Path=\/; HttpOnly; SameSite=Lax/);
    const me = (await res.json()) as Me;
    expect(me).toMatchObject({ email: 'ann@example.com', plan: 'free', planUntil: null, usage: { cloudProjects: 0 } });
    expect(me.entitlements.cloudProjects).toBe(1);

    expect(((await (await c.get('/api/me')).json()) as Me).id).toBe(me.id);
    expect((await c.post('/api/auth/logout')).status).toBe(204);
    expect((await c.get('/api/me')).status).toBe(401);

    const login = await c.post('/api/auth/login', { email: 'ANN@example.com', password: 'correct horse' });
    expect(login.status).toBe(200);
    expect((await c.get('/api/me')).status).toBe(200);
  });

  it('extends an active session and expires an idle one', async () => {
    const c = client();
    await c.register('slide@example.com');
    const day = 86_400_000;
    clock = new Date(clock.getTime() + 20 * day);
    const renewed = await c.get('/api/me');
    expect(renewed.status).toBe(200);
    expect(renewed.headers.get('Set-Cookie')).toContain('bf_session=');
    clock = new Date(clock.getTime() + 25 * day);
    expect((await c.get('/api/me')).status).toBe(200);
    clock = new Date(clock.getTime() + 31 * day);
    expect((await c.get('/api/me')).status).toBe(401);
  });

  it('marks the cookie Secure in production', async () => {
    const prod = createApp({ store, adminEmails: new Set(), secureCookie: true });
    const res = await prod.request('/api/auth/register', {
      method: 'POST',
      headers: { 'X-Brandfolio': '1', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'p@example.com', password: 'correct horse', name: '', locale: 'ru' }),
    });
    expect(res.headers.get('Set-Cookie')).toContain('Secure');
  });

  it('rejects a wrong password, a duplicate email and a weak password', async () => {
    const c = client();
    await c.register('bob@example.com');
    const wrong = await c.post('/api/auth/login', { email: 'bob@example.com', password: 'nope nope' });
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toMatchObject({ code: 'invalid_credentials' });
    const unknown = await c.post('/api/auth/login', { email: 'nobody@example.com', password: 'nope nope' });
    expect(await unknown.json()).toMatchObject({ code: 'invalid_credentials' });

    const dup = await client('10.0.0.2').register('BOB@example.com');
    expect(dup.status).toBe(409);
    expect(await dup.json()).toMatchObject({ code: 'email_taken' });

    const weak = await client('10.0.0.3').register('weak@example.com', 'short');
    expect(weak.status).toBe(400);
    expect(await weak.json()).toMatchObject({ code: 'weak_password' });
  });

  it('rate-limits repeated logins per IP and email', async () => {
    const c = client();
    await c.register('rl@example.com');
    let last: Response | undefined;
    for (let i = 0; i < 11; i++) last = await c.post('/api/auth/login', { email: 'rl@example.com', password: 'wrong pass' });
    expect(last?.status).toBe(429);
    expect(await last?.json()).toMatchObject({ code: 'rate_limited' });
    expect(last?.headers.get('Retry-After')).toBeTruthy();
    // Another IP is not affected.
    const other = await client('10.0.0.8').post('/api/auth/login', { email: 'rl@example.com', password: 'correct horse' });
    expect(other.status).toBe(200);
  });

  it('requires the CSRF header on mutations', async () => {
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'x@example.com', password: 'correct horse', name: 'X', locale: 'en' }),
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'forbidden' });
    expect(store.userByEmail('x@example.com')).toBeUndefined();
  });

  it('rejects bad JSON without leaking internals', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'X-Brandfolio': '1', 'Content-Type': 'application/json' },
      body: '{not json',
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.code).toBe('bad_request');
    expect(JSON.stringify(body)).not.toContain('at ');
  });
});

describe('projects', () => {
  it('puts, gets, lists and detects conflicts', async () => {
    const c = client();
    expect((await c.get('/api/projects')).status).toBe(401);
    await c.register('p@example.com');
    const project = newProject('Acme');

    const first = await putProject(c, project);
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ revision: 1, updatedAt: clock.toISOString() });

    const got = (await (await c.get(`/api/projects/${project.id}`)).json()) as CloudProject;
    expect(got).toMatchObject({ revision: 1, share: null });
    expect(got.project).toEqual(project);

    // A second device uploading as "first" conflicts; nothing is written.
    const stale = await putProject(c, { ...project, title: 'Other' }, null);
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ code: 'conflict', details: { revision: 1 } });

    clock = new Date('2026-01-02T00:00:00Z');
    const second = await putProject(c, { ...project, title: 'Acme 2' }, 1);
    expect(await second.json()).toMatchObject({ revision: 2 });
    expect((await putProject(c, project, 1)).status).toBe(409);

    const list = (await (await c.get('/api/projects')).json()) as CloudProjectSummary[];
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: project.id, title: 'Acme 2', revision: 2, templateId: 'editorial', language: 'en' });
    expect(list[0]?.palette).toEqual(project.brand.colors.map((col) => col.hex));

    expect(((await (await c.get('/api/me')).json()) as Me).usage.cloudProjects).toBe(1);
  });

  it('validates the document and the URL id', async () => {
    const c = client();
    await c.register('v@example.com');
    const project = newProject();
    const bad = await putProject(c, { ...project, title: '' });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ code: 'bad_request' });
    const mismatch = await c.put('/api/projects/other_id', { project, baseRevision: null });
    expect(mismatch.status).toBe(400);
  });

  it('enforces the free plan limit and lifts it after an admin grant', async () => {
    const c = client();
    await c.register('free@example.com');
    expect((await putProject(c, newProject('One'))).status).toBe(200);
    const over = await putProject(c, newProject('Two'));
    expect(over.status).toBe(403);
    expect(await over.json()).toMatchObject({ code: 'plan_limit' });

    const me = await grant('free@example.com', 'pro', 10);
    expect(me).toMatchObject({ plan: 'pro', planUntil: '2026-01-11T00:00:00.000Z' });
    expect(me.entitlements.cloudProjects).toBeNull();
    expect((await putProject(c, newProject('Two'))).status).toBe(200);
    expect((await putProject(c, newProject('Three'))).status).toBe(200);

    // After the end date the plan reads as free again: existing projects stay, new ones are refused.
    clock = new Date('2026-01-20T00:00:00Z');
    expect(await (await c.get('/api/me')).json()).toMatchObject({ plan: 'free', planUntil: null, usage: { cloudProjects: 3 } });
    expect((await putProject(c, newProject('Four'))).status).toBe(403);
  });

  it('lets only admins grant plans', async () => {
    const c = client();
    await c.register('user@example.com');
    const res = await c.post('/api/admin/plan', { email: 'user@example.com', plan: 'pro', days: null });
    expect(res.status).toBe(403);
    const admin = await makeAdmin();
    expect((await admin.post('/api/admin/plan', { email: 'ghost@example.com', plan: 'pro', days: null })).status).toBe(404);
    const lifetime = await admin.post('/api/admin/plan', { email: 'user@example.com', plan: 'pro', days: null });
    expect(await lifetime.json()).toMatchObject({ plan: 'pro', planUntil: null });
  });

  it('requires referenced assets and deletes a project with its assets', async () => {
    const c = client();
    await c.register('a@example.com');
    const project = withLogo(newProject(), 'logo1');
    const missing = await putProject(c, project);
    expect(missing.status).toBe(400);
    expect(await missing.json()).toMatchObject({ code: 'bad_request', details: { missingAssets: ['logo1'] } });

    expect((await upload(c, 'logo1', project.id, PNG)).status).toBe(204);
    expect((await putProject(c, project)).status).toBe(200);

    expect((await c.del(`/api/projects/${project.id}`)).status).toBe(204);
    expect((await c.get(`/api/projects/${project.id}`)).status).toBe(404);
    expect((await c.call('HEAD', '/api/assets/logo1')).status).toBe(404);
    expect((await c.del(`/api/projects/${project.id}`)).status).toBe(404);
  });
});

describe('assets', () => {
  it('stores, serves and heads assets with safe headers', async () => {
    const c = client();
    await c.register('img@example.com');
    expect((await upload(c, 'a1', 'p1', PNG)).status).toBe(204);
    expect((await upload(c, 'a1', 'p1', PNG)).status).toBe(204); // idempotent

    const res = await c.get('/api/assets/a1');
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Content-Security-Policy')).toBe("default-src 'none'; style-src 'unsafe-inline'; sandbox");
    expect(res.headers.get('Cache-Control')).toBe('private, no-cache');

    expect((await c.call('HEAD', '/api/assets/a1')).status).toBe(200);
    expect((await c.call('HEAD', '/api/assets/zz')).status).toBe(404);
    expect(fs.existsSync(path.join(dataDir, 'assets', store.userByEmail('img@example.com')!.id, 'a1'))).toBe(true);
  });

  it('sniffs types and accepts SVG, JPEG and fonts', async () => {
    const c = client();
    await c.register('sniff@example.com');
    const mismatch = await upload(c, 'x', 'p', JPEG, 'image/png');
    expect(mismatch.status).toBe(415);
    expect(await mismatch.json()).toMatchObject({ code: 'unsupported_type' });
    expect((await upload(c, 'x', 'p', new TextEncoder().encode('<html></html>'), 'text/html')).status).toBe(415);
    expect((await upload(c, 'x', 'p', new TextEncoder().encode('<html></html>'), 'image/svg+xml')).status).toBe(415);
    expect((await upload(c, 'j', 'p', JPEG, 'image/jpeg')).status).toBe(204);
    expect((await upload(c, 's', 'p', SVG, 'image/svg+xml; charset=utf-8')).status).toBe(204);
    expect((await upload(c, 't', 'p', new Uint8Array([0, 1, 0, 0, 0, 9]), 'font/ttf')).status).toBe(204);
    expect((await upload(c, 'o', 'p', new TextEncoder().encode('OTTO\0\0'), 'font/otf')).status).toBe(204);
  });

  it('rejects files over 5 MiB and requires a project', async () => {
    const c = client();
    await c.register('big@example.com');
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set(PNG);
    const res = await upload(c, 'big', 'p', big);
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ code: 'too_large' });
    expect((await c.put('/api/assets/a', PNG, { 'Content-Type': 'image/png' })).status).toBe(400);
  });

  it('hides assets from other users', async () => {
    const owner = client('10.0.0.1');
    await owner.register('owner@example.com');
    await upload(owner, 'mine', 'p', PNG);
    const other = client('10.0.0.2');
    expect((await other.get('/api/assets/mine')).status).toBe(401);
    await other.register('other@example.com');
    expect((await other.get('/api/assets/mine')).status).toBe(404);
    expect((await other.call('HEAD', '/api/assets/mine')).status).toBe(404);
  });
});

describe('sharing', () => {
  async function sharedSetup() {
    const c = client();
    await c.register('share@example.com');
    const project = withLogo(newProject('Shared'), 'logo');
    await upload(c, 'logo', project.id, PNG);
    await upload(c, 'secret', project.id, PNG);
    expect((await putProject(c, project)).status).toBe(200);
    return { c, project };
  }

  it('enables, reads publicly and disables a share link', async () => {
    const { c, project } = await sharedSetup();
    const res = await c.put(`/api/projects/${project.id}/share`, { enabled: true });
    const share = (await res.json()) as ShareSettings;
    expect(share).toMatchObject({ enabled: true, hasPassword: false });
    expect(share.slug).toMatch(/^[A-Za-z0-9_-]{10}$/);
    expect(share.url).toContain(share.slug);

    const summary = ((await (await c.get('/api/projects')).json()) as CloudProjectSummary[])[0];
    expect(summary?.share).toEqual(share);

    const pub = await app.request(`/api/share/${share.slug}`);
    expect(pub.status).toBe(200);
    const book = (await pub.json()) as SharedBrandbook;
    expect(book).toMatchObject({ badge: true, updatedAt: clock.toISOString() });
    expect(book.project.id).toBe(project.id);

    const asset = await app.request(`/api/share/${share.slug}/assets/logo`);
    expect(asset.status).toBe(200);
    expect(asset.headers.get('Cache-Control')).toBe('public, max-age=300');
    // Assets of the owner that the project does not reference stay private.
    expect((await app.request(`/api/share/${share.slug}/assets/secret`)).status).toBe(404);

    const off = (await (await c.put(`/api/projects/${project.id}/share`, { enabled: false })).json()) as ShareSettings;
    expect(off).toMatchObject({ slug: share.slug, enabled: false });
    expect((await app.request(`/api/share/${share.slug}`)).status).toBe(404);
    expect((await app.request(`/api/share/${share.slug}/assets/logo`)).status).toBe(404);
  });

  it('keeps passwords for Pro and hides the badge', async () => {
    const { c, project } = await sharedSetup();
    const denied = await c.put(`/api/projects/${project.id}/share`, { enabled: true, password: 'open sesame' });
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ code: 'plan_limit' });

    await grant('share@example.com', 'pro', null);
    const res = await c.put(`/api/projects/${project.id}/share`, { enabled: true, password: 'пароль 1' });
    const share = (await res.json()) as ShareSettings;
    expect(share.hasPassword).toBe(true);

    const locked = await app.request(`/api/share/${share.slug}`);
    expect(locked.status).toBe(401);
    expect(await locked.json()).toMatchObject({ code: 'unauthorized', details: { passwordRequired: true } });
    const wrong = await app.request(`/api/share/${share.slug}`, { headers: { 'X-Share-Password': 'nope' } });
    expect(wrong.status).toBe(401);
    const encoded = encodeURIComponent('пароль 1');
    const ok = await app.request(`/api/share/${share.slug}`, { headers: { 'X-Share-Password': encoded } });
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as SharedBrandbook).badge).toBe(false);

    expect((await app.request(`/api/share/${share.slug}/assets/logo`)).status).toBe(401);
    const asset = await app.request(`/api/share/${share.slug}/assets/logo`, { headers: { 'X-Share-Password': encoded } });
    expect(asset.status).toBe(200);
    expect(asset.headers.get('Cache-Control')).toBe('private, no-cache');

    // Omitting the password keeps it; "" removes it.
    expect(((await (await c.put(`/api/projects/${project.id}/share`, { enabled: true })).json()) as ShareSettings).hasPassword).toBe(true);
    const cleared = (await (await c.put(`/api/projects/${project.id}/share`, { enabled: true, password: '' })).json()) as ShareSettings;
    expect(cleared).toMatchObject({ slug: share.slug, hasPassword: false });
    expect((await app.request(`/api/share/${share.slug}`)).status).toBe(200);
  });

  it('404s unknown slugs and other users’ projects', async () => {
    const { project } = await sharedSetup();
    expect((await app.request('/api/share/AAAAAAAAAA')).status).toBe(404);
    const other = client('10.0.0.5');
    await other.register('someone@example.com');
    expect((await other.put(`/api/projects/${project.id}/share`, { enabled: true })).status).toBe(404);
  });
});

describe('cli', () => {
  it('grants a plan straight in the database', async () => {
    await client().register('cli@example.com');
    const config = { ...readConfig({}), dataDir };
    const { log, error } = console;
    console.log = console.error = () => {};
    try {
      expect(runCli(['grant', 'CLI@example.com', 'pro', '10'], config)).toBe(0);
      expect(runCli(['grant', 'ghost@example.com', 'pro'], config)).toBe(1);
      expect(runCli(['grant', 'cli@example.com', 'gold'], config)).toBe(2);
    } finally {
      console.log = log;
      console.error = error;
    }
    const me = (await (await client('10.0.0.3').post('/api/auth/login', { email: 'cli@example.com', password: 'correct horse' })).json()) as Me;
    // The CLI counts days from the real current time.
    expect(me.plan).toBe('pro');
    expect(Date.parse(me.planUntil ?? '')).toBeGreaterThan(Date.now() + 9 * 86_400_000);
  });
});
