import { BookOpen, FileUp } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { useNotify } from '@/components/ui/Announcer';
import { openOrCreateDemo } from '@/features/demo/formaDemo';
import { readArchive } from '@/features/export/archive';
import { getLocale, useMessages } from '@/i18n/core';
import { projectsMessages } from '@/i18n/messages/projects';
import { createProject } from '@/storage/projectRepository';
import { track } from '@/lib/analytics';

/** Import a .brandfolio.zip and open the demo project. */
export function ProjectsToolbar({ onChanged, onError }: { onChanged: () => void; onError: (message: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | 'import' | 'demo'>(null);
  const notify = useNotify();
  const navigate = useNavigate();
  const m = useMessages(projectsMessages).toolbar;

  async function importFile(file: File | undefined) {
    if (!file) return;
    setBusy('import');
    onError(null);
    try {
      const { project, assets } = await readArchive(file);
      await createProject(project, assets);
      track('archive_imported');
      notify(m.imported(project.title));
      onChanged();
    } catch (error) {
      onError(m.importFailed(error instanceof Error ? error.message : String(error)));
    } finally {
      setBusy(null);
      if (input.current) input.current.value = '';
    }
  }

  async function openDemo() {
    setBusy('demo');
    onError(null);
    try {
      // The demo is written in the interface language.
      const id = await openOrCreateDemo(getLocale());
      track('demo_opened', { from: 'projects' });
      navigate(`/editor/${id}`);
    } catch (error) {
      onError(m.demoFailed(error instanceof Error ? error.message : String(error)));
      setBusy(null);
    }
  }

  return (
    <>
      <Button icon={<BookOpen size={18} />} onClick={() => void openDemo()} disabled={busy !== null}>
        {busy === 'demo' ? m.demoBusy : m.openDemo}
      </Button>
      <Button icon={<FileUp size={18} />} onClick={() => input.current?.click()} disabled={busy !== null}>
        {busy === 'import' ? m.importBusy : m.importArchive}
      </Button>
      <input ref={input} type="file" accept=".zip,application/zip" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void importFile(e.target.files?.[0])} />
    </>
  );
}
