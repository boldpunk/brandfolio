import * as Menu from '@radix-ui/react-dropdown-menu';
import { Archive, Copy, Eye, FolderOpen, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Button, IconButton } from '@/components/ui/Button';
import { useNotify } from '@/components/ui/Announcer';
import { Dialog } from '@/components/ui/Dialog';
import { controlClass } from '@/components/ui/Field';
import { readableTextOn } from '@/domain/color';
import { useAssetUrl } from '@/features/assets/useAssetUrl';
import { LOCALE_TAGS, useLocale, useMessages, type Locale } from '@/i18n/core';
import { projectsMessages } from '@/i18n/messages/projects';
import { cn } from '@/lib/cn';
import { setUiSettings, useUiSettings } from '@/lib/uiSettings';
import { deleteProject, duplicateProject, listProjects, type ProjectSummary } from '@/storage/projectRepository';
import { CreateProjectDialog } from './CreateProjectDialog';
import { StorageNotice } from './StorageNotice';
import { ProjectsToolbar } from './ProjectsToolbar';
import { exportArchive } from '@/features/export/archive';
import { archiveFileName } from '@/features/export/fileNames';
import { downloadBlob } from '@/lib/download';
import { getAssets, getProject } from '@/storage/projectRepository';
import { track } from '@/lib/analytics';

