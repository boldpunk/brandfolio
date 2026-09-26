/**
 * All IndexedDB access for projects and assets. Every multi-record change runs
 * in one Dexie transaction so a failure never leaves a half-written project.
 */
import { getLocale, msg, type Locale } from '@/i18n/core';
import { validationMessages } from '@/i18n/messages/validation';
import { createId } from '@/domain/ids';
import { parseProject } from '@/domain/migrations';
import { referencedAssetIds, remapProject } from '@/domain/remap';
import { projectSchema, type Asset, type Project } from '@/domain/schema';
import { getDb, type AssetRecord } from './db';
import { IntegrityError, ProjectNotFoundError, RevisionConflictError, StorageWriteError } from './errors';

export type ProjectSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  templateId: Project['templateId'];
  isDemo: boolean;
  palette: string[];
  coverColor: string | null;
  logoAssetId: string | null;
};

function summarize(project: Project): ProjectSummary {
  const coverColor = project.brand.colors.find((c) => c.id === project.brand.cover.backgroundColorId)?.hex ?? null;
  const variants = project.brand.logo.variants;
  return {
    id: project.id,
    title: project.title,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    templateId: project.templateId,
    isDemo: project.isDemo,
    palette: project.brand.colors.map((c) => c.hex),
    coverColor,
    logoAssetId: variants.primary ?? variants.mark ?? variants.alternative,
  };
}

async function write<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof RevisionConflictError || error instanceof ProjectNotFoundError || error instanceof IntegrityError) {
      throw error;
    }
    throw new StorageWriteError(error);
  }
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const projects = await getDb().projects.toArray();
  return projects.map(summarize);
}

/** Loads and validates a project, running schema migrations if it is older. */
export async function getProject(id: string): Promise<Project | null> {
  const raw = await getDb().projects.get(id);
  return raw ? parseProject(raw) : null;
}

async function toRecord(asset: Asset): Promise<AssetRecord> {
  const { blob, ...meta } = asset;
  return { ...meta, bytes: await blob.arrayBuffer() };
}

function fromRecord(record: AssetRecord): Asset {
  const { bytes, blob, ...meta } = record;
  return { ...meta, blob: blob ?? new Blob([bytes ?? new ArrayBuffer(0)], { type: record.mimeType }) };
}

export async function getAsset(id: string): Promise<Asset | null> {
  const record = await getDb().assets.get(id);
  return record ? fromRecord(record) : null;
}

export async function getAssets(ids: readonly string[]): Promise<Asset[]> {
  const found = await getDb().assets.bulkGet([...ids]);
  return found.filter((a): a is AssetRecord => a !== undefined).map(fromRecord);
}

/** Creates a project together with its assets, all or nothing. */
export async function createProject(project: Project, assets: Asset[] = []): Promise<Project> {
  const valid = projectSchema.parse(project);
  const assetIds = new Set(valid.assetIds);
  for (const asset of assets) {
    if (asset.projectId !== valid.id || !assetIds.has(asset.id)) throw new IntegrityError(msg(validationMessages).assetNotInProject(asset.id));
  }
  if (assets.length !== assetIds.size) throw new IntegrityError(msg(validationMessages).assetsIncomplete);
  // Binaries are read before the transaction: awaiting anything but IndexedDB inside it would end it.
  const records = await Promise.all(assets.map(toRecord));
  const db = getDb();
  await write(() =>
    db.transaction('rw', db.projects, db.assets, async () => {
      if (await db.projects.get(valid.id)) throw new IntegrityError(msg(validationMessages).duplicateProjectId);
      await db.assets.bulkAdd(records);
      await db.projects.add(valid);
    }),
  );
  return valid;
}

/**
 * Saves a new version if the stored revision still equals expectedRevision.
 * Returns the stored project with revision incremented. Throws
 * RevisionConflictError when another tab saved in between; nothing is written then.
 */
