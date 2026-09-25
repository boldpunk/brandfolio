import { useEffect, useState } from 'react';
import { getAsset } from '@/storage/projectRepository';

/**
 * Object URL for a stored asset. Created on demand and revoked when the
 * component unmounts or the asset changes.
 */
export function useAssetUrl(assetId: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!assetId) {
      setUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    void getAsset(assetId).then((asset) => {
      if (cancelled || !asset) return;
      objectUrl = URL.createObjectURL(asset.blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [assetId]);
  return url;
}
