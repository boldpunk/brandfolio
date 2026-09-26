import { Upload } from 'lucide-react';
import { useId, useRef, useState, type DragEvent } from 'react';
import type { Asset, AssetKind } from '@/domain/schema';
import type { FontInfo } from '@/features/assets/fontInfo';
import { ingestFile } from '@/features/assets/ingest';
import { useMessages } from '@/i18n/core';
import { inspectorMessages } from '@/i18n/messages/inspector';
import { cn } from '@/lib/cn';
import { putAsset } from '@/storage/projectRepository';
import { useProject } from '../editorStore';

/**
 * File picker with drag-and-drop. The button is the keyboard and touch path;
 * dropping is an optional shortcut. Files are validated, then stored before
 * the project references them. Fonts may be picked several at a time (one
 * file per weight); each is checked and added in turn.
 */
export function Dropzone({ kind, label, onAdded, compact }: { kind: AssetKind; label: string; onAdded: (asset: Asset, notes: string[], font?: FontInfo) => void; compact?: boolean }) {
  const project = useProject();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const errorId = useId();
  const m = useMessages(inspectorMessages).upload;
  const accept = kind === 'logo' ? 'image/png,image/jpeg,image/svg+xml,.svg' : kind === 'font' ? '.ttf,.otf,font/ttf,font/otf' : 'image/png,image/jpeg';
  const formats = kind === 'logo' ? 'PNG, JPEG, SVG' : kind === 'font' ? 'TTF, OTF' : 'PNG, JPEG';

  async function handle(list: FileList | null | undefined) {
    const files = [...(list ?? [])].slice(0, kind === 'font' ? 12 : 1);
    if (!files.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of files) {
        const result = await ingestFile(file, { kind, projectId: project.id });
        if (!result.ok) {
          setError(files.length > 1 ? `${file.name}: ${result.error}` : result.error);
          continue;
        }
        await putAsset(result.asset);
        onAdded(result.asset, result.notes, result.font);
      }
    } catch (e) {
      setError(m.saveFailed(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    void handle(event.dataTransfer.files);
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
          <Upload size={16} /> {busy ? m.checking : label}
        </button>
        {!compact && <span className="text-xs text-muted">{m.dropHint(formats)}</span>}
        <input ref={input} type="file" accept={accept} multiple={kind === 'font'} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void handle(e.target.files)} />
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-xs font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
