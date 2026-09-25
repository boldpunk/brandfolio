import { Archive } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { exportArchive } from '@/features/export/archive';
import { archiveFileName } from '@/features/export/fileNames';
import { LOCALE_TAGS, msg, useLocale, useMessages } from '@/i18n/core';
import { settingsMessages } from '@/i18n/messages/settings';
import { downloadBlob } from '@/lib/download';
import { getAssets, getProject, listProjects, type ProjectSummary } from '@/storage/projectRepository';
import { track } from '@/lib/analytics';

/** Backups are per-project archives; restoring is the regular archive import. */
export function BackupSection() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const locale = useLocale();
  const m = useMessages(settingsMessages).backup;
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(LOCALE_TAGS[locale], { dateStyle: 'medium', timeStyle: 'short' }), [locale]);

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch(() => setMessage({ error: true, text: msg(settingsMessages).backup.listFailed }));
  }, []);

  async function backup(summary: ProjectSummary) {
    setBusy(summary.id);
    setMessage(null);
    try {
      const project = await getProject(summary.id);
      if (!project) throw new Error(m.notFound);
      downloadBlob(await exportArchive(project, await getAssets(project.assetIds)), archiveFileName(project.title));
      track('archive_exported', { from: 'settings' });
      setMessage({ error: false, text: m.downloaded(project.title) });
    } catch (error) {
      setMessage({ error: true, text: m.failed(error instanceof Error ? error.message : String(error)) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="backup-h" className="mt-6 rounded-lg border border-line bg-panel p-5 sm:p-6">
      <h2 id="backup-h" className="text-lg font-bold">
        {m.heading}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        {m.textBefore}{' '}
        <Link to="/projects" className="font-semibold text-ink underline">
          {m.link}
        </Link>{' '}
        {m.textAfter}
      </p>
      {projects && projects.length === 0 && <p className="mt-4 text-sm">{m.none}</p>}
      {projects && projects.length > 0 && (
        <ul className="mt-4 divide-y divide-line rounded-md border border-line">
          {projects.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{p.title}</p>
                <p className="text-xs text-muted">{m.updated(dateFormat.format(new Date(p.updatedAt)))}</p>
              </div>
              <Button size="sm" icon={<Archive size={16} />} disabled={busy !== null} onClick={() => void backup(p)} aria-label={m.downloadLabel(p.title)}>
                {busy === p.id ? m.busy : m.download}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {message && (
        <p role={message.error ? 'alert' : 'status'} className={message.error ? 'mt-3 text-sm font-semibold text-danger' : 'mt-3 text-sm'}>
          {message.text}
        </p>
      )}
    </section>
  );
}
