import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useMessages } from '@/i18n/core';
import { editorMessages } from '@/i18n/messages/editor';

/** Shown when another tab saved this project first. Autosave is paused until the user decides. */
export function ConflictDialog({ open, onReload, onSaveCopy }: { open: boolean; onReload: () => Promise<void>; onSaveCopy: () => Promise<void> }) {
  const [busy, setBusy] = useState<null | 'reload' | 'copy'>(null);
  const [error, setError] = useState<string | null>(null);
  const m = useMessages(editorMessages).conflict;
  const run = async (kind: 'reload' | 'copy') => {
    setBusy(kind);
    setError(null);
    try {
      await (kind === 'reload' ? onReload() : onSaveCopy());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={() => undefined}
      title={m.title}
      description={m.description}
      footer={
        <>
          <Button onClick={() => run('copy')} disabled={busy !== null}>
            {busy === 'copy' ? m.saving : m.saveCopy}
          </Button>
          <Button variant="primary" onClick={() => run('reload')} disabled={busy !== null}>
            {busy === 'reload' ? m.loading : m.reload}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">{m.explanation}</p>
      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </Dialog>
  );
}
