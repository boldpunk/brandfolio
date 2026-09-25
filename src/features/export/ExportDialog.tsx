import { Archive, Download, ExternalLink, RefreshCw, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ensureAccount } from '@/cloud/account';
import { ENTITLEMENTS } from '@/cloud/contract';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import type { Project, SectionKind } from '@/domain/schema';
import type { SaveState } from '@/features/editor/saveController';
import { LOCALE_TAGS, useLocale, useMessages } from '@/i18n/core';
import { brandMessages } from '@/i18n/messages/brand';
import { exportMessages } from '@/i18n/messages/export';
import { downloadBlob } from '@/lib/download';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { getAssets } from '@/storage/projectRepository';
import { exportArchive } from './archive';
import { archiveFileName, pdfFileName } from './fileNames';
import { track } from '@/lib/analytics';
import { lockedFeatures, pdfMarks, usePlan } from '@/features/billing/plan';
import { TEMPLATE_INFO } from '@/templates/templateInfo';
import { MediaKitPanel } from '@/features/mediakit';
import { useNavigate } from 'react-router';

type PdfState =
  | { status: 'idle' }
  | { status: 'preparing' | 'generating'; snapshot: Project }
  | { status: 'ready'; snapshot: Project; url: string; blob: Blob; pages: number | null; skipped: SectionKind[]; at: Date }
  | { status: 'error'; message: string };

/**
 * PDF and archive export. The PDF is rendered from a snapshot of the project
 * taken when generation starts; the preview shows the exact Blob that will be
 * downloaded.
 */