export async function saveProject(project: Project, expectedRevision: number, now = new Date()): Promise<Project> {
  const next = projectSchema.parse({ ...project, revision: expectedRevision + 1, updatedAt: now.toISOString() });
  const db = getDb();
  return write(() =>
    db.transaction('rw', db.projects, db.assets, async () => {
      const stored = await db.projects.get(project.id);
      if (!stored) throw new ProjectNotFoundError(project.id);
      if (stored.revision !== expectedRevision) throw new RevisionConflictError(stored.revision);
      const owned = await db.assets.where('projectId').equals(project.id).primaryKeys();
      const ownedSet = new Set(owned);
      const missing = next.assetIds.filter((id) => !ownedSet.has(id));
      if (missing.length) throw new IntegrityError(msg(validationMessages).missingAssets(missing.join(', ')));
      await db.projects.put(next);
      return next;
    }),
  );
}

/** Stores an uploaded asset before the project references it. */
export async function putAsset(asset: Asset): Promise<void> {
  const record = await toRecord(asset);
  const db = getDb();
  await write(() =>
    db.transaction('rw', db.projects, db.assets, async () => {
      if (!(await db.projects.get(asset.projectId))) throw new ProjectNotFoundError(asset.projectId);
      await db.assets.put(record);
    }),
  );
}

/**
 * Removes asset records the project no longer references. Runs when a project
 * is opened (before any undo history exists), so undo within a session can
 * always restore a removed logo.
 */
export async function collectGarbage(projectId: string): Promise<Project | null> {
  const db = getDb();
  return write(() =>
    db.transaction('rw', db.projects, db.assets, async () => {
      const raw = await db.projects.get(projectId);
      if (!raw) return null;
      const project = parseProject(raw);
      const used = referencedAssetIds(project);
      const owned = await db.assets.where('projectId').equals(projectId).primaryKeys();
      const unused = owned.filter((id) => !used.has(id));
      if (unused.length) await db.assets.bulkDelete(unused);
      const assetIds = owned.filter((id) => used.has(id));
      const changed = assetIds.length !== project.assetIds.length || assetIds.some((id, i) => id !== project.assetIds[i]);
      if (!changed) return project;
      // Housekeeping keeps the revision: it does not change what the user sees.
      const cleaned = projectSchema.parse({ ...project, assetIds });
      await db.projects.put(cleaned);
      return cleaned;
    }),
  );
}

export async function duplicateProject(id: string, now = new Date()): Promise<Project> {
  const db = getDb();
  return write(() =>
    db.transaction('rw', db.projects, db.assets, async () => {
      const raw = await db.projects.get(id);
      if (!raw) throw new ProjectNotFoundError(id);
      return insertCopy(parseProject(raw), now);
    }),
  );
}

/** Saves the in-memory state as a new project (used after a tab conflict). */
export async function saveAsCopy(project: Project, now = new Date()): Promise<Project> {
  const db = getDb();
  return write(() => db.transaction('rw', db.projects, db.assets, () => insertCopy(project, now)));
}

/** Must run inside a rw transaction on projects and assets. */
async function insertCopy(source: Project, now: Date): Promise<Project> {
  const db = getDb();
  const assets = await db.assets.bulkGet(source.assetIds);
  const newId = createId('p');
  const assetIdMap = new Map(source.assetIds.map((assetId) => [assetId, createId('a')]));
  const iso = now.toISOString();
  const copy = projectSchema.parse({
    ...remapProject(source, newId, assetIdMap),
    title: copyTitle(source.title),
    revision: 0,
    createdAt: iso,
    updatedAt: iso,
    isDemo: false,
  });
  // Each copy owns separate asset records, so deleting it never touches the original's files.
  const copies = assets.map((asset, i) => {
    if (!asset) throw new IntegrityError(msg(validationMessages).missingAsset(String(source.assetIds[i])));
    return { ...asset, id: assetIdMap.get(asset.id)!, projectId: newId };
  });
  await db.assets.bulkAdd(copies);
  await db.projects.add(copy);
  return copy;
}

export function copyTitle(title: string, language: Locale = getLocale()): string {
  const suffix = msg(validationMessages, language).copySuffix;
  return title.length + suffix.length <= 80 ? title + suffix : title.slice(0, 80 - suffix.length) + suffix;
}

export async function deleteProject(id: string): Promise<void> {
  const db = getDb();
  await write(() =>
    db.transaction('rw', db.projects, db.assets, async () => {
      await db.assets.where('projectId').equals(id).delete();
      await db.projects.delete(id);
    }),
  );
}
