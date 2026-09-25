import { FileDown, Lock } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { controlClass, FieldShell } from '@/components/ui/Field';
import { Wordmark } from '@/components/ui/Wordmark';
import type { Asset, Project } from '@/domain/schema';
import type { ProjectAssets } from '@/features/assets/useProjectAssets';
import { buildViewModel } from '@/features/brandbook/viewModel';
import { pdfFileName } from '@/features/export/fileNames';
import { LOCALE_TAGS, useLocale, useMessages } from '@/i18n/core';
import { shareMessages } from '@/i18n/messages/share';
import { downloadBlob } from '@/lib/download';
import { cn } from '@/lib/cn';
import { BrandbookHtml } from '@/templates/html/BrandbookHtml';
import { PAGE } from '@/templates/templateStyle';
import { useSharedBrandbook } from './useSharedBrandbook';

/** Keeps share pages out of search results while they are open. */
function useNoIndex() {
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const previous = meta?.content ?? null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }
    meta.content = 'noindex, nofollow';
    const tag = meta;
    return () => {
      if (previous === null) tag.remove();
      else tag.content = previous;
    };
  }, []);
}

/** Public, read-only brand book at /b/:slug. */
export default function SharedPage() {
  const { slug = '' } = useParams();
  const { state, load } = useSharedBrandbook(slug);
  const m = useMessages(shareMessages).page;
  useNoIndex();

  useEffect(() => {
    if (state.status === 'ready') document.title = `${state.project.title} — Brandfolio`;
  }, [state]);

  if (state.status === 'ready') return <SharedBrandbook project={state.project} assets={state.assets} view={state.view} badge={state.badge} updatedAt={state.updatedAt} />;

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="px-4 pt-6 sm:px-6">
        <Link to="/" aria-label={m.toHome} className="inline-flex rounded-md">
          <Wordmark />
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
        {state.status === 'loading' && (
          <p role="status" className="text-center text-muted">
            {m.loading}
          </p>
        )}
        {state.status === 'notFound' && (
          <div className="animate-rise">
            <h1 className="text-2xl font-bold tracking-tight">{m.notFoundTitle}</h1>
            <p className="mt-2 text-muted">{m.notFoundText}</p>
          </div>
        )}
        {state.status === 'failed' && (
          <div className="animate-rise">
            <h1 className="text-2xl font-bold tracking-tight">{m.failedTitle}</h1>
            <p className="mt-2 text-muted">{state.message}</p>
            <Button className="mt-5" onClick={() => void load(null)}>
              {m.retry}
            </Button>
          </div>
        )}
        {state.status === 'password' && <PasswordForm wrong={state.wrong} onSubmit={(password) => void load(password)} />}
      </main>
    </div>
  );
}

function PasswordForm({ wrong, onSubmit }: { wrong: boolean; onSubmit: (password: string) => void }) {
  const m = useMessages(shareMessages).page;
  const [password, setPassword] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (password) onSubmit(password);
  };
  return (
    <form onSubmit={submit} className="animate-rise rounded-lg border border-line bg-panel p-5 shadow-panel sm:p-6">
      <span aria-hidden className="flex size-10 items-center justify-center rounded-full bg-ink text-white">
        <Lock size={18} />
      </span>
      <h1 className="mt-4 text-xl font-bold">{m.passwordTitle}</h1>
      <p className="mt-1 text-sm text-muted">{m.passwordText}</p>
      <FieldShell label={m.passwordLabel} error={wrong ? m.wrongPassword : null} className="mt-5">
        {({ id, describedBy, invalid }) => (
          <input
            id={id}
            type="password"
            autoComplete="off"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            className={cn(controlClass, 'h-10')}
          />
        )}
      </FieldShell>
      <Button type="submit" variant="primary" className="mt-4 w-full" disabled={!password}>
        {m.open}
      </Button>
    </form>
  );
}

type PdfState = { status: 'idle' } | { status: 'busy' } | { status: 'error'; message: string };

function SharedBrandbook({
  project,
  assets,
  view,
  badge,
  updatedAt,
}: {
  project: Project;
  assets: Asset[];
  view: ProjectAssets;
  badge: boolean;
  updatedAt: string;
}) {
  const m = useMessages(shareMessages).page;
  const locale = useLocale();
  const wrap = useRef<HTMLElement>(null);
  const [scale, setScale] = useState(1);
  const [pdf, setPdf] = useState<PdfState>({ status: 'idle' });
  const updated = useMemo(() => new Intl.DateTimeFormat(LOCALE_TAGS[locale], { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(updatedAt)), [locale, updatedAt]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScale(Math.min(1, ((entry?.contentRect.width ?? PAGE.width) - 32) / PAGE.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Empty sections are left out, as in the preview and the PDF.
  const vm = useMemo(() => {
    const full = buildViewModel(project, view.metas);
    return { ...full, sections: full.sections.filter((s) => !s.isEmpty) };
  }, [project, view.metas]);

  async function downloadPdf() {
    setPdf({ status: 'busy' });
    try {
      // The PDF renderer is large; load it only when asked.
      const { generatePdf } = await import('@/features/export/generatePdf');
      const result = await generatePdf(project, assets);
      downloadBlob(result.blob, pdfFileName(project.title));
      setPdf({ status: 'idle' });
    } catch (error) {
      setPdf({ status: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  }

  return (
    <div className="min-h-dvh bg-desk">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-line bg-panel/95 px-3 backdrop-blur sm:px-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-bold">{project.title}</h1>
          <p className="hidden truncate text-xs text-muted sm:block">
            {m.readOnly} · {m.updated(updated)}
          </p>
        </div>
        <Button variant="primary" icon={<FileDown size={16} />} onClick={() => void downloadPdf()} disabled={pdf.status === 'busy'}>
          {pdf.status === 'busy' ? m.preparingPdf : m.downloadPdf}
        </Button>
      </header>
      {pdf.status === 'error' && (
        <p role="alert" className="mx-4 mt-4 rounded-md border border-danger bg-danger-soft p-3 text-sm text-danger sm:mx-auto sm:max-w-3xl">
          {m.pdfFailed(pdf.message)}
        </p>
      )}
      <main ref={wrap} className="px-4 py-8">
        <div style={{ zoom: scale, width: PAGE.width }} className="mx-auto">
          <BrandbookHtml vm={vm} urls={view.urls} />
        </div>
      </main>
      {badge && (
        <Link
          to="/"
          className="fixed right-4 bottom-4 z-20 inline-flex items-center gap-2 rounded-full border border-line bg-panel py-1.5 pr-3.5 pl-2 text-xs font-semibold shadow-sheet transition-transform hover:-translate-y-0.5"
        >
          <svg width="18" height="18" viewBox="0 0 22 22" aria-hidden="true">
            <rect x="1" y="1" width="20" height="20" rx="3" fill="#191919" />
            <path d="M6 6h7l3 3v7H6z" fill="#F4F2ED" />
            <path d="M13 6v3h3" fill="#B8F16C" />
          </svg>
          {m.badge}
        </Link>
      )}
    </div>
  );
}
