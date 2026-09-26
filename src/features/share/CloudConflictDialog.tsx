import { CloudDownload, CloudUpload } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useNotify } from '@/components/ui/Announcer';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { atProjectLimit, useAccount } from '@/cloud/account';
import { keepMineAsCloudCopy, takeCloudVersion } from '@/cloud/actions';
import { isCloudError } from '@/cloud/api';
import { cloudErrorText } from '@/cloud/errors';
import { PlanLimitNotice } from '@/features/account/PlanLimitNotice';
import { useEditorStore } from '@/features/editor/editorStore';
import type { useAutosave } from '@/features/editor/useAutosave';
import { useMessages } from '@/i18n/core';
import { cloudMessages } from '@/i18n/messages/cloud';

type Autosave = ReturnType<typeof useAutosave>;

/**
 * The cloud holds a newer version than this device started from. Sync is
 * paused until the user picks a way out; both keep every version.
 */
export function CloudConflictDialog({ open, onOpenChange, autosave }: { open: boolean; onOpenChange: (open: boolean) => void; autosave: Autosave }) {
  const m = useMessages(cloudMessages).editor;
  const account = useAccount();
  const me = account.status === 'signedIn' ? account.me : null;
  const navigate = useNavigate();
  const notify = useNotify();
  const loadProject = useEditorStore((s) => s.load);
  const [busy, setBusy] = useState<null | 'mine' | 'cloud'>(null);
  const [error, setError] = useState<unknown>(null);
  const limited = me !== null && atProjectLimit(me);

  async function run(kind: 'mine' | 'cloud') {
    setBusy(kind);
    setError(null);
    try {
      // The version to keep is what the editor shows, written locally first.
      await autosave.flush();
      const mine = useEditorStore.getState().history?.present;
      if (!mine) return;
      if (kind === 'mine') {
        const copy = await keepMineAsCloudCopy(mine);
        onOpenChange(false);
        notify(m.keptMine(copy.title));
        navigate(`/editor/${copy.id}`);
      } else {
        const { fresh, copy } = await takeCloudVersion(mine);
        loadProject(fresh);
        autosave.reset(fresh.revision);
        await autosave.cloud.restart();
        onOpenChange(false);
        notify(m.tookCloud(copy.title));
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  const planLimit = isCloudError(error, 'plan_limit');
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => busy === null && onOpenChange(next)}
      title={m.conflictTitle}
      description={m.conflictDescription}
      footer={
        <Button onClick={() => onOpenChange(false)} disabled={busy !== null}>
          {m.later}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Choice icon={<CloudDownload size={18} />} hint={m.takeCloudHint}>
          <Button variant="primary" onClick={() => void run('cloud')} disabled={busy !== null} className="h-auto min-h-10 py-2 whitespace-normal text-left">
            {busy === 'cloud' ? m.working : m.takeCloud}
          </Button>
        </Choice>
        <Choice icon={<CloudUpload size={18} />} hint={m.keepMineHint}>
          <Button onClick={() => void run('mine')} disabled={busy !== null || limited || planLimit} className="h-auto min-h-10 py-2 whitespace-normal text-left">
            {busy === 'mine' ? m.working : m.keepMine}
          </Button>
          {(limited || planLimit) && <PlanLimitNotice me={me} compact />}
        </Choice>
        {error !== null && !planLimit && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {cloudErrorText(error)}
          </p>
        )}
      </div>
    </Dialog>
  );
}

function Choice({ icon, hint, children }: { icon: ReactNode; hint: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-line p-3">
      <span aria-hidden className="mt-2 shrink-0 text-muted">
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
        {children}
        <p className="text-xs text-muted">{hint}</p>
      </div>
    </div>
  );
}
