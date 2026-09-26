import { Download, LoaderCircle, Lock, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import type { Project } from '@/domain/schema';
import { useMessages } from '@/i18n/core';
import { brandMessages } from '@/i18n/messages/brand';
import { mediakitMessages } from '@/i18n/messages/mediakit';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { downloadBlob } from '@/lib/download';
import { getAssets } from '@/storage/projectRepository';
import { buildMediaKit, type MediaKit, type MediaKitFile } from './buildMediaKit';
import { COLOR_FILES, COVER_FORMATS, FAVICON_FORMATS, groupOf, LOGO_ON_BRAND, LOGO_RENDER_PX, mediaKitFileName, SIGNATURE_PATH, SOCIAL_FORMATS } from './formats';
import { fileLabel } from './writers';

type KitState =
  | { status: 'building' }
  | { status: 'ready'; kit: MediaKit; snapshot: Project; urls: ReadonlyMap<string, string>; signature: string | null }
  | { status: 'error'; message: string };

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('FileReader'));
    reader.readAsDataURL(blob);
  });

/** Signature HTML for the preview frame, with the relative logo path inlined. */
async function signaturePreview(files: readonly MediaKitFile[]): Promise<string | null> {
  const file = files.find((f) => f.path === SIGNATURE_PATH);
  if (!file) return null;
  let html = await file.blob.text();
  for (const f of files) {
    if (f.path.startsWith('logos/') && html.includes(`src="${f.path}"`)) html = html.replace(`src="${f.path}"`, `src="${await blobToDataUrl(f.blob)}"`);
  }
  return html;
}

const CHECKERBOARD = 'bg-[conic-gradient(#e7e4dc_25%,#ffffff_0_50%,#e7e4dc_0_75%,#ffffff_0)] bg-[length:16px_16px]';

/**
 * Media kit: live previews of every generated file, grouped, and the ZIP
 * download. Built from a snapshot of the project when the panel mounts; the
 * free plan sees the previews and an upgrade prompt instead of the download.
 */
