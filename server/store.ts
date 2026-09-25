/**
 * Persistence: SQLite (node:sqlite) for rows, the filesystem for asset bytes.
 * Layout under DATA_DIR: brandfolio.db and assets/<userId>/<assetId>.
 */
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { ENTITLEMENTS, type Me, type Plan } from '@/cloud/contract';

export type UserRow = {
  id: string;
  email: string;
  name: string;
  locale: string;
  password_hash: string;
  plan: Plan;
  plan_until: string | null;
  created_at: string;
};

export type ProjectRow = {
  user_id: string;
  id: string;
  doc: string;
  revision: number;
  updated_at: string;
  share_slug: string | null;
  share_enabled: number;
  share_password_hash: string | null;
};

export type AssetRow = {
  user_id: string;
  id: string;
  project_id: string;
  mime: string;
  size: number;
  sha256: string;
  created_at: string;
};

/** Each entry moves the schema one version forward; user_version counts the applied ones. */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    locale TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',
    plan_until TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE INDEX sessions_user ON sessions(user_id);
  CREATE TABLE projects (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    doc TEXT NOT NULL,
    revision INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    share_slug TEXT UNIQUE,
    share_enabled INTEGER NOT NULL DEFAULT 0,
    share_password_hash TEXT,
    PRIMARY KEY (user_id, id)
  );
  CREATE TABLE assets (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, id)
  );
  CREATE INDEX assets_project ON assets(user_id, project_id);
  `,
];

export class Store {
  readonly db: DatabaseSync;
  readonly dataDir: string;
  private readonly assetsDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    fs.mkdirSync(dataDir, { recursive: true });
    this.assetsDir = path.join(dataDir, 'assets');
    fs.mkdirSync(this.assetsDir, { recursive: true });
    this.db = new DatabaseSync(path.join(dataDir, 'brandfolio.db'));
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    this.migrate();
  }

  close() {
    this.db.close();
  }

  private migrate() {
    const version = Number(this.one<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0);
    MIGRATIONS.slice(version).forEach((sql, index) => {
      this.transaction(() => {
        this.db.exec(sql);
        this.db.exec(`PRAGMA user_version = ${version + index + 1}`);
      });
    });
  }

  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  one<T>(sql: string, ...params: SQLInputValue[]): T | undefined {
    return this.db.prepare(sql).get(...params) as T | undefined;
  }

  all<T>(sql: string, ...params: SQLInputValue[]): T[] {
    return this.db.prepare(sql).all(...params) as T[];
  }

  run(sql: string, ...params: SQLInputValue[]): number {
    return Number(this.db.prepare(sql).run(...params).changes);
  }

  // ---------------------------------------------------------------- users

  userByEmail(email: string): UserRow | undefined {
    return this.one<UserRow>('SELECT * FROM users WHERE email = ?', email);
  }

  userById(id: string): UserRow | undefined {
    return this.one<UserRow>('SELECT * FROM users WHERE id = ?', id);
  }

  /** Sets a plan; days = null means no end date. Returns false for an unknown email. */
  grantPlan(email: string, plan: Plan, days: number | null, now = new Date()): boolean {
    const until = plan === 'pro' && days !== null ? new Date(now.getTime() + days * 86_400_000).toISOString() : null;
    return this.run('UPDATE users SET plan = ?, plan_until = ? WHERE email = ?', plan, until, email) > 0;
  }

  me(user: UserRow, now = new Date()): Me {
    const plan = effectivePlan(user, now);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      plan,
      planUntil: plan === 'pro' ? user.plan_until : null,
      entitlements: ENTITLEMENTS[plan],
      usage: { cloudProjects: this.countProjects(user.id) },
    };
  }

  countProjects(userId: string): number {
    return Number(this.one<{ n: number }>('SELECT COUNT(*) AS n FROM projects WHERE user_id = ?', userId)?.n ?? 0);
  }

  // ---------------------------------------------------------------- sessions

  createSession(tokenHash: string, userId: string, now: Date, ttlMs: number) {
    this.run(
      'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
      tokenHash,
      userId,
      now.toISOString(),
      new Date(now.getTime() + ttlMs).toISOString(),
    );
  }

  /** The signed-in user; a session past half its life is extended (returns renewed = true). */
  sessionUser(tokenHash: string, now: Date, ttlMs: number): { user: UserRow; renewed: boolean } | undefined {
    const row = this.one<{ user_id: string; expires_at: string }>(
      'SELECT user_id, expires_at FROM sessions WHERE token_hash = ?',
      tokenHash,
    );
    if (!row) return undefined;
    const left = Date.parse(row.expires_at) - now.getTime();
    if (left <= 0) {
      this.deleteSession(tokenHash);
      return undefined;
    }
    const user = this.userById(row.user_id);
    if (!user) return undefined;
    const renewed = left < ttlMs / 2;
    if (renewed) {
      this.run(
        'UPDATE sessions SET expires_at = ? WHERE token_hash = ?',
        new Date(now.getTime() + ttlMs).toISOString(),
        tokenHash,
      );
    }
    return { user, renewed };
  }

  deleteSession(tokenHash: string) {
    this.run('DELETE FROM sessions WHERE token_hash = ?', tokenHash);
  }

  deleteExpiredSessions(now: Date) {
    this.run('DELETE FROM sessions WHERE expires_at <= ?', now.toISOString());
  }

  // ---------------------------------------------------------------- projects

  project(userId: string, id: string): ProjectRow | undefined {
    return this.one<ProjectRow>('SELECT * FROM projects WHERE user_id = ? AND id = ?', userId, id);
  }

  projectBySlug(slug: string): ProjectRow | undefined {
    return this.one<ProjectRow>('SELECT * FROM projects WHERE share_slug = ?', slug);
  }

  projects(userId: string): ProjectRow[] {
    return this.all<ProjectRow>('SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC, id', userId);
  }

  /** Deletes the project and the assets no other project of this user references. */
  deleteProject(userId: string, id: string): boolean {
    const removed = this.transaction(() => {
      if (this.run('DELETE FROM projects WHERE user_id = ? AND id = ?', userId, id) === 0) return null;
      const stillUsed = new Set<string>();
      for (const row of this.projects(userId)) {
        for (const assetId of parseAssetIds(row.doc)) stillUsed.add(assetId);
      }
      const orphans = this.all<{ id: string }>('SELECT id FROM assets WHERE user_id = ? AND project_id = ?', userId, id)
        .map((a) => a.id)
        .filter((assetId) => !stillUsed.has(assetId));
      for (const assetId of orphans) this.run('DELETE FROM assets WHERE user_id = ? AND id = ?', userId, assetId);
      return orphans;
    });
    if (!removed) return false;
    for (const assetId of removed) fs.rmSync(this.assetPath(userId, assetId), { force: true });
    return true;
  }

  // ---------------------------------------------------------------- assets

  asset(userId: string, id: string): AssetRow | undefined {
    return this.one<AssetRow>('SELECT * FROM assets WHERE user_id = ? AND id = ?', userId, id);
  }

  assetIdsOf(userId: string): Set<string> {
    return new Set(this.all<{ id: string }>('SELECT id FROM assets WHERE user_id = ?', userId).map((a) => a.id));
  }

  /** IDs are validated by the caller (idSchema), so they are safe path segments. */
  assetPath(userId: string, id: string): string {
    return path.join(this.assetsDir, userId, id);
  }

  /** Writes the bytes atomically (temp file + rename), then records the row. */
  saveAsset(row: Omit<AssetRow, 'created_at'>, bytes: Uint8Array, now: Date) {
    const dir = path.join(this.assetsDir, row.user_id);
    fs.mkdirSync(dir, { recursive: true });
    const target = this.assetPath(row.user_id, row.id);
    const tmp = `${target}.${randomBytes(6).toString('hex')}.tmp`;
    try {
      fs.writeFileSync(tmp, bytes);
      fs.renameSync(tmp, target);
    } catch (error) {
      fs.rmSync(tmp, { force: true });
      throw error;
    }
    this.run(
      `INSERT INTO assets (user_id, id, project_id, mime, size, sha256, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, id) DO UPDATE SET project_id = excluded.project_id, mime = excluded.mime,
         size = excluded.size, sha256 = excluded.sha256`,
      row.user_id,
      row.id,
      row.project_id,
      row.mime,
      row.size,
      row.sha256,
      now.toISOString(),
    );
  }

  readAsset(userId: string, id: string): Buffer | null {
    try {
      return fs.readFileSync(this.assetPath(userId, id));
    } catch {
      return null;
    }
  }
}

/** Pro with an end date in the past reads as free. */
export function effectivePlan(user: Pick<UserRow, 'plan' | 'plan_until'>, now = new Date()): Plan {
  if (user.plan !== 'pro') return 'free';
  if (user.plan_until && user.plan_until <= now.toISOString()) return 'free';
  return 'pro';
}

export function parseAssetIds(doc: string): string[] {
  try {
    const parsed: unknown = JSON.parse(doc);
    if (parsed && typeof parsed === 'object' && 'assetIds' in parsed && Array.isArray(parsed.assetIds)) {
      return parsed.assetIds.filter((id): id is string => typeof id === 'string');
    }
  } catch {
    // A stored document is always valid JSON; treat anything else as empty.
  }
  return [];
}
