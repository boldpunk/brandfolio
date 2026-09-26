import type { EditorCloudState } from '@/cloud/editorSync';
import type { CloudSyncStatus } from '@/cloud/syncScheduler';

export type CloudTone = 'ok' | 'busy' | 'wait' | 'problem' | 'local';

export function cloudTone(state: EditorCloudState): CloudTone {
  if (state.kind !== 'linked') return 'local';
  const tones: Record<CloudSyncStatus, CloudTone> = {
    synced: 'ok',
    pending: 'busy',
    syncing: 'busy',
    offline: 'wait',
    conflict: 'problem',
    error: 'problem',
    signedOut: 'problem',
    gone: 'problem',
  };
  return tones[state.sync.status];
}

/** Public URL of a share link, on the origin and base path this app is served from. */
export function shareUrl(slug: string, origin: string = globalThis.location?.origin ?? '', base: string = import.meta.env.BASE_URL): string {
  return `${origin}${base.replace(/\/$/, '')}/b/${encodeURIComponent(slug)}`;
}
