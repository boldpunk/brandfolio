import { ArrowLeft, FileDown } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ProjectMissingPage } from '@/app/StatusPages';
import { Button } from '@/components/ui/Button';
import type { Project } from '@/domain/schema';
import { useProjectAssets } from '@/features/assets/useProjectAssets';
import { ExportDialog } from '@/features/export/ExportDialog';
import { getProject } from '@/storage/projectRepository';
import { BrandbookHtml } from '@/templates/html/BrandbookHtml';
import { PAGE } from '@/templates/templateStyle';
import { buildViewModel } from './viewModel';

/** Full-screen brandbook without editing panels. Empty sections are left out, as in the PDF. */
export default function PreviewPage() {
  const { projectId = '' } = useParams();
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const assets = useProjectAssets(project?.assetIds ?? []);
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    getProject(projectId).then(setProject, (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [projectId]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScale(Math.min(1, ((entry?.contentRect.width ?? PAGE.width) - 32) / PAGE.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [project]);

  const vm = useMemo(() => {
    if (!project) return null;
    const full = buildViewModel(project, assets.metas);
    return { ...full, sections: full.sections.filter((s) => !s.isEmpty) };
  }, [project, assets.metas]);

  if (error) return <p className="p-8 text-danger">{error}</p>;
  if (project === null) return <ProjectMissingPage />;
  if (!project || !vm) return <p className="p-8 text-muted">Открываем…</p>;

  return (
    <div className="min-h-dvh bg-desk">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-line bg-panel/95 px-3 backdrop-blur">
        <Link to={`/editor/${project.id}`} className="inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold hover:bg-ink/5">
          <ArrowLeft size={18} /> <span className="hidden sm:inline">В редактор</span>
        </Link>
        <h1 className="min-w-0 flex-1 truncate font-bold">{project.title}</h1>
        <Button variant="primary" icon={<FileDown size={16} />} onClick={() => setExportOpen(true)}>
          Экспорт
        </Button>
      </header>
      <main ref={wrap} className="px-4 py-8">
        <div style={{ zoom: scale, width: PAGE.width }} className="mx-auto">
          <BrandbookHtml vm={vm} urls={assets.urls} />
        </div>
      </main>
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} project={project} saveState={null} />
    </div>
  );
}
