/**
 * The Brandfolio API (see src/cloud/contract.ts). Everything is under /api;
 * nginx serves the web app and proxies /api here.
 */
import type { IncomingMessage } from 'node:http';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import {
  API_PREFIX,
  ASSET_MAX_BYTES,
  CSRF_HEADER,
  ENTITLEMENTS,
  PASSWORD_MIN,
  PLANS,
  type CloudProject,
  type CloudProjectSummary,
  type Me,
  type PutProjectResult,
  type ShareSettings,
  type SharedBrandbook,
} from '@/cloud/contract';
import { idSchema, projectSchema, type Project } from '@/domain/schema';
import { LOCALES } from '@/i18n/locales';
import { normalizeEmail } from './config';
import { ApiException } from './errors';
import { RateLimiter } from './rateLimit';
import {
  hashPassword,
  newSessionToken,
  newShareSlug,
  newUserId,
  sha256Hex,
  verifyAgainstDummy,
  verifyPassword,
} from './security';
import { bytesMatchType, isAssetType } from './sniff';
import { effectivePlan, type AssetRow, type ProjectRow, type Store, type UserRow } from './store';

export type AppDeps = {
  store: Store;
  adminEmails: Set<string>;
  /** Adds `Secure` to the session cookie (production, behind HTTPS). */
  secureCookie: boolean;
  now?: () => Date;
  /** Log sink for unexpected errors; console.error by default. */
  logError?: (error: unknown) => void;
};

type Env = {
  Bindings: { incoming?: IncomingMessage };
  Variables: { user: UserRow | null; sessionHash: string | null };
};
type Ctx = Context<Env>;

export const SESSION_COOKIE = 'bf_session';
const SESSION_TTL_MS = 30 * 86_400_000;
const JSON_MAX_BYTES = 3 * 1024 * 1024;
const ASSET_BODY_MAX_BYTES = 8 * 1024 * 1024;
const SHARE_PASSWORD_HEADER = 'X-Share-Password';
const SHARE_PASSWORD_MAX = 200;

const ASSET_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

// ---------------------------------------------------------------- request bodies

