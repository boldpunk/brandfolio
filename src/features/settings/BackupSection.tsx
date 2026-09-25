import { Archive } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { exportArchive } from '@/features/export/archive';
import { archiveFileName } from '@/features/export/fileNames';
import { downloadBlob } from '@/lib/download';
import { getAssets, getProject, listProjects, type ProjectSummary } from '@/storage/projectRepository';

const dateFormat = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });

/** Backups are per-project archives; restoring is the regular archive import. */
export function BackupSection() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch(() => setMessage({ error: true, text: 'Не удалось прочитать список проектов из хранилища браузера.' }));
  }, []);

  async function backup(summary: ProjectSummary) {
    setBusy(summary.id);
    setMessage(null);
    try {
      const project = await getProject(summary.id);
      if (!project) throw new Error('проект не найден, возможно, его удалили в другой вкладке.');
      downloadBlob(await exportArchive(project, await getAssets(project.assetIds)), archiveFileName(project.title));
      setMessage({ error: false, text: `Архив проекта «${project.title}» скачан.` });
    } catch (error) {
      setMessage({ error: true, text: `Архив не создан: ${error instanceof Error ? error.message : error}` });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="backup-h" className="mt-6 rounded-lg border border-line bg-panel p-5 sm:p-6">
      <h2 id="backup-h" className="text-lg font-bold">
        Резервные копии
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Резервная копия — это архив проекта с документом, логотипами, изображениями и токенами. Чтобы восстановить проект, откройте{' '}
        <Link to="/projects" className="font-semibold text-ink underline">
          Проекты
        </Link>{' '}
        и нажмите «Импорт архива»: он создаст новый проект и не изменит существующие.
      </p>
      {projects && projects.length === 0 && <p className="mt-4 text-sm">Пока нет проектов для резервного копирования.</p>}
      {projects && projects.length > 0 && (
        <ul className="mt-4 divide-y divide-line rounded-md border border-line">
          {projects.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{p.title}</p>
                <p className="text-xs text-muted">Изменён {dateFormat.format(new Date(p.updatedAt))}</p>
              </div>
              <Button size="sm" icon={<Archive size={16} />} disabled={busy !== null} onClick={() => void backup(p)} aria-label={`Скачать архив проекта ${p.title}`}>
                {busy === p.id ? 'Собираем…' : 'Скачать архив'}
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