const dateFormats = new Map<Locale, Intl.DateTimeFormat>();
function dateFormat(locale: Locale): Intl.DateTimeFormat {
  let format = dateFormats.get(locale);
  if (!format) {
    format = new Intl.DateTimeFormat(LOCALE_TAGS[locale], { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    dateFormats.set(locale, format);
  }
  return format;
}

export function sortAndFilter(projects: ProjectSummary[], query: string, sort: 'updated' | 'title', locale: Locale = 'ru'): ProjectSummary[] {
  const tag = LOCALE_TAGS[locale];
  const q = query.trim().toLocaleLowerCase(tag);
  const filtered = q ? projects.filter((p) => p.title.toLocaleLowerCase(tag).includes(q)) : projects;
  return [...filtered].sort((a, b) =>
    sort === 'title' ? a.title.localeCompare(b.title, tag, { sensitivity: 'base' }) : b.updatedAt.localeCompare(a.updatedAt),
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const { projectSort } = useUiSettings();
  const [params, setParams] = useSearchParams();
  // The home page's "create brand book" button links here with ?create=1.
  const [creating, setCreating] = useState(() => params.get('create') === '1');
  useEffect(() => {
    if (params.has('create')) setParams({}, { replace: true });
  }, [params, setParams]);
  const [toDelete, setToDelete] = useState<ProjectSummary | null>(null);
  const notify = useNotify();
  const navigate = useNavigate();
  const locale = useLocale();
  const m = useMessages(projectsMessages);

  const reload = useCallback(async () => {
    try {
      setProjects(await listProjects());
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    void reload();
    // Another tab may have changed the list.
    const onVisible = () => document.visibilityState === 'visible' && void reload();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

  const visible = useMemo(() => (projects ? sortAndFilter(projects, query, projectSort, locale) : []), [projects, query, projectSort, locale]);

  async function duplicate(project: ProjectSummary) {
    try {
      const copy = await duplicateProject(project.id);
      notify(m.copied(copy.title));
      await reload();
    } catch (error) {
      notify(m.duplicateFailed(error instanceof Error ? error.message : String(error)), 'error');
    }
  }

  async function downloadArchive(summary: ProjectSummary) {
    try {
      const project = await getProject(summary.id);
      if (!project) throw new Error(m.notFound);
      downloadBlob(await exportArchive(project, await getAssets(project.assetIds)), archiveFileName(project.title));
      track('archive_exported', { from: 'projects' });
    } catch (error) {
      notify(m.archiveFailed(error instanceof Error ? error.message : String(error)), 'error');
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await deleteProject(toDelete.id);
      notify(m.deleted(toDelete.title));
      setToDelete(null);
      await reload();
    } catch (error) {
      notify(m.deleteFailed(error instanceof Error ? error.message : String(error)), 'error');
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{m.heading}</h1>
          <p className="mt-1 text-sm text-muted">{m.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ProjectsToolbar onChanged={reload} onError={setActionError} />
          <Button variant="primary" icon={<Plus size={18} />} onClick={() => setCreating(true)}>
            {m.create}
          </Button>
        </div>
      </div>

      <StorageNotice />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">{m.search}</span>
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={m.search} className={cn(controlClass, 'h-10 pl-9')} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">{m.sort}</span>
          <select
            value={projectSort}
            onChange={(e) => setUiSettings({ projectSort: e.target.value as 'updated' | 'title' })}
            className={cn(controlClass, 'h-10 w-auto')}
          >
            <option value="updated">{m.sortUpdated}</option>
            <option value="title">{m.sortTitle}</option>
          </select>
        </label>
      </div>

      {actionError && (
        <p role="alert" className="mt-6 rounded-md border border-danger bg-danger-soft p-4 text-sm text-danger">
          {actionError}
        </p>
      )}

      {loadError && (
        <p role="alert" className="mt-6 rounded-md border border-danger bg-danger-soft p-4 text-sm text-danger">
          {m.loadFailed(loadError)}
        </p>
      )}

      {projects === null && !loadError && <p className="mt-10 text-muted">{m.loading}</p>}

      {projects?.length === 0 && (
        <div className="mt-10 rounded-lg border border-dashed border-line-strong bg-panel/60 p-8 text-center sm:p-12">
          <h2 className="text-xl font-bold">{m.emptyTitle}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            {m.emptyText}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button variant="primary" icon={<Plus size={18} />} onClick={() => setCreating(true)}>
              {m.create}
            </Button>
          </div>
        </div>
      )}

      {projects && projects.length > 0 && visible.length === 0 && <p className="mt-10 text-muted">{m.noMatches(query)}</p>}

      <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((project) => (
          <li key={project.id}>
            <ProjectCard project={project} onDuplicate={() => duplicate(project)} onArchive={() => downloadArchive(project)} onDelete={() => setToDelete(project)} />
          </li>
        ))}
      </ul>

      <CreateProjectDialog open={creating} onOpenChange={setCreating} onCreated={(id) => navigate(`/editor/${id}`)} />

      <Dialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={toDelete ? m.deleteTitle(toDelete.title) : m.deleteTitleGeneric}
        description={m.deleteDescription}
        footer={
          <>
            <Button onClick={() => setToDelete(null)}>{m.cancel}</Button>
            <Button variant="danger" icon={<Trash2 size={16} />} onClick={confirmDelete}>
              {m.deleteButton(toDelete && toDelete.title.length > 24 ? `${toDelete.title.slice(0, 24)}…` : (toDelete?.title ?? ''))}
            </Button>
          </>
        }
      />
    </div>
  );
}

function ProjectCard({ project, onDuplicate, onArchive, onDelete }: { project: ProjectSummary; onDuplicate: () => void; onArchive: () => void; onDelete: () => void }) {
  const logoUrl = useAssetUrl(project.logoAssetId);
  const locale = useLocale();
  const m = useMessages(projectsMessages);
  const cover = project.coverColor ?? project.palette[0] ?? '#FFFFFF';
  const updated = dateFormat(locale).format(new Date(project.updatedAt));
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-lg border border-line bg-panel shadow-panel">
      <Link to={`/editor/${project.id}`} className="block rounded-t-lg focus-visible:outline-offset-[-4px]">
        <div className="relative flex aspect-[4/3] items-center justify-center p-8" style={{ backgroundColor: cover }}>
          {logoUrl ? (
            <img src={logoUrl} alt="" className="max-h-24 max-w-[60%] object-contain" />
          ) : (
            <span className="line-clamp-2 text-center text-2xl font-bold break-words" style={{ color: readableTextOn(cover) }}>
              {project.title}
            </span>
          )}
          {project.isDemo && <span className="absolute top-3 left-3 rounded-sm bg-ink px-2 py-0.5 text-xs font-semibold text-white">{m.card.demo}</span>}
        </div>
        <span className="sr-only">{m.card.open(project.title)}</span>
      </Link>
      <div className="flex h-2" aria-hidden>
        {project.palette.map((hex, i) => (
          <span key={i} className="flex-1" style={{ backgroundColor: hex }} />
        ))}
      </div>
      <div className="flex items-start justify-between gap-2 p-4">
        <div className="min-w-0">
          <h2 className="truncate font-bold" title={project.title}>
            {project.title}
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            {m.card.updated} <time dateTime={project.updatedAt}>{updated}</time>
          </p>
        </div>
        <Menu.Root>
          <Menu.Trigger asChild>
            <IconButton label={m.card.actions(project.title)} size="sm">
              <MoreHorizontal size={18} />
            </IconButton>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content align="end" sideOffset={4} className="z-50 min-w-48 rounded-md border border-line bg-panel p-1 shadow-sheet">
              <MenuLink to={`/editor/${project.id}`} icon={<FolderOpen size={16} />}>
                {m.menu.open}
              </MenuLink>
              <MenuLink to={`/preview/${project.id}`} icon={<Eye size={16} />}>
                {m.menu.preview}
              </MenuLink>
              <MenuItem onSelect={onDuplicate} icon={<Copy size={16} />}>
                {m.menu.duplicate}
              </MenuItem>
              <MenuItem onSelect={onArchive} icon={<Archive size={16} />}>
                {m.menu.archive}
              </MenuItem>
              <Menu.Separator className="my-1 h-px bg-line" />
              <MenuItem onSelect={onDelete} icon={<Trash2 size={16} />} danger>
                {m.menu.delete}
              </MenuItem>
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
      </div>
    </article>
  );
}

const itemClass = 'flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm outline-none data-[highlighted]:bg-paper';

function MenuItem({ children, icon, onSelect, danger }: { children: React.ReactNode; icon: React.ReactNode; onSelect: () => void; danger?: boolean }) {
  return (
    <Menu.Item onSelect={onSelect} className={cn(itemClass, danger && 'text-danger')}>
      {icon}
      {children}
    </Menu.Item>
  );
}

function MenuLink({ children, icon, to }: { children: React.ReactNode; icon: React.ReactNode; to: string }) {
  return (
    <Menu.Item asChild className={itemClass}>
      <Link to={to}>
        {icon}
        {children}
      </Link>
    </Menu.Item>
  );
}