const registerSchema = z.object({
  email: z.string().max(254),
  password: z.string(),
  name: z.string().max(200),
  locale: z.enum(LOCALES).catch('ru'),
});
const loginSchema = z.object({ email: z.string().max(254), password: z.string().max(1000) });
const putProjectSchema = z.object({ project: z.unknown(), baseRevision: z.number().int().min(0).nullable() });
const putShareSchema = z.object({
  enabled: z.boolean(),
  password: z.string().max(SHARE_PASSWORD_MAX).nullable().optional(),
});
const adminPlanSchema = z.object({
  email: z.string().max(254),
  plan: z.enum(PLANS),
  days: z.number().int().positive().max(36_500).nullable(),
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createApp(deps: AppDeps) {
  const { store } = deps;
  const now = deps.now ?? (() => new Date());
  const logError = deps.logError ?? ((error: unknown) => console.error(error));
  const authLimiter = new RateLimiter(10, 15 * 60_000, () => now().getTime());
  const sharePasswordLimiter = new RateLimiter(20, 15 * 60_000, () => now().getTime());

  const app = new Hono<Env>().basePath(API_PREFIX);

  const setSessionCookie = (c: Ctx, token: string) =>
    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'Lax',
      secure: deps.secureCookie,
      path: '/',
      maxAge: SESSION_TTL_MS / 1000,
    });

  // ---------------------------------------------------------------- middleware

  app.use('*', async (c, next) => {
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) && c.req.header(CSRF_HEADER) !== '1') {
      throw new ApiException('forbidden', `Missing ${CSRF_HEADER} header`);
    }
    await next();
  });

  // Asset uploads carry raw bytes; everything else is small JSON.
  const tooLarge = (c: Ctx) => c.json(new ApiException('too_large', 'Request body too large').toJSON(), 413);
  app.use('/assets/*', bodyLimit({ maxSize: ASSET_BODY_MAX_BYTES, onError: tooLarge }));
  app.use('*', async (c, next) => {
    if (c.req.path.startsWith(`${API_PREFIX}/assets/`)) return next();
    return bodyLimit({ maxSize: JSON_MAX_BYTES, onError: tooLarge })(c, next);
  });

  // Resolve the session cookie once per request; an old session gets a fresh cookie.
  app.use('*', async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE);
    const sessionHash = token ? sha256Hex(token) : null;
    const session = sessionHash ? store.sessionUser(sessionHash, now(), SESSION_TTL_MS) : undefined;
    c.set('sessionHash', sessionHash);
    c.set('user', session?.user ?? null);
    if (token && session?.renewed) setSessionCookie(c, token);
    await next();
  });

  app.onError((error, c) => {
    if (error instanceof ApiException) {
      for (const [name, value] of Object.entries(error.headers ?? {})) c.header(name, value);
      return c.json(error.toJSON(), error.status as 400);
    }
    logError(error);
    return c.json({ code: 'server_error', message: 'Internal server error' }, 500);
  });

  app.notFound((c) => c.json({ code: 'not_found', message: `No route for ${c.req.method} ${c.req.path}` }, 404));

  // ---------------------------------------------------------------- helpers

  const requireUser = (c: Ctx): UserRow => {
    const user = c.get('user');
    if (!user) throw new ApiException('unauthorized', 'Sign in required');
    return user;
  };

  const clientIp = (c: Ctx): string =>
    c.req.header('X-Real-IP') ??
    c.req.header('X-Forwarded-For')?.split(',').pop()?.trim() ??
    c.env?.incoming?.socket?.remoteAddress ??
    'unknown';

  const limit = (limiter: RateLimiter, key: string) => {
    const retryAfter = limiter.hit(key);
    if (retryAfter > 0) {
      throw new ApiException('rate_limited', 'Too many attempts', { retryAfter }, { 'Retry-After': String(retryAfter) });
    }
  };

  const startSession = (c: Ctx, user: UserRow) => {
    const token = newSessionToken();
    store.createSession(sha256Hex(token), user.id, now(), SESSION_TTL_MS);
    setSessionCookie(c, token);
  };

  const me = (user: UserRow): Me => store.me(user, now());

  const shareSettings = (row: ProjectRow): ShareSettings | null =>
    row.share_slug
      ? {
          slug: row.share_slug,
          enabled: row.share_enabled === 1,
          hasPassword: row.share_password_hash !== null,
          url: `/b/${row.share_slug}`,
        }
      : null;

  const param = (c: Ctx, name: string): string => {
    const value = c.req.param(name);
    if (!value || !idSchema.safeParse(value).success) throw new ApiException('not_found', `Invalid ${name}`);
    return value;
  };

  // ---------------------------------------------------------------- health

  app.get('/health', (c) => c.json({ ok: true }));

  // ---------------------------------------------------------------- auth

  app.post('/auth/register', async (c) => {
    const body = await readJson(c, registerSchema);
    const email = normalizeEmail(body.email);
    if (!EMAIL_RE.test(email)) throw new ApiException('bad_request', 'Invalid email', { field: 'email' });
    limit(authLimiter, `register:${clientIp(c)}:${email}`);
    if (body.password.length < PASSWORD_MIN || body.password.length > 1000) {
      throw new ApiException('weak_password', `Password must be at least ${PASSWORD_MIN} characters`, {
        min: PASSWORD_MIN,
      });
    }
    if (store.userByEmail(email)) throw new ApiException('email_taken', 'Email already registered');
    const passwordHash = await hashPassword(body.password);
    const user: UserRow = {
      id: newUserId(),
      email,
      name: body.name.trim(),
      locale: body.locale,
      password_hash: passwordHash,
      plan: 'free',
      plan_until: null,
      created_at: now().toISOString(),
    };
    try {
      store.run(
        `INSERT INTO users (id, email, name, locale, password_hash, plan, plan_until, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        user.id,
        user.email,
        user.name,
        user.locale,
        user.password_hash,
        user.plan,
        user.plan_until,
        user.created_at,
      );
    } catch (error) {
      // Two registrations raced past the check above.
      if (store.userByEmail(email)) throw new ApiException('email_taken', 'Email already registered');
      throw error;
    }
    startSession(c, user);
    return c.json(me(user), 201);
  });

  app.post('/auth/login', async (c) => {
    const body = await readJson(c, loginSchema);
    const email = normalizeEmail(body.email);
    const key = `login:${clientIp(c)}:${email}`;
    limit(authLimiter, key);
    const user = store.userByEmail(email);
    if (!user) {
      await verifyAgainstDummy(body.password);
      throw new ApiException('invalid_credentials', 'Wrong email or password');
    }
    if (!(await verifyPassword(body.password, user.password_hash))) {
      throw new ApiException('invalid_credentials', 'Wrong email or password');
    }
    authLimiter.reset(key);
    startSession(c, user);
    return c.json(me(user));
  });

  app.post('/auth/logout', (c) => {
    const sessionHash = c.get('sessionHash');
    if (sessionHash) store.deleteSession(sessionHash);
    deleteCookie(c, SESSION_COOKIE, { path: '/', secure: deps.secureCookie, httpOnly: true, sameSite: 'Lax' });
    return c.body(null, 204);
  });

  app.get('/me', (c) => c.json(me(requireUser(c))));

  // ---------------------------------------------------------------- projects

  app.get('/projects', (c) => {
    const user = requireUser(c);
    const list: CloudProjectSummary[] = store.projects(user.id).map((row) => {
      const project = JSON.parse(row.doc) as Project;
      return {
        id: row.id,
        title: project.title,
        revision: row.revision,
        updatedAt: row.updated_at,
        templateId: project.templateId,
        language: project.language,
        palette: project.brand.colors.map((color) => color.hex),
        share: shareSettings(row),
      };
    });
    return c.json(list);
  });

  app.get('/projects/:id', (c) => {
    const user = requireUser(c);
    const row = store.project(user.id, param(c, 'id'));
    if (!row) throw new ApiException('not_found', 'Project not found');
    const result: CloudProject = {
      project: JSON.parse(row.doc) as Project,
      revision: row.revision,
      updatedAt: row.updated_at,
      share: shareSettings(row),
    };
    return c.json(result);
  });

  app.put('/projects/:id', async (c) => {
    const user = requireUser(c);
    const id = param(c, 'id');
    const body = await readJson(c, putProjectSchema);
    const parsed = projectSchema.safeParse(body.project);
    if (!parsed.success) {
      throw new ApiException('bad_request', 'Invalid project document', {
        issues: parsed.error.issues.slice(0, 20).map((issue) => ({ path: issue.path, message: issue.message })),
      });
    }
    const project = parsed.data;
    if (project.id !== id) throw new ApiException('bad_request', 'Project id does not match the URL');

    // Synchronous from here on, so no other request interleaves between the checks and the write.
    const existing = store.project(user.id, id);
    if (existing && existing.revision !== body.baseRevision) {
      throw new ApiException('conflict', 'Project changed in the cloud', { revision: existing.revision });
    }
    // No cloud copy (first upload, or deleted on another device): any baseRevision creates it anew.
    if (!existing) {
      const max = ENTITLEMENTS[effectivePlan(user, now())].cloudProjects;
      const used = store.countProjects(user.id);
      if (max !== null && used >= max) {
        throw new ApiException('plan_limit', 'Cloud project limit reached', { limit: max, used });
      }
    }
    const stored = store.assetIdsOf(user.id);
    const missingAssets = project.assetIds.filter((assetId) => !stored.has(assetId));
    if (missingAssets.length > 0) {
      throw new ApiException('bad_request', 'Upload the project assets first', { missingAssets });
    }

    const revision = (existing?.revision ?? 0) + 1;
    const updatedAt = now().toISOString();
    const doc = JSON.stringify(project);
    if (existing) {
      store.run(
        'UPDATE projects SET doc = ?, revision = ?, updated_at = ? WHERE user_id = ? AND id = ?',
        doc,
        revision,
        updatedAt,
        user.id,
        id,
      );
    } else {
      store.run(
        'INSERT INTO projects (user_id, id, doc, revision, updated_at) VALUES (?, ?, ?, ?, ?)',
        user.id,
        id,
        doc,
        revision,
        updatedAt,
      );
    }
    const result: PutProjectResult = { revision, updatedAt };
    return c.json(result);
  });

  app.delete('/projects/:id', (c) => {
    const user = requireUser(c);
    if (!store.deleteProject(user.id, param(c, 'id'))) throw new ApiException('not_found', 'Project not found');
    return c.body(null, 204);
  });

  // ---------------------------------------------------------------- sharing

  app.put('/projects/:id/share', async (c) => {
    const user = requireUser(c);
    const id = param(c, 'id');
    const body = await readJson(c, putShareSchema);
    const row = store.project(user.id, id);
    if (!row) throw new ApiException('not_found', 'Project not found');

    let passwordHash = row.share_password_hash;
    if (body.password === '' || body.password === null) {
      passwordHash = null;
    } else if (body.password !== undefined) {
      if (!ENTITLEMENTS[effectivePlan(user, now())].sharePassword) {
        throw new ApiException('plan_limit', 'Share passwords need Pro');
      }
      passwordHash = await hashPassword(body.password);
    }
    const slug = row.share_slug ?? uniqueSlug(store);
    store.run(
      'UPDATE projects SET share_slug = ?, share_enabled = ?, share_password_hash = ? WHERE user_id = ? AND id = ?',
      slug,
      body.enabled ? 1 : 0,
      passwordHash,
      user.id,
      id,
    );
    return c.json(shareSettings(store.project(user.id, id) as ProjectRow));
  });

  /** The enabled shared project for a slug, after the password check. */
  const openShare = async (c: Ctx): Promise<ProjectRow> => {
    const slug = c.req.param('slug') ?? '';
    const row = /^[A-Za-z0-9_-]{10}$/.test(slug) ? store.projectBySlug(slug) : undefined;
    if (!row || row.share_enabled !== 1) throw new ApiException('not_found', 'Share link not found');
    if (row.share_password_hash) {
      const sent = c.req.header(SHARE_PASSWORD_HEADER);
      if (!sent) throw new ApiException('unauthorized', 'Password required', { passwordRequired: true });
      limit(sharePasswordLimiter, `share:${clientIp(c)}:${slug}`);
      if (!(await sharePasswordMatches(sent, row.share_password_hash))) {
        throw new ApiException('unauthorized', 'Wrong password', { passwordRequired: true });
      }
    }
    return row;
  };

  app.get('/share/:slug', async (c) => {
    const row = await openShare(c);
    const owner = store.userById(row.user_id);
    const result: SharedBrandbook = {
      project: JSON.parse(row.doc) as Project,
      badge: owner ? ENTITLEMENTS[effectivePlan(owner, now())].shareBadge : true,
      updatedAt: row.updated_at,
    };
    return c.json(result);
  });

  app.get('/share/:slug/assets/:assetId', async (c) => {
    const row = await openShare(c);
    const assetId = param(c, 'assetId');
    const referenced = (JSON.parse(row.doc) as Project).assetIds.includes(assetId);
    const asset = referenced ? store.asset(row.user_id, assetId) : undefined;
    if (!asset) throw new ApiException('not_found', 'Asset not found');
    const cache = row.share_password_hash ? 'private, no-cache' : 'public, max-age=300';
    return sendAsset(c, store, asset, cache);
  });

  // ---------------------------------------------------------------- assets

  app.put('/assets/:id', async (c) => {
    const user = requireUser(c);
    const id = param(c, 'id');
    const projectId = c.req.query('project');
    if (!projectId || !idSchema.safeParse(projectId).success) {
      throw new ApiException('bad_request', 'Query parameter project is required');
    }
    const type = (c.req.header('Content-Type') ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
    if (!isAssetType(type)) throw new ApiException('unsupported_type', `Unsupported type ${type || '(none)'}`);
    const declared = Number(c.req.header('Content-Length') ?? 0);
    if (declared > ASSET_MAX_BYTES) throw new ApiException('too_large', 'Asset over 5 MiB', { max: ASSET_MAX_BYTES });
    const bytes = new Uint8Array(await c.req.arrayBuffer());
    if (bytes.length > ASSET_MAX_BYTES) throw new ApiException('too_large', 'Asset over 5 MiB', { max: ASSET_MAX_BYTES });
    if (bytes.length === 0) throw new ApiException('bad_request', 'Empty body');
    if (!bytesMatchType(bytes, type)) throw new ApiException('unsupported_type', `Bytes are not ${type}`);
    store.saveAsset(
      { user_id: user.id, id, project_id: projectId, mime: type, size: bytes.length, sha256: sha256Hex(bytes) },
      bytes,
      now(),
    );
    return c.body(null, 204);
  });

  // Hono answers HEAD with this GET handler and drops the body.
  app.get('/assets/:id', (c) => {
    const user = requireUser(c);
    const asset = store.asset(user.id, param(c, 'id'));
    if (!asset) throw new ApiException('not_found', 'Asset not found');
    return sendAsset(c, store, asset, 'private, no-cache');
  });

  // ---------------------------------------------------------------- admin

  app.post('/admin/plan', async (c) => {
    const user = requireUser(c);
    if (!deps.adminEmails.has(user.email)) throw new ApiException('forbidden', 'Admins only');
    const body = await readJson(c, adminPlanSchema);
    const email = normalizeEmail(body.email);
    if (!store.grantPlan(email, body.plan, body.days, now())) throw new ApiException('not_found', 'No such user');
    return c.json(me(store.userByEmail(email) as UserRow));
  });

  return app;
}

// ---------------------------------------------------------------- shared helpers

async function readJson<T>(c: Ctx, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new ApiException('bad_request', 'Body must be JSON');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiException('bad_request', 'Invalid request body', {
      issues: parsed.error.issues.slice(0, 20).map((issue) => ({ path: issue.path, message: issue.message })),
    });
  }
  return parsed.data;
}

function sendAsset(c: Ctx, store: Store, asset: AssetRow, cacheControl: string): Response {
  const etag = `"${asset.sha256}"`;
  const headers = {
    'Content-Type': asset.mime,
    'Cache-Control': cacheControl,
    'Content-Security-Policy': ASSET_CSP,
    'X-Content-Type-Options': 'nosniff',
    ETag: etag,
  };
  if (c.req.header('If-None-Match') === etag) return c.body(null, 304, headers);
  if (c.req.method === 'HEAD') {
    return c.body(null, 200, { ...headers, 'Content-Length': String(asset.size) });
  }
  const bytes = store.readAsset(asset.user_id, asset.id);
  if (!bytes) throw new ApiException('not_found', 'Asset file missing');
  return c.body(new Uint8Array(bytes), 200, headers);
}

function uniqueSlug(store: Store): string {
  for (;;) {
    const slug = newShareSlug();
    if (!store.projectBySlug(slug)) return slug;
  }
}

/** Browsers cannot put non-Latin-1 text in a header, so a percent-encoded password is accepted too. */
async function sharePasswordMatches(sent: string, hash: string): Promise<boolean> {
  if (await verifyPassword(sent, hash)) return true;
  let decoded: string;
  try {
    decoded = decodeURIComponent(sent);
  } catch {
    return false;
  }
  return decoded !== sent && verifyPassword(decoded, hash);
}
