/**
 * Which local projects are linked to the cloud, per account. Kept in the
 * `cloudLinks` IndexedDB table next to the projects they describe.
 */
import { useEffect, useState } from 'react';
import { getDb, type CloudLinkRecord } from '@/storage/db';

export type CloudLink = CloudLinkRecord;

const listeners = new Set<() => void>();
const EMPTY: ReadonlyMap<string, CloudLink> = new Map();
function changed() {
  listeners.forEach((l) => l());
}

export async function getLink(projectId: string, accountId: string): Promise<CloudLink | null> {
  const link = await getDb().cloudLinks.get(projectId);
  return link && link.accountId === accountId ? link : null;
}

export async function listLinks(accountId: string): Promise<CloudLink[]> {
  return getDb().cloudLinks.where('accountId').equals(accountId).toArray();
}

export async function putLink(link: CloudLink): Promise<void> {
  await getDb().cloudLinks.put(link);
  changed();
}

export async function deleteLink(projectId: string): Promise<void> {
  await getDb().cloudLinks.delete(projectId);
  changed();
}

/** Links of one account, re-read whenever a link changes in this tab. */
export function useCloudLinks(accountId: string | null): ReadonlyMap<string, CloudLink> {
  const [state, setState] = useState<{ accountId: string | null; links: ReadonlyMap<string, CloudLink> }>({ accountId: null, links: EMPTY });
  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    const load = () =>
      void listLinks(accountId).then(
        (list) => !cancelled && setState({ accountId, links: new Map(list.map((l) => [l.projectId, l])) }),
        () => undefined,
      );
    load();
    listeners.add(load);
    return () => {
      cancelled = true;
      listeners.delete(load);
    };
  }, [accountId]);
  return state.accountId === accountId ? state.links : EMPTY;
}
