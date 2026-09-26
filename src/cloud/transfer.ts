/**
 * Moving one project between this device and the cloud. Uploads send only
 * the asset files the server does not have yet; downloads run every file
 * through the same ingest as a user upload (SVG sanitising, type sniffing,
 * decoding), so the cloud is never trusted more than a dropped file.
 */
import { referencedAssetIds } from '@/domain/remap';
import { parseProject } from '@/domain/migrations';
import type { Asset, AssetKind, Project } from '@/domain/schema';
import { ingestFile, type Decoder } from '@/features/assets/ingest';
import { msg } from '@/i18n/core';
import { cloudMessages } from '@/i18n/messages/cloud';
import { isCloudError, type CloudApi } from './api';
import type { PutProjectResult } from './contract';

/** Asset IDs the server confirmed in this session, per account. */
const confirmedAssets = new Map<string, Set<string>>();
export function confirmedFor(accountId: string): Set<string> {
  let set = confirmedAssets.get(accountId);
  if (!set) confirmedAssets.set(accountId, (set = new Set()));
  return set;
}

/** Runs `fn` over items with at most `limit` running at once, keeping order. */
export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function uploadMissingAssets(api: CloudApi, projectId: string, assets: readonly Asset[], confirmed: Set<string>): Promise<void> {
  await mapLimit(assets, 3, async (asset) => {
    if (confirmed.has(asset.id)) return;
    if (!(await api.hasAsset(asset.id))) {
      // Always send the stored MIME: older records may hold a Blob without a type.
      await api.putAsset(asset.id, projectId, new Blob([asset.blob], { type: asset.mimeType }));
    }
    confirmed.add(asset.id);
  });
}

function missingAssetsOf(error: unknown): string[] | null {
  if (!isCloudError(error, 'bad_request')) return null;
  const missing = error.details.missingAssets;
  return Array.isArray(missing) && missing.every((id) => typeof id === 'string') ? missing : null;
}

/**
 * Uploads assets first, then the document. If the server still misses files
 * (deleted meanwhile), forgets them as confirmed and tries once more.
 */
export async function pushProject(
  api: CloudApi,
  project: Project,
  assets: readonly Asset[],
  baseRevision: number | null,
  confirmed: Set<string>,
): Promise<PutProjectResult> {
  await uploadMissingAssets(api, project.id, assets, confirmed);
  try {
    return await api.putProject(project, baseRevision);
  } catch (error) {
    const missing = missingAssetsOf(error);
    if (!missing) throw error;
    missing.forEach((id) => confirmed.delete(id));
    await uploadMissingAssets(api, project.id, assets, confirmed);
    return api.putProject(project, baseRevision);
  }
}

/**
 * Rebuilds the assets of a downloaded project. Files the project no longer
 * references are dropped (and removed from assetIds) instead of fetched.
 */
export async function rebuildAssets(
  source: Project,
  fetchBlob: (assetId: string) => Promise<Blob>,
  options: { decode?: Decoder; /** Leave out files that fail instead of failing as a whole (read-only views). */ skipFailed?: boolean } = {},
): Promise<{ project: Project; assets: Asset[] }> {
  const used = referencedAssetIds(source);
  const project: Project = { ...source, assetIds: source.assetIds.filter((id) => used.has(id)) };
  const logos = new Set(Object.values(project.brand.logo.variants).filter((id): id is string => id !== null));
  const load = async (id: string): Promise<Asset> => {
    const blob = await fetchBlob(id);
    const kind: AssetKind = logos.has(id) ? 'logo' : 'image';
    const result = await ingestFile(new File([blob], id, { type: blob.type }), { kind, projectId: project.id, decode: options.decode });
    if (!result.ok) throw new Error(msg(cloudMessages).errors.assetRejected(result.error));
    // Keep the ID: the document refers to it.
    return { ...result.asset, id };
  };
  const loaded = await mapLimit(project.assetIds, 4, (id) => (options.skipFailed ? load(id).catch(() => null) : load(id)));
  return { project, assets: loaded.filter((a): a is Asset => a !== null) };
}

export type Downloaded = { project: Project; assets: Asset[]; revision: number };

export async function downloadProject(api: CloudApi, id: string, decode?: Decoder): Promise<Downloaded> {
  const cloud = await api.getProject(id);
  const parsed = parseProject(cloud.project);
  const { project, assets } = await rebuildAssets(parsed, (assetId) => api.getAsset(assetId), { decode });
  return { project, assets, revision: cloud.revision };
}
