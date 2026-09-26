import { useCallback, useEffect, useState } from 'react';
import { useNotify } from '@/components/ui/Announcer';
import { useAccount } from '@/cloud/account';
import { deleteFromCloud, openOnThisDevice, saveToCloud } from '@/cloud/actions';
import { cloudApi, isCloudError } from '@/cloud/api';
import type { CloudProjectSummary, Me } from '@/cloud/contract';
import { cloudErrorText } from '@/cloud/errors';
import { useCloudLinks, type CloudLink } from '@/cloud/links';
import { useMessages } from '@/i18n/core';
import { cloudMessages } from '@/i18n/messages/cloud';

export type CloudTarget = { id: string; title: string };

export type ProjectsCloud = {
  /** Signed in: cloud actions are offered. */
  me: Me | null;
  /** The API answered: signed out users get a sign-in hint. */
  available: boolean;
  links: ReadonlyMap<string, CloudLink>;
  /** Cloud projects (all of them), null until loaded. */
  list: CloudProjectSummary[] | null;
  listError: string | null;
  busy: ReadonlySet<string>;
  limitHit: boolean;
  reloadList: () => Promise<void>;
  save: (target: CloudTarget) => Promise<void>;
  open: (target: CloudTarget) => Promise<void>;
  remove: (target: CloudTarget) => Promise<boolean>;
};

/** Cloud state and actions for the projects page. `onLocalChanged` reloads the local list. */
export function useProjectsCloud(onLocalChanged: () => Promise<void>): ProjectsCloud {
  const account = useAccount();
  const me = account.status === 'signedIn' ? account.me : null;
  const links = useCloudLinks(me?.id ?? null);
  const [list, setList] = useState<CloudProjectSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [limitHit, setLimitHit] = useState(false);
  const notify = useNotify();
  const m = useMessages(cloudMessages).projects;
  const meId = me?.id ?? null;

  const reloadList = useCallback(async () => {
    if (!meId) return;
    try {
      setList(await cloudApi.listProjects());
      setListError(null);
    } catch (error) {
      setListError(cloudErrorText(error));
    }
  }, [meId]);

  useEffect(() => {
    void reloadList();
  }, [reloadList]);

  const withBusy = async (id: string, fn: () => Promise<void>) => {
    setBusy((b) => new Set(b).add(id));
    try {
      await fn();
    } finally {
      setBusy((b) => {
        const next = new Set(b);
        next.delete(id);
        return next;
      });
    }
  };

  const save = (target: CloudTarget) =>
    withBusy(target.id, async () => {
      setLimitHit(false);
      try {
        await saveToCloud(target.id);
        notify(m.saved(target.title));
        await reloadList();
      } catch (error) {
        if (isCloudError(error, 'plan_limit')) setLimitHit(true);
        else notify(m.saveFailed(cloudErrorText(error)), 'error');
      }
    });

  const open = (target: CloudTarget) =>
    withBusy(target.id, async () => {
      try {
        await openOnThisDevice(target.id);
        notify(m.opened(target.title));
        await onLocalChanged();
      } catch (error) {
        notify(m.openFailed(cloudErrorText(error)), 'error');
      }
    });

  const remove = async (target: CloudTarget) => {
    let ok = false;
    await withBusy(target.id, async () => {
      try {
        await deleteFromCloud(target.id);
        notify(m.deleted(target.title));
        setLimitHit(false);
        await reloadList();
        ok = true;
      } catch (error) {
        notify(m.deleteFailed(cloudErrorText(error)), 'error');
      }
    });
    return ok;
  };

  return {
    me,
    available: account.status === 'signedIn' || account.status === 'signedOut',
    links,
    // A list fetched for another account (after signing out) is never shown.
    list: meId ? list : null,
    listError: meId ? listError : null,
    busy,
    limitHit,
    reloadList,
    save,
    open,
    remove,
  };
}