export function ExportDialog({ open, onOpenChange, project, saveState }: { open: boolean; onOpenChange: (open: boolean) => void; project: Project; saveState: SaveState | null }) {
  const [pdf, setPdf] = useState<PdfState>({ status: 'idle' });
  const [zipBusy, setZipBusy] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);
  const runId = useRef(0);
  const desktop = useMediaQuery('(min-width: 1024px)');
  const locale = useLocale();
  const m = useMessages(exportMessages).dialog;
  const sections = useMessages(brandMessages).sections;
  const timeFormat = useMemo(() => new Intl.DateTimeFormat(LOCALE_TAGS[locale], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), [locale]);

  const releaseUrl = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  };

  async function start() {
    const id = ++runId.current;
    const snapshot = project; // immutable history entry: later edits cannot leak in
    releaseUrl();
    setPdf({ status: 'preparing', snapshot });
    try {
      const assets = await getAssets(snapshot.assetIds);
      // The plan decides the free-plan marks; wait for it so Pro users never get them.
      const account = await ensureAccount();
      const entitlements = account.status === 'signedIn' ? account.me.entitlements : ENTITLEMENTS.free;
      // The PDF renderer is large; load it only when export is opened.
      const { generatePdf } = await import('./generatePdf');
      const result = await generatePdf(snapshot, assets, (phase) => id === runId.current && setPdf({ status: phase, snapshot }), pdfMarks(snapshot, entitlements));
      if (id !== runId.current) return;
      urlRef.current = URL.createObjectURL(result.blob);
      setPdf({
        status: 'ready',
        snapshot,
        url: urlRef.current,
        blob: result.blob,
        pages: result.pageCount,
        skipped: result.vm.emptySections,
        at: new Date(),
      });
    } catch (error) {
      if (id === runId.current) setPdf({ status: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  }

  useEffect(() => {
    if (open) void start();
    else {
      runId.current++;
      releaseUrl();
      setPdf({ status: 'idle' });
      setZipError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start from the project at the moment of opening
  }, [open]);

  useEffect(() => () => releaseUrl(), []);

  async function downloadZip() {
    setZipBusy(true);
    setZipError(null);
    try {
      const assets = await getAssets(project.assetIds);
      downloadBlob(await exportArchive(project, assets), archiveFileName(project.title));
      track('archive_exported', { from: 'editor' });
    } catch (error) {
      setZipError(error instanceof Error ? error.message : String(error));
    } finally {
      setZipBusy(false);
    }
  }

  const stale = pdf.status === 'ready' && pdf.snapshot !== project;
  const { entitlements } = usePlan();
  const navigate = useNavigate();
  const locked = lockedFeatures(project, entitlements);
  const lockedList = locked.map((f) => (f === 'customFonts' ? m.plan.fonts : m.plan.template(TEMPLATE_INFO.find((t) => t.id === project.templateId)?.name ?? project.templateId))).join(', ');

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={m.title} wide description={m.description}>
      <section aria-labelledby="pdf-h" className="flex flex-col gap-3">
        <h3 id="pdf-h" className="font-bold">
          {m.pdfHeading}
        </h3>
        <div role="status" aria-live="polite" className="text-sm">
          {pdf.status === 'preparing' && m.preparing}
          {pdf.status === 'generating' && m.generating}
          {pdf.status === 'ready' && m.ready(pdf.pages, Math.round(pdf.blob.size / 1024), timeFormat.format(pdf.at))}
          {pdf.status === 'error' && <span className="font-semibold text-danger">{m.failed(pdf.message)}</span>}
        </div>
        {(pdf.status === 'preparing' || pdf.status === 'generating') && <div className="h-1 w-full overflow-hidden rounded bg-paper" aria-hidden><div className="h-full w-1/3 animate-pulse bg-ink/40" /></div>}
        {saveState && saveState.status !== 'saved' && pdf.status !== 'error' && (
          <p className="text-xs text-muted">{m.unsavedNote}</p>
        )}
        {locked.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-ink bg-ink p-3 text-sm text-white">
            <Sparkles size={18} className="shrink-0 text-accent" aria-hidden />
            <p className="min-w-0 flex-1">{m.plan.locked(lockedList)}</p>
            <Link to="/pricing" className="inline-flex h-9 items-center rounded-md bg-accent px-3 font-semibold text-ink hover:brightness-95">
              {m.plan.getPro}
            </Link>
          </div>
        ) : (
          entitlements.pdfFooter && <p className="text-xs text-muted">{m.plan.footerNote} <Link to="/pricing" className="font-semibold underline">{m.plan.getPro}</Link></p>
        )}
        {pdf.status === 'ready' && pdf.skipped.length > 0 && <p className="text-xs text-muted">{m.skipped(pdf.skipped.map((k) => sections[k]).join(', '))}</p>}
        {stale && (
          <p className="rounded-md border border-line-strong bg-paper p-2 text-xs">
            {m.stale}
          </p>
        )}
        {pdf.status === 'ready' && desktop && <iframe title={m.previewTitle} src={pdf.url} className="h-[55vh] w-full rounded-md border border-line bg-desk" />}
        <div className="flex flex-wrap gap-2">
          {pdf.status === 'ready' && (
            <>
              <Button variant="primary" icon={<Download size={16} />} onClick={() => {
                  downloadBlob(pdf.blob, pdfFileName(pdf.snapshot.title));
                  track('pdf_exported', { template: pdf.snapshot.templateId, language: pdf.snapshot.language });
                }}>
                {m.downloadPdf}
              </Button>
              <a href={pdf.url} target="_blank" rel="noopener" className="inline-flex h-10 items-center gap-2 rounded-md border border-line-strong px-4 text-sm font-semibold hover:bg-paper">
                <ExternalLink size={16} /> {m.openPdf}
              </a>
            </>
          )}
          {(pdf.status === 'error' || stale) && (
            <Button icon={<RefreshCw size={16} />} onClick={() => void start()}>
              {pdf.status === 'error' ? m.retry : m.refreshPdf}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted">{m.previewNote}</p>
      </section>
      <section className="mt-6 border-t border-line pt-5">
        <MediaKitPanel project={project} canDownload={entitlements.mediaKit} onUpgrade={() => navigate('/pricing')} />
      </section>
      <section aria-labelledby="zip-h" className="mt-6 flex flex-col gap-3 border-t border-line pt-5">
        <h3 id="zip-h" className="font-bold">
          {m.zipHeading}
        </h3>
        <p className="text-sm text-muted">
          {m.zipTextBefore}
          <span className="font-mono">.brandfolio.zip</span>
          {m.zipTextAfter}
        </p>
        <Button icon={<Archive size={16} />} onClick={() => void downloadZip()} disabled={zipBusy} className="self-start">
          {zipBusy ? m.zipBusy : m.downloadZip}
        </Button>
        {zipError && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {zipError}
          </p>
        )}
      </section>
    </Dialog>
  );
}
