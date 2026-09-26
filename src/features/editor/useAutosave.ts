import { useEffect, useRef, useState } from 'react';
import { EditorCloudSession, type EditorCloudState } from '@/cloud/editorSync';
import { AUTOSAVE_DEBOUNCE_MS } from '@/domain/limits';
import { saveProject } from '@/storage/projectRepository';
import { useEditorStore } from './editorStore';
import { SaveController, type SaveState } from './saveController';

/**
 * Connects the editor store to storage: every document change is scheduled,
 * Ctrl/Cmd+S flushes, leaving the editor flushes, and closing the tab with a
 * pending write asks the browser to warn the user. For a project linked to
 * the cloud, every successful local save is then pushed to the cloud.
 */
export function useAutosave(projectId: string, initialRevision: number) {
  const [state, setState] = useState<SaveState | null>(null);
  const [cloud, setCloud] = useState<EditorCloudState>({ kind: 'off' });
  const controllerRef = useRef<SaveController | null>(null);
  const cloudRef = useRef<EditorCloudSession | null>(null);

  useEffect(() => {
    const session = new EditorCloudSession(projectId, setCloud);
    cloudRef.current = session;
    void session.start();
    let lastSavedAt: string | null = null;
    const controller = new SaveController({
      save: saveProject,
      initialRevision,
      debounceMs: AUTOSAVE_DEBOUNCE_MS,
      onChange: (next) => {
        setState(next);
        // A new local version landed (reset() after a conflict keeps savedAt, so it does not count).
        if (next.status !== 'saving' && next.savedAt && next.savedAt !== lastSavedAt) {
          lastSavedAt = next.savedAt;
          session.localSaved();
        }
      },
    });
    controllerRef.current = controller;
    setState(controller.getState());

    let previous = useEditorStore.getState().history?.present;
    const unsubscribe = useEditorStore.subscribe((s) => {
      const present = s.history?.present;
      if (present && present !== previous && present.id === projectId) controller.schedule(present);
      previous = present;
    });

    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void controller.retry();
      }
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!controller.hasUnsavedChanges()) return;
      void controller.flush();
      event.preventDefault();
      event.returnValue = '';
    };
    // Tab hidden (switching apps on mobile, closing): write now, do not rely on unload.
    const onHidden = () => {
      if (document.visibilityState === 'hidden') void controller.flush();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onHidden);

    return () => {
      unsubscribe();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onHidden);
      // Leaving the project: finish pending writes, then the cloud upload, before letting go.
      void controller.flush().finally(() => {
        controller.dispose();
        void session.leave();
      });
      controllerRef.current = null;
      cloudRef.current = null;
    };
    // initialRevision is only the starting point for this project.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return {
    state,
    retry: () => controllerRef.current?.retry(),
    flush: () => controllerRef.current?.flush() ?? Promise.resolve(),
    reset: (revision: number) => controllerRef.current?.reset(revision),
    hasUnsavedChanges: () => controllerRef.current?.hasUnsavedChanges() ?? false,
    cloud: {
      state: cloud,
      retry: () => cloudRef.current?.retry() ?? Promise.resolve(),
      /** Re-read the cloud link (after saving to the cloud or resolving a conflict). */
      restart: () => cloudRef.current?.start() ?? Promise.resolve(),
    },
  };
}
