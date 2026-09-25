import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';

/** Shown when another tab saved this project first. Autosave is paused until the user decides. */
export function ConflictDialog({ open, onReload, onSaveCopy }: { open: boolean; onReload: () => Promise<void>; onSaveCopy: () => Promise<void> }) {
  const [busy, setBusy] = useState<null | 'reload' | 'copy'>(null);
  const [error, setError] = useState<string | null>(null);
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
      title="Проект изменён в другой вкладке"
      description="Этот проект сохранили в другой вкладке или окне после того, как вы его открыли. Автосохранение здесь остановлено, чтобы не затереть те изменения. Ваши правки в этой вкладке пока не потеряны."
      footer={
        <>
          <Button onClick={() => run('copy')} disabled={busy !== null}>
            {busy === 'copy' ? 'Сохраняем…' : 'Сохранить мою версию как копию'}
          </Button>
          <Button variant="primary" onClick={() => run('reload')} disabled={busy !== null}>
            {busy === 'reload' ? 'Загружаем…' : 'Загрузить свежую версию'}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">«Загрузить свежую версию» заменит содержимое этой вкладки сохранённым. Правки, сделанные здесь после конфликта, будут отброшены.</p>
      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </Dialog>
  );
}
