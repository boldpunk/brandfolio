/**
 * Typed client for the Brandfolio API (see contract.ts). Every call either
 * resolves with the documented body or throws CloudError, whose `code` is an
 * ApiErrorCode from the server or one of two client-side codes:
 * - `network`: the request never got an HTTP answer (offline, DNS, reset);
 * - `unavailable`: something answered, but not the API (static hosting that
 *   serves index.html for /api, a dev proxy without the server behind it).
 */
import type { Project } from '@/domain/schema';
import {
  API_PREFIX,
  CSRF_HEADER,
  type AdminPlanBody,
  type ApiError,
  type ApiErrorCode,
  type CloudProject,
  type CloudProjectSummary,
  type LoginBody,
  type Me,
  type PutProjectResult,
  type PutShareBody,
  type RegisterBody,
  type ShareSettings,
  type SharedBrandbook,
} from './contract';

export type CloudErrorCode = ApiErrorCode | 'network' | 'unavailable';

const API_CODES: ReadonlySet<string> = new Set<ApiErrorCode>([
  'bad_request',
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'email_taken',
  'invalid_credentials',
  'weak_password',
  'rate_limited',
  'plan_limit',
  'too_large',
  'unsupported_type',
  'server_error',
]);

export class CloudError extends Error {
  readonly code: CloudErrorCode;
  /** HTTP status, 0 when there was no response. */
  readonly status: number;
  readonly details: Record<string, unknown>;
  constructor(code: CloudErrorCode, status: number, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'CloudError';
    this.code = code;
    this.status = status;
    this.details = details;
  }

  /** Worth retrying later without the user changing anything. */
  get transient(): boolean {
    return this.code === 'network' || this.code === 'unavailable' || this.code === 'server_error' || this.code === 'rate_limited' || this.status >= 500;
  }
}

