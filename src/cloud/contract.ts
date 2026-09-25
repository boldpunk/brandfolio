/**
 * HTTP contract between the web app and the Brandfolio API (server/).
 * Everything lives under /api on the same origin; the session is an
 * HttpOnly cookie. Mutating requests must send `X-Brandfolio: 1` (a custom
 * header a cross-site form cannot add) and JSON bodies unless noted.
 *
 * Errors: non-2xx responses carry `ApiError` JSON. `code` is stable and the
 * client maps it to a translated message; `message` is English, for logs.
 */
import type { Locale } from '@/i18n/locales';
import type { Project } from '@/domain/schema';

export const API_PREFIX = '/api';
export const CSRF_HEADER = 'X-Brandfolio';

export type ApiErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'email_taken'
  | 'invalid_credentials'
  | 'weak_password'
  | 'rate_limited'
  | 'plan_limit'
  | 'too_large'
  | 'unsupported_type'
  | 'server_error';

export type ApiError = { code: ApiErrorCode; message: string; details?: Record<string, unknown> };

// ------------------------------------------------------------------ plans

export const PLANS = ['free', 'pro'] as const;
export type Plan = (typeof PLANS)[number];

/** What a plan allows. The server enforces these; the client only explains them. */
export type Entitlements = {
  /** Projects stored in the cloud; null = unlimited. */
  cloudProjects: number | null;
  /** Public share links show a "Made with Brandfolio" badge. */
  shareBadge: boolean;
  sharePassword: boolean;
  customFonts: boolean;
  premiumTemplates: boolean;
  /** Exported PDF carries a small "Made with Brandfolio" line. */
  pdfFooter: boolean;
  /** Download the generated media kit (social images, covers, favicons, palettes). */
  mediaKit: boolean;
};

export const ENTITLEMENTS: Record<Plan, Entitlements> = {
  free: { cloudProjects: 1, shareBadge: true, sharePassword: false, customFonts: false, premiumTemplates: false, pdfFooter: true, mediaKit: false },
  pro: { cloudProjects: null, shareBadge: false, sharePassword: true, customFonts: true, premiumTemplates: true, pdfFooter: false, mediaKit: true },
};

// ------------------------------------------------------------------ auth

export const PASSWORD_MIN = 8;

/** POST /api/auth/register */
export type RegisterBody = { email: string; password: string; name: string; locale: Locale };
/** POST /api/auth/login */
export type LoginBody = { email: string; password: string };
/** POST /api/auth/logout → 204 */

/** GET /api/me → 200 Me, or 401 when signed out. Register and login also return Me. */
export type Me = {
  id: string;
  email: string;
  name: string;
  plan: Plan;
  /** ISO date when a paid plan ends; null for free or lifetime grants. */
  planUntil: string | null;
  entitlements: Entitlements;
  usage: { cloudProjects: number };
};

// ------------------------------------------------------------------ projects

/** GET /api/projects → CloudProjectSummary[] (newest first) */
export type CloudProjectSummary = {
  id: string;
  title: string;
  revision: number;
  updatedAt: string;
  templateId: Project['templateId'];
  language: Locale;
  /** Colors for the card preview. */
  palette: string[];
  share: ShareSettings | null;
};

/** GET /api/projects/:id → CloudProject */
export type CloudProject = { project: Project; revision: number; updatedAt: string; share: ShareSettings | null };

/**
 * PUT /api/projects/:id → { revision, updatedAt }
 * `baseRevision` is the cloud revision the client last saw (null for the first
 * upload). A mismatch returns 409 `conflict` with details.revision; nothing is
 * written. All assets the project references must already be uploaded
 * (400 `bad_request` with details.missingAssets otherwise). A new project over
 * the plan's cloudProjects limit returns 403 `plan_limit`.
 */
export type PutProjectBody = { project: Project; baseRevision: number | null };
export type PutProjectResult = { revision: number; updatedAt: string };

/** DELETE /api/projects/:id → 204 (deletes its assets and share link too) */

// ------------------------------------------------------------------ assets

/**
 * PUT /api/assets/:id?project=<projectId> with the raw bytes as the body and
 * Content-Type set to the asset MIME (image/png, image/jpeg, image/svg+xml,
 * font/ttf, font/otf). Idempotent. 413 `too_large` over 5 MiB, 415
 * `unsupported_type` when the bytes do not match the type.
 * GET /api/assets/:id → the bytes (owner only; shared projects via /api/share).
 * HEAD /api/assets/:id → 200 if stored for this user, 404 otherwise.
 */
export const ASSET_MAX_BYTES = 5 * 1024 * 1024;

// ------------------------------------------------------------------ sharing

export type ShareSettings = { slug: string; enabled: boolean; hasPassword: boolean; url: string };

/** PUT /api/projects/:id/share { enabled, password? } → ShareSettings. password "" removes it; Pro only. */
export type PutShareBody = { enabled: boolean; password?: string | null };

/**
 * GET /api/share/:slug → SharedBrandbook (public). With a password set, send
 * `X-Share-Password`; a missing or wrong one returns 401 `unauthorized` with
 * details.passwordRequired = true.
 * GET /api/share/:slug/assets/:assetId → asset bytes (same password rule).
 */
export type SharedBrandbook = { project: Project; badge: boolean; updatedAt: string };

// ------------------------------------------------------------------ admin

/** POST /api/admin/plan { email, plan, days } → Me of that user. Only for ADMIN_EMAILS. */
export type AdminPlanBody = { email: string; plan: Plan; days: number | null };