export function MediaKitPanel({ project, canDownload, onUpgrade }: { project: Project; canDownload: boolean; onUpgrade: () => void }) {
  const [state, setState] = useState<KitState>({ status: 'building' });
  const m = useMessages(mediakitMessages);
  const variants = useMessages(brandMessages).logoVariants;
  const runId = useRef(0);
  const urlsRef = useRef<string[]>([]);

  const release = () => {
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current = [];
  };

  async function start() {
    const id = ++runId.current;
    const snapshot = project;
    setState({ status: 'building' });
    try {
      const assets = await getAssets(snapshot.assetIds);
      const kit = await buildMediaKit(snapshot, assets);
      const signature = await signaturePreview(kit.files);
      if (id !== runId.current) return;
      release();
      const urls = new Map<string, string>();
      for (const file of kit.files) {
        if (!file.path.endsWith('.png')) continue;
        const url = URL.createObjectURL(file.blob);
        urls.set(file.path, url);
        urlsRef.current.push(url);
      }
      setState({ status: 'ready', kit, snapshot, urls, signature });
    } catch (error) {
      if (id === runId.current) setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  }

  /** Drops a build in flight and frees the preview URLs. */
  const cancel = () => {
    runId.current++;
    release();
  };

  useEffect(() => {
    void start();
    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- built once from the project at mount; refresh is explicit
  }, []);

  const ready = state.status === 'ready' ? state : null;
  const files = ready?.kit.files ?? [];
  const byPath = new Map(files.map((f) => [f.path, f]));
  const stale = ready !== null && ready.snapshot !== project;
  const originals = files.filter((f) => groupOf(f.path) === 'logos' && !f.path.endsWith('.png')).length;
  const logoPaths = files.filter((f) => groupOf(f.path) === 'logos' && f.path.endsWith(`-${LOGO_RENDER_PX}.png`)).map((f) => f.path);

  const preview = (path: string, transparent = false) => {
    const file = byPath.get(path);
    const url = ready?.urls.get(path);
    const small = (file?.width ?? 0) <= 64;
    return (
      <figure key={path} className="flex min-w-0 flex-col gap-1.5">
        <div className={cn('flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md border border-line p-3', transparent ? CHECKERBOARD : 'bg-desk')}>
          {url ? (
            <img src={url} alt="" className={cn('max-h-full max-w-full object-contain shadow-panel', small && 'size-16 [image-rendering:pixelated]', transparent && 'shadow-none')} />
          ) : (
            <LoaderCircle size={20} className="animate-spin text-muted" aria-hidden />
          )}
        </div>
        <figcaption className="text-xs leading-snug">
          <span className="block font-semibold">{fileLabel(path, m.files, variants)}</span>
          <span className="block truncate text-muted">
            {file?.width && file.height ? `${file.width} × ${file.height} · ` : ''}
            <span className="font-mono">{path}</span>
          </span>
        </figcaption>
      </figure>
    );
  };

  const group = (id: string, title: string, children: ReactNode, note?: string) => (
    <section aria-labelledby={`mk-${id}`} className="flex flex-col gap-3">
      <h4 id={`mk-${id}`} className="text-sm font-bold">
        {title}
      </h4>
      {children}
      {note && <p className="text-xs text-muted">{note}</p>}
    </section>
  );

  const grid = 'grid grid-cols-2 gap-3 sm:grid-cols-3';
  const kb = Math.round((ready?.kit.zip.size ?? 0) / 1024);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h3 className="font-bold">{m.panel.title}</h3>
        <p className="text-sm text-muted">{m.panel.description}</p>
        <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm">
          {state.status === 'building' && (
            <>
              <LoaderCircle size={16} className="animate-spin" aria-hidden /> {m.panel.generating}
            </>
          )}
          {ready && m.panel.summary(files.length, kb)}
          {state.status === 'error' && <span className="font-semibold text-danger">{m.panel.failed(state.message)}</span>}
        </div>
        {stale && <p className="rounded-md border border-line-strong bg-paper p-2 text-xs">{m.panel.stale}</p>}
        <div className="flex flex-wrap items-start gap-2">
          {canDownload ? (
            <Button variant="primary" icon={<Download size={16} />} disabled={!ready} onClick={() => {
                if (!ready) return;
                downloadBlob(ready.kit.zip, mediaKitFileName(ready.snapshot));
                track('media_kit_downloaded');
              }}>
              {m.panel.download}
            </Button>
          ) : (
            <div className="flex w-full flex-col gap-3 rounded-md border border-line bg-paper p-4 sm:flex-row sm:items-center">
              <Lock size={20} className="shrink-0" aria-hidden />
              <div className="flex-1 text-sm">
                <p className="font-semibold">{m.panel.lockTitle}</p>
                <p className="text-muted">{m.panel.lockNote}</p>
              </div>
              <Button variant="primary" onClick={onUpgrade} className="self-start sm:self-center">
                {m.panel.upgrade}
              </Button>
            </div>
          )}
          {(state.status === 'error' || stale) && (
            <Button icon={<RefreshCw size={16} />} onClick={() => void start()}>
              {state.status === 'error' ? m.panel.retry : m.panel.refresh}
            </Button>
          )}
        </div>
      </div>

      {state.status !== 'error' && (
        <>
          {group('social', m.panel.groups.social, <div className={grid}>{SOCIAL_FORMATS.map((f) => preview(f.path))}</div>)}
          {group('covers', m.panel.groups.covers, <div className={grid}>{COVER_FORMATS.map((f) => preview(f.path))}</div>)}
          {(ready === null || logoPaths.length > 0 || byPath.has(LOGO_ON_BRAND.path)) &&
            group(
              'logos',
              m.panel.groups.logos,
              <div className={grid}>
                {logoPaths.map((path) => preview(path, true))}
                {preview(LOGO_ON_BRAND.path)}
              </div>,
              originals ? m.panel.originals(originals) : undefined,
            )}
          {group('favicons', m.panel.groups.favicons, <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{FAVICON_FORMATS.map((f) => preview(f.path))}</div>)}
          {group(
            'colors',
            m.panel.groups.colors,
            <>
              <ul className="flex flex-wrap gap-2">
                {(ready?.snapshot ?? project).brand.colors.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 rounded-md border border-line bg-panel py-1 pr-3 pl-1 text-xs">
                    <span className="size-6 rounded-sm border border-line" style={{ backgroundColor: c.hex }} aria-hidden />
                    <span className="font-semibold">{c.name}</span>
                    <span className="font-mono text-muted">{c.hex}</span>
                  </li>
                ))}
              </ul>
              <ul className="flex flex-col gap-1 text-xs">
                {Object.values(COLOR_FILES).map((path) => (
                  <li key={path}>
                    <span className="font-mono">{path}</span> <span className="text-muted">— {fileLabel(path, m.files, variants)}</span>
                  </li>
                ))}
              </ul>
            </>,
            m.panel.colorsNote,
          )}
          {group(
            'signature',
            m.panel.groups.signature,
            ready?.signature ? (
              <iframe title={m.panel.signatureTitle} srcDoc={ready.signature} sandbox="" className="h-36 w-full rounded-md border border-line bg-white" />
            ) : (
              <div className="flex h-36 items-center justify-center rounded-md border border-line bg-desk">
                <LoaderCircle size={20} className="animate-spin text-muted" aria-hidden />
              </div>
            ),
            m.panel.signatureNote,
          )}
        </>
      )}
    </div>
  );
}