export function isCloudError(error: unknown, code?: CloudErrorCode): error is CloudError {
  return error instanceof CloudError && (code === undefined || error.code === code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Status codes whose meaning is clear even without an ApiError body. */
const STATUS_CODES: Record<number, ApiErrorCode> = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  409: 'conflict',
  413: 'too_large',
  415: 'unsupported_type',
  429: 'rate_limited',
};

/**
 * Turns a non-2xx response into CloudError. A JSON ApiError body wins; a body
 * that is not the API's JSON means we are not talking to the API at all,
 * except for statuses only the API would send.
 */
export function toCloudError(status: number, contentType: string | null, body: string, head = false): CloudError {
  // HEAD answers carry no body: only the status speaks.
  if (head) {
    const code = status === 404 ? 'not_found' : STATUS_CODES[status];
    return code ? new CloudError(code, status, `HTTP ${status}`) : new CloudError('unavailable', status, `HTTP ${status}`);
  }
  if (contentType?.includes('application/json')) {
    try {
      const parsed: unknown = JSON.parse(body);
      if (isRecord(parsed) && typeof parsed.code === 'string' && API_CODES.has(parsed.code)) {
        const error = parsed as ApiError;
        return new CloudError(error.code, status, typeof error.message === 'string' ? error.message : error.code, isRecord(error.details) ? error.details : {});
      }
    } catch {
      // Fall through: malformed JSON is treated like any foreign answer.
    }
  }
  const known = STATUS_CODES[status];
  if (known && contentType?.includes('application/json')) return new CloudError(known, status, `HTTP ${status}`);
  if (status === 404 || status === 405 || status >= 500 || !contentType?.includes('application/json')) {
    return new CloudError('unavailable', status, `HTTP ${status} from a server that is not the Brandfolio API`);
  }
  return new CloudError(known ?? 'server_error', status, `HTTP ${status}`);
}

type Fetch = typeof globalThis.fetch;
type RequestOptions = { json?: unknown; body?: Blob; headers?: Record<string, string>; signal?: AbortSignal };
type Method = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE';

const enc = encodeURIComponent;

export function createCloudApi(fetchImpl: Fetch = (...args) => globalThis.fetch(...args), prefix: string = API_PREFIX) {
  async function send(method: Method, path: string, options: RequestOptions = {}): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
    if (method !== 'GET' && method !== 'HEAD') headers[CSRF_HEADER] = '1';
    let body: BodyInit | undefined;
    if (options.json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.json);
    } else if (options.body) {
      headers['Content-Type'] = options.body.type || 'application/octet-stream';
      body = options.body;
    }
    let response: Response;
    try {
      response = await fetchImpl(prefix + path, { method, headers, body, credentials: 'same-origin', cache: 'no-store', signal: options.signal });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      throw new CloudError('network', 0, error instanceof Error ? error.message : String(error));
    }
    if (!response.ok) {
      const text = method === 'HEAD' ? '' : await response.text().catch(() => '');
      throw toCloudError(response.status, response.headers.get('Content-Type'), text, method === 'HEAD');
    }
    return response;
  }

  async function json<T>(method: Method, path: string, options?: RequestOptions): Promise<T> {
    const response = await send(method, path, options);
    if (!response.headers.get('Content-Type')?.includes('application/json')) {
      // e.g. a static host answering /api/me with index.html and 200.
      throw new CloudError('unavailable', response.status, 'Expected JSON from the API');
    }
    try {
      return (await response.json()) as T;
    } catch {
      throw new CloudError('unavailable', response.status, 'Malformed JSON from the API');
    }
  }

  async function empty(method: Method, path: string, options?: RequestOptions): Promise<void> {
    await send(method, path, options);
  }

  async function bytes(path: string, headers?: Record<string, string>): Promise<Blob> {
    const response = await send('GET', path, { headers: { Accept: '*/*', ...headers } });
    return response.blob();
  }

  // Header values must be ByteStrings: the password travels percent-encoded (the server decodes it).
  const shareHeaders = (password?: string | null): Record<string, string> | undefined =>
    password ? { 'X-Share-Password': encodeURIComponent(password) } : undefined;

  return {
    // auth
    me: () => json<Me>('GET', '/me'),
    register: (body: RegisterBody) => json<Me>('POST', '/auth/register', { json: body }),
    login: (body: LoginBody) => json<Me>('POST', '/auth/login', { json: body }),
    logout: () => empty('POST', '/auth/logout'),

    // projects
    listProjects: () => json<CloudProjectSummary[]>('GET', '/projects'),
    getProject: (id: string) => json<CloudProject>('GET', `/projects/${enc(id)}`),
    putProject: (project: Project, baseRevision: number | null) =>
      json<PutProjectResult>('PUT', `/projects/${enc(project.id)}`, { json: { project, baseRevision } }),
    deleteProject: (id: string) => empty('DELETE', `/projects/${enc(id)}`),

    // assets
    /** True when the asset is stored for this user. */
    hasAsset: async (id: string): Promise<boolean> => {
      try {
        await send('HEAD', `/assets/${enc(id)}`);
        return true;
      } catch (error) {
        if (isCloudError(error, 'not_found')) return false;
        throw error;
      }
    },
    putAsset: (id: string, projectId: string, blob: Blob) => empty('PUT', `/assets/${enc(id)}?project=${enc(projectId)}`, { body: blob }),
    getAsset: (id: string) => bytes(`/assets/${enc(id)}`),

    // sharing
    putShare: (projectId: string, body: PutShareBody) => json<ShareSettings>('PUT', `/projects/${enc(projectId)}/share`, { json: body }),
    getShared: (slug: string, password?: string | null) => json<SharedBrandbook>('GET', `/share/${enc(slug)}`, { headers: shareHeaders(password) }),
    getSharedAsset: (slug: string, assetId: string, password?: string | null) =>
      bytes(`/share/${enc(slug)}/assets/${enc(assetId)}`, shareHeaders(password)),

    // admin
    adminSetPlan: (body: AdminPlanBody) => json<Me>('POST', '/admin/plan', { json: body }),
  };
}

export type CloudApi = ReturnType<typeof createCloudApi>;

/** The app-wide client. */
export const cloudApi: CloudApi = createCloudApi();
