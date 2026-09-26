import { ArrowLeft, Eye, FileDown, PanelLeft, Redo2, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { Button, IconButton } from '@/components/ui/Button';
import { controlClass } from '@/components/ui/Field';
import { TEXT_LIMITS } from '@/domain/limits';
import type { TemplateId } from '@/domain/schema';
import { ExportDialog } from '@/features/export/ExportDialog';
import { EditorCloudStatus, EditorShareButton } from '@/features/share/EditorCloud';
import { useMessages } from '@/i18n/core';
import { editorMessages } from '@/i18n/messages/editor';
import { validationMessages } from '@/i18n/messages/validation';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { TEMPLATE_INFO } from '@/templates/templateInfo';
import { useEditorStore, useProject } from './editorStore';
import type { SaveState } from './saveController';
import type { useAutosave } from './useAutosave';

function isTextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function EditorTopBar({ autosave, onToggleNav, navOpen }: { autosave: ReturnType<typeof useAutosave>; onToggleNav?: () => void; navOpen: boolean }) {
  const project = useProject();
  const canUndo = useEditorStore((s) => (s.history?.past.length ?? 0) > 0);
  const canRedo = useEditorStore((s) => (s.history?.future.length ?? 0) > 0);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const apply = useEditorStore((s) => s.apply);
  const [exportOpen, setExportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const m = useMessages(editorMessages).topBar;

  // Global undo/redo, but never inside text fields: there the browser's own undo keeps typed text.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || isTextTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);


  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-line bg-panel px-2 sm:px-3">
      <Link to="/projects" aria-label={m.backToProjects} title={m.backToProjects} className="inline-flex size-10 shrink-0 items-center justify-center rounded-md hover:bg-ink/5">
        <ArrowLeft size={20} />
      </Link>
      {onToggleNav && (
        <IconButton label={navOpen ? m.hideSections : m.showSections} aria-expanded={navOpen} onClick={onToggleNav}>
          <PanelLeft size={20} />
        </IconButton>
      )}
      <ProjectTitle title={project.title} onRename={(title) => apply((p) => ({ ...p, title }))} />
      <SaveBadge state={autosave.state} onRetry={() => void autosave.retry()} />
      <EditorCloudStatus autosave={autosave} onOpen={() => setShareOpen(true)} />
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <IconButton label={m.undo} onClick={undo} disabled={!canUndo}>
          <Undo2 size={18} />
        </IconButton>
        <IconButton label={m.redo} onClick={redo} disabled={!canRedo}>
          <Redo2 size={18} />
        </IconButton>
        <label className="hidden items-center md:flex">
          <span className="sr-only">{m.template}</span>
          <select
            value={project.templateId}
            onChange={(e) => {
              apply((p) => ({ ...p, templateId: e.target.value as TemplateId }));
              track('template_changed', { template: e.target.value });
            }}
            className={cn(controlClass, 'h-10 w-auto min-w-[7.5rem]')}
          >
            {TEMPLATE_INFO.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <Link
          to={`/preview/${project.id}`}
          onClick={() => void autosave.flush()}
          className="hidden h-10 items-center gap-2 rounded-md border border-line-strong px-3 text-sm font-semibold hover:bg-paper sm:inline-flex"
        >
          <Eye size={16} /> {m.preview}
        </Link>
        <EditorShareButton autosave={autosave} open={shareOpen} onOpenChange={setShareOpen} />
        <Button variant="primary" icon={<FileDown size={16} />} onClick={() => setExportOpen(true)}>
          <span className="hidden sm:inline">{m.export}</span>
          <span className="sr-only sm:hidden">{m.export}</span>
        </Button>
      </div>
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} project={project} saveState={autosave.state} />
    </header>
  );
}

function ProjectTitle({ title, onRename }: { title: string; onRename: (title: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const m = useMessages(editorMessages).topBar;
  const v = useMessages(validationMessages);

  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  const finish = (commit: boolean) => {
    const value = draft.trim();
    if (commit) {
      if (!value) return setError(m.titleEmpty);
      if (value.length > TEXT_LIMITS.title) return setError(v.maxChars(TEXT_LIMITS.title));
      if (value !== title) onRename(value);
    }
    setEditing(false);
    setError(null);
    requestAnimationFrame(() => button.current?.focus());
  };

  if (!editing) {
    return (
      <button
        ref={button}
        type="button"
        onClick={() => {
          setDraft(title);
          setEditing(true);
        }}
        className="min-w-0 truncate rounded-md px-2 py-1 text-left text-base font-bold hover:bg-ink/5"
        title={m.rename}
        aria-label={m.titleButton(title)}
      >
        {title}
      </button>
    );
  }
  return (
    <div className="relative min-w-0">
      <label className="sr-only" htmlFor="project-title">
        {m.titleLabel}
      </label>
      <input
        id="project-title"
        ref={input}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setError(null);
        }}
        onKeyDown={(e: KeyboardEvent) => {
          if (e.key === 'Enter') finish(true);
          if (e.key === 'Escape') finish(false);
        }}
        onBlur={() => finish(true)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? 'project-title-error' : undefined}
        className={cn(controlClass, 'h-9 w-44 font-bold sm:w-64')}
      />
      {error && (
        <p id="project-title-error" role="alert" className="absolute top-full left-0 z-10 mt-1 rounded bg-panel px-2 py-1 text-xs font-semibold text-danger shadow-panel">
          {error}
        </p>
      )}
    </div>
  );
}

function SaveBadge({ state, onRetry }: { state: SaveState | null; onRetry: () => void }) {
  const status = state?.status ?? 'saved';
  const [announce, setAnnounce] = useState('');
  const lastSavedAnnounce = useRef(0);
  const m = useMessages(editorMessages).topBar;

  // Screen readers hear problems at once and "saved" at most every 15 s, never every keystroke.
  useEffect(() => {
    if (status === 'error' || status === 'conflict' || status === 'invalid') setAnnounce(`${m.status[status]}. ${state?.error ?? ''}`);
    else if (status === 'saved' && Date.now() - lastSavedAnnounce.current > 15000) {
      lastSavedAnnounce.current = Date.now();
      setAnnounce(m.status.saved);
    }
  }, [status, state?.error, m]);

  const problem = status === 'error' || status === 'conflict' || status === 'invalid';
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span
        className={cn(
          'hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap sm:inline-flex',
          problem ? 'bg-danger-soft text-danger' : 'bg-paper text-muted',
        )}
        title={state?.error ?? undefined}
      >
        <span aria-hidden className={cn('size-1.5 rounded-full', problem ? 'bg-danger' : status === 'saved' ? 'bg-success' : 'bg-line-strong')} />
        {m.status[status]}
      </span>
      <span className={cn('text-xs font-semibold whitespace-nowrap sm:hidden', problem ? 'text-danger' : 'text-muted')}>{m.status[status]}</span>
      {status === 'error' && (
        <Button size="sm" onClick={onRetry}>
          {m.retry}
        </Button>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {announce}
      </span>
    </div>
  );
}
