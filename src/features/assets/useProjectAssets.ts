import { useEffect, useRef, useState } from 'react';
import type { Asset, AssetMeta } from '@/domain/schema';
import { getAssets } from '@/storage/projectRepository';

export type ProjectAssets = {
  metas: ReadonlyMap<string, AssetMeta>;
  urls: ReadonlyMap<string, string>;
  blobs: ReadonlyMap<string, Blob>;
  /** IDs listed by the project that storage could not return. */
  missing: string[];
  loading: boolean;
};

/**
 * Loads the project's assets and keeps one Object URL per asset. URLs of
 * assets that leave the list are revoked immediately; all are revoked on
 * unmount.
 */
export function useProjectAssets(assetIds: readonly string[]): ProjectAssets {
  const cache = useRef(new Map<string, { asset: Asset; url: string }>());
  const [state, setState] = useState<ProjectAssets>({ metas: new Map(), urls: new Map(), blobs: new Map(), missing: [], loading: true });
  const key = assetIds.join('|');

  useEffect(() => {
    let cancelled = false;
    const wanted = new Set(assetIds);
    for (const [id, entry] of cache.current) {
      if (!wanted.has(id)) {
        URL.revokeObjectURL(entry.url);
        cache.current.delete(id);
      }
    }
    const toLoad = assetIds.filter((id) => !cache.current.has(id));
    const publish = (missing: string[]) => {
      const metas = new Map<string, AssetMeta>();
      const urls = new Map<string, string>();
      const blobs = new Map<string, Blob>();
      for (const [id, { asset, url }] of cache.current) {
        const { blob, ...meta } = asset;
        metas.set(id, meta);
        urls.set(id, url);
        blobs.set(id, blob);
      }
      setState({ metas, urls, blobs, missing, loading: false });
    };
    if (toLoad.length === 0) {
      publish([]);
      return;
    }
    void getAssets(toLoad).then((assets) => {
      if (cancelled) return;
      for (const asset of assets) {
        if (!cache.current.has(asset.id)) cache.current.set(asset.id, { asset, url: URL.createObjectURL(asset.blob) });
      }
      publish(toLoad.filter((id) => !cache.current.has(id)));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key encodes assetIds
  }, [key]);

  useEffect(() => {
    const entries = cache.current;
    return () => {
      for (const { url } of entries.values()) URL.revokeObjectURL(url);
      entries.clear();
    };
  }, []);

  return state;
}
