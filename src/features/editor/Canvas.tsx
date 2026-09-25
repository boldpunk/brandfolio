import { Minus, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button, IconButton } from '@/components/ui/Button';
import { setSectionVisible } from '@/domain/operations';
import type { BrandbookViewModel } from '@/features/brandbook/viewModel';
import { useMessages } from '@/i18n/core';
import { brandMessages } from '@/i18n/messages/brand';
import { editorMessages } from '@/i18n/messages/editor';
import { setUiSettings, useUiSettings } from '@/lib/uiSettings';
import { BrandbookHtml, type AssetUrls } from '@/templates/html/BrandbookHtml';
import { PAGE } from '@/templates/templateStyle';
import { useEditorStore, useProject } from './editorStore';

const STEPS = [0.5, 0.75, 1, 1.25, 1.5];

/**
 * The document on a neutral desk. Zoom only changes how the sheet is shown
 * (CSS zoom inside this container); document sizes and export are unaffected.
 */
export function Canvas({ vm, urls }: { vm: BrandbookViewModel; urls: AssetUrls }) {
  const project = useProject();
  const view = useEditorStore((s) => s.view);
  const apply = useEditorStore((s) => s.apply);
  const { editorZoom } = useUiSettings();
  const container = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const m = useMessages(editorMessages).canvas;
  const labels = useMessages(brandMessages).sections;

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? PAGE.width;
      setFitScale(Math.max(0.2, Math.min(1.5, (width - 32) / PAGE.width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = editorZoom === 'fit' ? fitScale : editorZoom;
  const hidden = view !== 'all' && !project.sections.find((s) => s.kind === view)?.visible;
  const zoomTo = (z: number | 'fit') => setUiSettings({ editorZoom: z });
  const stepIndex = STEPS.findIndex((s) => s >= scale - 0.001);

  return (
    <section aria-label={m.document} className="relative flex min-w-0 flex-1 flex-col bg-desk">
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-line bg-paper/80 px-3">
        <span className="truncate text-sm text-muted">{view === 'all' ? m.wholeDocument : labels[view]}</span>
        <div className="flex items-center gap-1" role="group" aria-label={m.zoom}>
          <IconButton label={m.zoomOut} size="sm" onClick={() => zoomTo(STEPS[Math.max(0, stepIndex - 1)]!)} disabled={scale <= STEPS[0]! + 0.001}>
            <Minus size={16} />
          </IconButton>
          <label className="sr-only" htmlFor="zoom-select">
            {m.zoom}
          </label>
          <select
            id="zoom-select"
            value={editorZoom === 'fit' ? 'fit' : String(editorZoom)}
            onChange={(e) => zoomTo(e.target.value === 'fit' ? 'fit' : Number(e.target.value))}
            className="h-8 rounded-md border border-line-strong bg-panel px-2 font-mono text-xs"
          >
            <option value="fit">{m.fitWidth(Math.round(fitScale * 100))}</option>
            {STEPS.map((s) => (
              <option key={s} value={String(s)}>
                {Math.round(s * 100)}%
              </option>
            ))}
          </select>
          <IconButton label={m.zoomIn} size="sm" onClick={() => zoomTo(STEPS[Math.min(STEPS.length - 1, stepIndex + 1)]!)} disabled={scale >= 1.5 - 0.001}>
            <Plus size={16} />
          </IconButton>
        </div>
      </div>
      <div ref={container} className="min-h-0 flex-1 overflow-auto p-4">
        {hidden ? (
          <div className="mx-auto mt-10 max-w-sm rounded-lg border border-line bg-panel p-6 text-center">
            <p className="font-semibold">{m.sectionHidden(labels[view as keyof typeof labels])}</p>
            <p className="mt-1 text-sm text-muted">{m.sectionHiddenHint}</p>
            <Button className="mt-4" onClick={() => apply((p) => setSectionVisible(p, view as never, true))}>
              {m.showSection}
            </Button>
          </div>
        ) : (
          <div style={{ zoom: scale, width: PAGE.width }} className="mx-auto">
            <BrandbookHtml vm={vm} urls={urls} only={view === 'all' ? undefined : view} />
          </div>
        )}
      </div>
    </section>
  );
}
