import { useCallback, useEffect, useRef, useState } from 'react';
import { cloudApi, isCloudError, type CloudApi } from '@/cloud/api';
import { cloudErrorText } from '@/cloud/errors';
import { rebuildAssets } from '@/cloud/transfer';
import { parseProject } from '@/domain/migrations';
import type { Asset, AssetMeta, Project } from '@/domain/schema';
import type { ProjectAssets } from '@/features/assets/useProjectAssets';

export type SharedState =
  | { status: 'loading' }
  | { status: 'password'; wrong: boolean }
  | { status: 'notFound' }
  | { status: 'failed'; message: string }
  | { status: 'ready'; project: Project; badge: boolean; updatedAt: string; assets: Asset[]; view: ProjectAssets };

function release(urls: string[]) {
  urls.forEach((url) => URL.revokeObjectURL(url));
  urls.length = 0;
}

/**
 * Loads a shared brand book by its slug. The same shape as useProjectAssets
 * comes out, but files are fetched from /api/share/:slug/assets/:id and run
 * through ingest (sanitised, decoded) instead of read from IndexedDB.
 */
export function useSharedBrandbook(slug: string, api: CloudApi = cloudApi) {
  const [state, setState] = useState<SharedState>({ status: 'loading' });
  // One mutable record: the latest run number and the Object URLs it created.
  const session = useRef({ run: 0, urls: [] as string[] });

  const load = useCallback(
    async (password: string | null, showLoading = true) => {
      const s = session.current;
      const id = ++s.run;
      if (showLoading) setState({ status: 'loading' });
      try {
        const shared = await api.getShared(slug, password);
        const parsed = parseProject(shared.project);
        const { project, assets } = await rebuildAssets(parsed, (assetId) => api.getSharedAsset(slug, assetId, password), { skipFailed: true });
        if (id !== s.run) return;
        release(s.urls);
        const metas = new Map<string, AssetMeta>();
        const byUrl = new Map<string, string>();
        const blobs = new Map<string, Blob>();
        for (const { blob, ...meta } of assets) {
          const url = URL.createObjectURL(blob);
          s.urls.push(url);
          metas.set(meta.id, meta);
          byUrl.set(meta.id, url);
          blobs.set(meta.id, blob);
        }
        const missing = project.assetIds.filter((assetId) => !metas.has(assetId));
        setState({
          status: 'ready',
          project,
          badge: shared.badge,
          updatedAt: shared.updatedAt,
          assets,
          view: { metas, urls: byUrl, blobs, missing, loading: false },
        });
      } catch (error) {
        if (id !== s.run) return;
        if (isCloudError(error, 'unauthorized') && error.details.passwordRequired === true) setState({ status: 'password', wrong: password !== null });
        else if (isCloudError(error, 'not_found') || isCloudError(error, 'forbidden')) setState({ status: 'notFound' });
        else setState({ status: 'failed', message: cloudErrorText(error) });
      }
    },
    [slug, api],
  );

  useEffect(() => {
    const s = session.current;
    void load(null, false);
    return () => {
      s.run++;
      release(s.urls);
    };
  }, [load]);

  return { state, load };
}
