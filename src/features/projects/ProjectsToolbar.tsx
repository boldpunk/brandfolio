import { BookOpen, FileUp } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { useNotify } from '@/components/ui/Announcer';
import { openOrCreateDemo } from '@/features/demo/formaDemo';
import { readArchive } from '@/features/export/archive';
import { createProject } from '@/storage/projectRepository';

/** Import a .brandfolio.zip and open the demo project. */
export function ProjectsToolbar({ onChanged, onError }: { onChanged: () => void; onError: (message: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | 'import' | 'demo'>(null);
  const notify = useNotify();
  const navigate = useNavigate();

  async function importFile(file: File | undefined) {
    if (!file) return;
    setBusy('import');
    onError(null);
    try {
      const { project, assets } = await readArchive(file);
      await createProject(project, assets);
      notify(`Импортирован проект «${project.title}»`);
      onChanged();
    } catch (error) {
      onError(`Импорт не выполнен: ${error instanceof Error ? error.message : error} Существующие проекты не изменены.`);
    } finally {
      setBusy(null);
      if (input.current) input.current.value = '';
    }
  }

  async function openDemo() {
    setBusy('demo');
    onError(null);
    try {
      navigate(`/editor/${await openOrCreateDemo()}`);
    } catch (error) {
      onError(`Не удалось открыть пример: ${error instanceof Error ? error.message : error}`);
      setBusy(null);
    }
  }

  return (
    <>
      <Button icon={<BookOpen size={18} />} onClick={() => void openDemo()} disabled={busy !== null}>
        {busy === 'demo' ? 'Готовим пример…' : 'Открыть пример'}
      </Button>
      <Button icon={<FileUp size={18} />} onClick={() => input.current?.click()} disabled={busy !== null}>
        {busy === 'import' ? 'Проверяем архив…' : 'Импорт архива'}
      </Button>
      <input ref={input} type="file" accept=".zip,application/zip" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void importFile(e.target.files?.[0])} />
    </>
  );
}
