import { Upload } from 'lucide-react';
import { useId, useRef, useState, type DragEvent } from 'react';
import type { Asset, AssetKind } from '@/domain/schema';
import { ingestFile } from '@/features/assets/ingest';
import { cn } from '@/lib/cn';
import { putAsset } from '@/storage/projectRepository';
import { useProject } from '../editorStore';

/**
 * File picker with drag-and-drop. The button is the keyboard and touch path;
 * dropping is an optional shortcut. Files are validated, then stored before
 * the project references them.
 */
export function Dropzone({ kind, label, onAdded, compact }: { kind: AssetKind; label: string; onAdded: (asset: Asset, notes: string[]) => void; compact?: boolean }) {
  const project = useProject();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const errorId = useId();
  const accept = kind === 'logo' ? 'image/png,image/jpeg,image/svg+xml,.svg' : 'image/png,image/jpeg';

  async function handle(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const result = await ingestFile(file, { kind, projectId: project.id });
      if (!result.ok) return setError(result.error);
      await putAsset(result.asset);
      onAdded(result.asset, result.notes);
    } catch (e) {
      setError(`Не удалось сохранить файл: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    void handle(event.dataTransfer.files[0]);
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-md border border-dashed text-center',
          compact ? 'p-3' : 'p-5',
          over ? 'border-ink bg-paper' : 'border-line-strong',
          error && 'border-danger',
        )}
      >
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          aria-describedby={error ? errorId : undefined}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-line-strong bg-panel px-3 text-sm font-semibold hover:bg-paper"
        >
          <Upload size={16} /> {busy ? 'Проверяем файл…' : label}
        </button>
        {!compact && <span className="text-xs text-muted">или перетащите файл сюда · {kind === 'logo' ? 'PNG, JPEG, SVG' : 'PNG, JPEG'} до 5 МиБ</span>}
        <input ref={input} type="file" accept={accept} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void handle(e.target.files?.[0])} />
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-xs font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
