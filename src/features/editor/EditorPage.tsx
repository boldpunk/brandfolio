import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ProjectMissingPage } from '@/app/StatusPages';
import { buildViewModel } from '@/features/brandbook/viewModel';
import { useProjectAssets } from '@/features/assets/useProjectAssets';
import { cn } from '@/lib/cn';
import { collectGarbage, getProject, saveAsCopy } from '@/storage/projectRepository';
import { Canvas } from './Canvas';
import { ConflictDialog } from './ConflictDialog';
import { EditorAssetsProvider } from './editorAssets';
import { useEditorStore } from './editorStore';
import { EditorTopBar } from './EditorTopBar';
import { Inspector } from './Inspector';
import { SectionNav } from './SectionNav';
import { useAutosave } from './useAutosave';
import { useMediaQuery } from '@/lib/useMediaQuery';

type LoadState = { status: 'loading' } | { status: 'missing' } | { status: 'error'; message: string } | { status: 'ready'; revision: number };

export default function EditorPage() {
  const { projectId = '' } = useParams();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const loadProject = useEditorStore((s) => s.load);
  const unload = useEditorStore((s) => s.unload);

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: 'loading' });
    (async () => {
      try {
        const project = (await collectGarbage(projectId)) ?? (await getProject(projectId));
        if (cancelled) return;
        if (!project) return setLoad({ status: 'missing' });
        loadProject(project);
        setLoad({ status: 'ready', revision: project.revision });
      } catch (error) {
        if (!cancelled) setLoad({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, loadProject]);

  useEffect(() => () => unload(), [unload]);

  if (load.status === 'missing') return <ProjectMissingPage />;
  if (load.status === 'error')
    return (
      <div className="mx-auto max-w-xl px-4 py-20">
        <h1 className="text-2xl font-bold">Не удалось открыть проект</h1>
        <p className="mt-2 text-muted">{load.message}</p>
      </div>
    );
  if (load.status === 'loading') return <p className="p-8 text-muted">Открываем проект…</p>;
  return <EditorWorkspace key={projectId} projectId={projectId} initialRevision={load.revision} />;
}

type MobileTab = 'sections' | 'editor' | 'preview';

function EditorWorkspace({ projectId, initialRevision }: { projectId: string; initialRevision: number }) {
  const project = useEditorStore((s) => s.history?.present);
  const loadProject = useEditorStore((s) => s.load);
  const autosave = useAutosave(projectId, initialRevision);
  const assets = useProjectAssets(project?.assetIds ?? []);
  const navigate = useNavigate();
  const wide = useMediaQuery('(min-width: 1280px)');
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [navOpen, setNavOpen] = useState(false);
  const [tab, setTab] = useState<MobileTab>('editor');

  const vm = useMemo(() => (project ? buildViewModel(project, assets.metas) : null), [project, assets.metas]);
  if (!project || !vm) return null;

  async function reloadFresh() {
    const fresh = await getProject(projectId);
    if (fresh) {
      loadProject(fresh);
      autosave.reset(fresh.revision);
    }
  }
  async function keepMineAsCopy() {
    if (!project) return;
    const copy = await saveAsCopy(project);
    autosave.reset(autosave.state?.savedRevision ?? 0);
    navigate(`/editor/${copy.id}`);
  }

  const nav = <SectionNav onPicked={() => (desktop ? setNavOpen(false) : setTab('editor'))} />;

  return (
    <EditorAssetsProvider value={assets}>
      <div className="flex h-dvh flex-col overflow-hidden bg-paper">
        <EditorTopBar autosave={autosave} onToggleNav={!wide && desktop ? () => setNavOpen((v) => !v) : undefined} navOpen={navOpen} />
        {desktop ? (
          <div className="relative flex min-h-0 flex-1">
            {wide ? (
              <aside aria-label="Разделы" className="w-[232px] shrink-0 overflow-y-auto border-r border-line bg-panel">
                {nav}
              </aside>
            ) : (
              navOpen && (
                <aside aria-label="Разделы" className="absolute inset-y-0 left-0 z-20 w-[260px] overflow-y-auto border-r border-line bg-panel shadow-sheet">
                  {nav}
                </aside>
              )
            )}
            <Canvas vm={vm} urls={assets.urls} />
            <aside aria-label="Настройки раздела" className="w-[320px] shrink-0 overflow-y-auto border-l border-line bg-panel">
              <Inspector />
            </aside>
          </div>
        ) : (
          <>
            <div role="tablist" aria-label="Панели редактора" className="grid shrink-0 grid-cols-3 border-b border-line bg-panel">
              {(
                [
                  ['sections', 'Разделы'],
                  ['editor', 'Редактор'],
                  ['preview', 'Просмотр'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  id={`tab-${id}`}
                  aria-selected={tab === id}
                  aria-controls={`panel-${id}`}
                  onClick={() => setTab(id)}
                  className={cn('h-11 border-b-2 text-sm font-semibold', tab === id ? 'border-ink text-ink' : 'border-transparent text-muted')}
                >
                  {label}
                </button>
              ))}
            </div>
            <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="min-h-0 flex-1 overflow-y-auto bg-panel">
              {tab === 'sections' && nav}
              {tab === 'editor' && <Inspector />}
              {tab === 'preview' && (
                <div className="flex h-full bg-desk">
                  <Canvas vm={vm} urls={assets.urls} />
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <ConflictDialog open={autosave.state?.status === 'conflict'} onReload={reloadFresh} onSaveCopy={keepMineAsCopy} />
    </EditorAssetsProvider>
  );
}
