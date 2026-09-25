import { Archive, Download, ExternalLink, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { SECTION_LABELS } from '@/domain/project';
import type { Project } from '@/domain/schema';
import type { SaveState } from '@/features/editor/saveController';
import { downloadBlob } from '@/lib/download';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { getAssets } from '@/storage/projectRepository';
import { exportArchive } from './archive';
import { archiveFileName, pdfFileName } from './fileNames';

type PdfState =
  | { status: 'idle' }
  | { status: 'preparing' | 'generating'; snapshot: Project }
  | { status: 'ready'; snapshot: Project; url: string; blob: Blob; pages: number | null; skipped: string[]; at: Date }
  | { status: 'error'; message: string };

const timeFormat = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

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
      // The PDF renderer is large; load it only when export is opened.
      const { generatePdf } = await import('./generatePdf');
      const result = await generatePdf(snapshot, assets, (phase) => id === runId.current && setPdf({ status: phase, snapshot }));
      if (id !== runId.current) return;
      urlRef.current = URL.createObjectURL(result.blob);
      setPdf({
        status: 'ready',
        snapshot,
        url: urlRef.current,
        blob: result.blob,
        pages: result.pageCount,
        skipped: result.vm.emptySections.map((k) => SECTION_LABELS[k]),
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
    } catch (error) {
      setZipError(error instanceof Error ? error.message : String(error));
    } finally {
      setZipBusy(false);
    }
  }

  const stale = pdf.status === 'ready' && pdf.snapshot !== project;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Экспорт" wide description="PDF собирается в браузере из текущего состояния проекта. Файлы никуда не отправляются.">
      <section aria-labelledby="pdf-h" className="flex flex-col gap-3">
        <h3 id="pdf-h" className="font-bold">
          Брендбук PDF
        </h3>
        <div role="status" aria-live="polite" className="text-sm">
          {pdf.status === 'preparing' && 'Подготовка: загружаем шрифты и изображения…'}
          {pdf.status === 'generating' && 'Генерация PDF…'}
          {pdf.status === 'ready' && `Готово: ${pdf.pages ?? '?'} стр., ${Math.round(pdf.blob.size / 1024)} КБ. Снимок проекта от ${timeFormat.format(pdf.at)}.`}
          {pdf.status === 'error' && <span className="font-semibold text-danger">Не удалось создать PDF: {pdf.message}</span>}
        </div>
        {(pdf.status === 'preparing' || pdf.status === 'generating') && <div className="h-1 w-full overflow-hidden rounded bg-paper" aria-hidden><div className="h-full w-1/3 animate-pulse bg-ink/40" /></div>}
        {saveState && saveState.status !== 'saved' && pdf.status !== 'error' && (
          <p className="text-xs text-muted">PDF отражает то, что сейчас открыто в редакторе, включая ещё не сохранённые правки.</p>
        )}
        {pdf.status === 'ready' && pdf.skipped.length > 0 && <p className="text-xs text-muted">Пустые разделы не попали в PDF: {pdf.skipped.join(', ')}.</p>}
        {stale && (
          <p className="rounded-md border border-line-strong bg-paper p-2 text-xs">
            После создания PDF в проекте были изменения. Этот файл их не содержит — обновите PDF, если они нужны.
          </p>
        )}
        {pdf.status === 'ready' && desktop && <iframe title="Предпросмотр PDF" src={pdf.url} className="h-[55vh] w-full rounded-md border border-line bg-desk" />}
        <div className="flex flex-wrap gap-2">
          {pdf.status === 'ready' && (
            <>
              <Button variant="primary" icon={<Download size={16} />} onClick={() => downloadBlob(pdf.blob, pdfFileName(pdf.snapshot.title))}>
                Скачать PDF
              </Button>
              <a href={pdf.url} target="_blank" rel="noopener" className="inline-flex h-10 items-center gap-2 rounded-md border border-line-strong px-4 text-sm font-semibold hover:bg-paper">
                <ExternalLink size={16} /> Открыть PDF отдельно
              </a>
            </>
          )}
          {(pdf.status === 'error' || stale) && (
            <Button icon={<RefreshCw size={16} />} onClick={() => void start()}>
              {pdf.status === 'error' ? 'Повторить' : 'Обновить PDF'}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted">Предпросмотр выше — это тот же файл, что будет скачан. HTML-вид в редакторе близок к нему, но переносы строк и разбивка на страницы могут отличаться.</p>
      </section>
      <section aria-labelledby="zip-h" className="mt-6 flex flex-col gap-3 border-t border-line pt-5">
        <h3 id="zip-h" className="font-bold">
          Архив проекта
        </h3>
        <p className="text-sm text-muted">
          Файл <span className="font-mono">.brandfolio.zip</span> содержит проект, логотипы, изображения и токены (JSON и CSS). Его можно импортировать в другом браузере или хранить как резервную копию.
        </p>
        <Button icon={<Archive size={16} />} onClick={() => void downloadZip()} disabled={zipBusy} className="self-start">
          {zipBusy ? 'Собираем архив…' : 'Скачать архив'}
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
