/**
 * Cloud actions the interface calls: save a local project to the cloud, open
 * a cloud project on this device, remove it from the cloud and the two ways
 * out of a sync conflict. None of them overwrites local work without keeping
 * a copy of it first.
 */
import { projectSchema, type Asset, type Project } from '@/domain/schema';
import { getDb } from '@/storage/db';
import { StorageWriteError } from '@/storage/errors';
import { createProject, getAssets, getProject, saveAsCopy } from '@/storage/projectRepository';
import { msg } from '@/i18n/core';
import { cloudMessages } from '@/i18n/messages/cloud';
import { cloudApi, CloudError, isCloudError, type CloudApi } from './api';
import { currentMe, ensureAccount, refreshAccount } from './account';
import { deleteLink, putLink, type CloudLink } from './links';
import { confirmedFor, downloadProject, pushProject } from './transfer';
import type { Me } from './contract';

async function requireMe(): Promise<Me> {
  await ensureAccount();
  const me = currentMe();
  if (!me) throw new CloudError('unauthorized', 401, 'Not signed in');
  return me;
}

async function loadLocal(projectId: string): Promise<{ project: Project; assets: Asset[] }> {
  const project = await getProject(projectId);
  if (!project) throw new Error(msg(cloudMessages).errors.localMissing);
  return { project, assets: await getAssets(project.assetIds) };
}

/**
 * `syncedAt` is the local `updatedAt` of the version the cloud holds, so
 * "changed here since the last sync" compares two times from this device.
 */
function linkFor(me: Me, project: Project, revision: number): CloudLink {
  return { projectId: project.id, accountId: me.id, cloudRevision: revision, syncedAt: project.updatedAt };
}

/** Pushes the stored version of a linked project. Used by the editor's sync. */
export async function pushLinked(projectId: string, baseRevision: number, api: CloudApi = cloudApi): Promise<CloudLink> {
  const me = await requireMe();
  const { project, assets } = await loadLocal(projectId);
  const result = await pushProject(api, project, assets, baseRevision, confirmedFor(me.id));
  const link = linkFor(me, project, result.revision);
  await putLink(link);
  return link;
}

/** First upload of a local project. */
export async function saveToCloud(projectId: string, api: CloudApi = cloudApi): Promise<CloudLink> {
  const me = await requireMe();
  const { project, assets } = await loadLocal(projectId);
  const result = await pushProject(api, project, assets, null, confirmedFor(me.id));
  const link = linkFor(me, project, result.revision);
  await putLink(link);
  void refreshAccount();
  return link;
}

/** Downloads a cloud project that is not on this device, keeping its ID. */
export async function openOnThisDevice(projectId: string, api: CloudApi = cloudApi): Promise<Project> {
  const me = await requireMe();
  const { project, assets, revision } = await downloadProject(api, projectId);
  const stored = await createProject(project, assets);
  await putLink(linkFor(me, stored, revision));
  return stored;
}

export async function deleteFromCloud(projectId: string, api: CloudApi = cloudApi): Promise<void> {
  try {
    await api.deleteProject(projectId);
  } catch (error) {
    // Already gone elsewhere: the goal is reached.
    if (!isCloudError(error, 'not_found')) throw error;
  }
  await deleteLink(projectId);
  void refreshAccount();
}

/** Replaces the local project and its files with the given version, one transaction. */
async function replaceLocal(next: Project, assets: Asset[]): Promise<Project> {
  const records = await Promise.all(assets.map(async ({ blob, ...meta }) => ({ ...meta, bytes: await blob.arrayBuffer() })));
  const db = getDb();
  try {
    return await db.transaction('rw', db.projects, db.assets, async () => {
      const stored = await db.projects.get(next.id);
      const project = projectSchema.parse({ ...next, revision: (stored?.revision ?? 0) + 1, updatedAt: new Date().toISOString() });
      await db.assets.where('projectId').equals(next.id).delete();
      await db.assets.bulkPut(records);
      await db.projects.put(project);
      return project;
    });
  } catch (error) {
    throw new StorageWriteError(error);
  }
}

/** Downloads the cloud version over the local project; the caller has kept a copy of local work. */
async function pullOver(me: Me, projectId: string, api: CloudApi): Promise<Project> {
  const { project, assets, revision } = await downloadProject(api, projectId);
  const stored = await replaceLocal(project, assets);
  await putLink(linkFor(me, stored, revision));
  return stored;
}

/**
 * Conflict, "keep mine": my version becomes a new project, locally and in
 * the cloud; this project takes the cloud version so both stay in sync.
 * Returns the new project.
 */
export async function keepMineAsCloudCopy(mine: Project, api: CloudApi = cloudApi): Promise<Project> {
  const me = await requireMe();
  const copy = await saveAsCopy(mine);
  const assets = await getAssets(copy.assetIds);
  const result = await pushProject(api, copy, assets, null, confirmedFor(me.id));
  await putLink(linkFor(me, copy, result.revision));
  void refreshAccount();
  await pullOver(me, mine.id, api);
  return copy;
}

/**
 * Conflict, "take the cloud version": my version is kept as a local copy
 * (not in the cloud), then this project takes the cloud version.
 * Returns the refreshed project and the copy.
 */
export async function takeCloudVersion(mine: Project, api: CloudApi = cloudApi): Promise<{ fresh: Project; copy: Project }> {
  const me = await requireMe();
  const copy = await saveAsCopy(mine);
  const fresh = await pullOver(me, mine.id, api);
  return { fresh, copy };
}
