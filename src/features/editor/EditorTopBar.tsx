import { ArrowLeft, Eye, FileDown, PanelLeft, Redo2, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { Button, IconButton } from '@/components/ui/Button';
import { controlClass } from '@/components/ui/Field';
import { TEXT_LIMITS } from '@/domain/limits';
import type { TemplateId } from '@/domain/schema';
import { ExportDialog } from '@/features/export/ExportDialog';
import { cn } from '@/lib/cn';
import { TEMPLATE_INFO } from '@/templates/templateInfo';
import { useEditorStore, useProject } from './editorStore';
import type { SaveState } from './saveController';
import type { useAutosave } from './useAutosave';

const STATUS_TEXT: Record<SaveState['status'], string> = {
  saved: 'Сохранено',
  dirty: 'Есть изменения',
  saving: 'Сохраняем…',
  error: 'Не удалось сохранить',
  conflict: 'Конфликт версий',
  invalid: 'Есть ошибки в полях',
};

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
      <Link to="/projects" aria-label="К проектам" title="К проектам" className="inline-flex size-10 shrink-0 items-center justify-center rounded-md hover:bg-ink/5">
        <ArrowLeft size={20} />
      </Link>
      {onToggleNav && (
        <IconButton label={navOpen ? 'Скрыть разделы' : 'Показать разделы'} aria-expanded={navOpen} onClick={onToggleNav}>
          <PanelLeft size={20} />
        </IconButton>
      )}
      <ProjectTitle title={project.title} onRename={(title) => apply((p) => ({ ...p, title }))} />
      <SaveBadge state={autosave.state} onRetry={() => void autosave.retry()} />
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <IconButton label="Отменить (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
          <Undo2 size={18} />
        </IconButton>
        <IconButton label="Повторить (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo}>
          <Redo2 size={18} />
        </IconButton>
        <label className="hidden items-center md:flex">
          <span className="sr-only">Оформление</span>
          <select
            value={project.templateId}
            onChange={(e) => apply((p) => ({ ...p, templateId: e.target.value as TemplateId }))}
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
          <Eye size={16} /> Просмотр
        </Link>
        <Button variant="primary" icon={<FileDown size={16} />} onClick={() => setExportOpen(true)}>
          <span className="hidden sm:inline">Экспорт</span>
          <span className="sr-only sm:hidden">Экспорт</span>
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

  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  const finish = (commit: boolean) => {
    const value = draft.trim();
    if (commit) {
      if (!value) return setError('Название не может быть пустым');
      if (value.length > TEXT_LIMITS.title) return setError(`Не длиннее ${TEXT_LIMITS.title} символов`);
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
        title="Переименовать проект"
        aria-label={`Название проекта: ${title}. Нажмите, чтобы переименовать`}
      >
        {title}
      </button>
    );
  }
  return (
    <div className="relative min-w-0">
      <label className="sr-only" htmlFor="project-title">
        Название проекта
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

  // Screen readers hear problems at once and "saved" at most every 15 s, never every keystroke.
  useEffect(() => {
    if (status === 'error' || status === 'conflict' || status === 'invalid') setAnnounce(`${STATUS_TEXT[status]}. ${state?.error ?? ''}`);
    else if (status === 'saved' && Date.now() - lastSavedAnnounce.current > 15000) {
      lastSavedAnnounce.current = Date.now();
      setAnnounce('Сохранено');
    }
  }, [status, state?.error]);

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
        {STATUS_TEXT[status]}
      </span>
      <span className={cn('text-xs font-semibold whitespace-nowrap sm:hidden', problem ? 'text-danger' : 'text-muted')}>{STATUS_TEXT[status]}</span>
      {status === 'error' && (
        <Button size="sm" onClick={onRetry}>
          Повторить
        </Button>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {announce}
      </span>
    </div>
  );
}
