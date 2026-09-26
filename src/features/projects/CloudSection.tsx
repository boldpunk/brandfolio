import * as Menu from '@radix-ui/react-dropdown-menu';
import { Cloud, CloudDownload, LogIn, MoreHorizontal, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { Button, IconButton } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import type { CloudProjectSummary } from '@/cloud/contract';
import { readableTextOn } from '@/domain/color';
import { LOCALE_TAGS, useLocale, useMessages } from '@/i18n/core';
import { cloudMessages } from '@/i18n/messages/cloud';
import type { CloudTarget, ProjectsCloud } from './useProjectsCloud';

/** "In the cloud": account projects that are not on this device yet. */
export function CloudSection({ cloud, localIds, onDelete }: { cloud: ProjectsCloud; localIds: ReadonlySet<string>; onDelete: (target: CloudTarget) => void }) {
  const m = useMessages(cloudMessages).projects;
  if (!cloud.me) {
    if (!cloud.available) return null;
    return (
      <aside className="mt-10 flex flex-col items-start gap-3 rounded-lg border border-dashed border-line-strong bg-panel/60 p-5 text-sm sm:flex-row sm:items-center">
        <Cloud size={20} className="shrink-0" aria-hidden />
        <p className="flex-1 text-muted">{m.signInText}</p>
        <Link to="/login?next=/projects" className="inline-flex h-10 items-center gap-2 rounded-md border border-line-strong bg-panel px-4 text-sm font-semibold hover:bg-paper">
          <LogIn size={16} aria-hidden /> {m.signIn}
        </Link>
      </aside>
    );
  }
  const remote = cloud.list?.filter((p) => !localIds.has(p.id)) ?? [];
  if (!cloud.listError && remote.length === 0) return null;
  return (
    <section aria-labelledby="cloud-h" className="mt-12 animate-rise">
      <div className="flex items-center gap-2">
        <Cloud size={20} aria-hidden />
        <h2 id="cloud-h" className="text-xl font-bold tracking-tight">
          {m.heading}
        </h2>
      </div>
      <p className="mt-1 text-sm text-muted">{m.text}</p>
      {cloud.listError && (
        <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-danger bg-danger-soft p-4 text-sm text-danger">
          <span className="flex-1">{m.loadFailed(cloud.listError)}</span>
          <Button size="sm" onClick={() => void cloud.reloadList()}>
            {m.retry}
          </Button>
        </div>
      )}
      <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {remote.map((project) => (
          <li key={project.id}>
            <CloudCard project={project} busy={cloud.busy.has(project.id)} onOpen={() => void cloud.open(project)} onDelete={() => onDelete(project)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CloudCard({ project, busy, onOpen, onDelete }: { project: CloudProjectSummary; busy: boolean; onOpen: () => void; onDelete: () => void }) {
  const m = useMessages(cloudMessages).projects;
  const locale = useLocale();
  const cover = project.palette[0] ?? '#FFFFFF';
  const updated = new Intl.DateTimeFormat(LOCALE_TAGS[locale], { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(project.updatedAt));
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border border-line bg-panel shadow-panel">
      <div className="flex h-20 items-center px-4" style={{ backgroundColor: cover }}>
        <span className="line-clamp-2 text-lg font-bold break-words" style={{ color: readableTextOn(cover) }}>
          {project.title}
        </span>
      </div>
      <div className="flex h-2" aria-hidden>
        {project.palette.map((hex, i) => (
          <span key={i} className="flex-1" style={{ backgroundColor: hex }} />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-bold" title={project.title}>
              {project.title}
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              {m.updated} <time dateTime={project.updatedAt}>{updated}</time>
            </p>
          </div>
          <Menu.Root>
            <Menu.Trigger asChild>
              <IconButton label={m.actions(project.title)} size="sm">
                <MoreHorizontal size={18} />
              </IconButton>
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content align="end" sideOffset={4} className="z-50 min-w-48 rounded-md border border-line bg-panel p-1 shadow-sheet">
                <Menu.Item onSelect={onDelete} className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm text-danger outline-none data-[highlighted]:bg-paper">
                  <Trash2 size={16} />
                  {m.deleteFromCloud}
                </Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        </div>
        <Button icon={<CloudDownload size={16} />} onClick={onOpen} disabled={busy} className="mt-auto self-start">
          {busy ? m.opening : m.open}
        </Button>
      </div>
    </article>
  );
}

/** Confirmation before removing a project from the cloud. */
export function CloudDeleteDialog({ target, busy, onCancel, onConfirm }: { target: CloudTarget | null; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const m = useMessages(cloudMessages).projects;
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => !open && onCancel()}
      title={target ? m.deleteTitle(target.title.length > 40 ? `${target.title.slice(0, 40)}…` : target.title) : m.deleteButton}
      description={m.deleteDescription}
      footer={
        <>
          <Button onClick={onCancel}>{m.cancel}</Button>
          <Button variant="danger" icon={<Trash2 size={16} />} onClick={onConfirm} disabled={busy}>
            {m.deleteButton}
          </Button>
        </>
      }
    />
  );
}
