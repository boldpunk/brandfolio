import { useEffect, useRef, useState } from 'react';
import { AUTOSAVE_DEBOUNCE_MS } from '@/domain/limits';
import { saveProject } from '@/storage/projectRepository';
import { useEditorStore } from './editorStore';
import { SaveController, type SaveState } from './saveController';

/**
 * Connects the editor store to storage: every document change is scheduled,
 * Ctrl/Cmd+S flushes, leaving the editor flushes, and closing the tab with a
 * pending write asks the browser to warn the user.
 */
export function useAutosave(projectId: string, initialRevision: number) {
  const [state, setState] = useState<SaveState | null>(null);
  const controllerRef = useRef<SaveController | null>(null);

  useEffect(() => {
    const controller = new SaveController({
      save: saveProject,
      initialRevision,
      debounceMs: AUTOSAVE_DEBOUNCE_MS,
      onChange: setState,
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
      // Leaving the project: finish pending writes before letting go.
      void controller.flush().finally(() => controller.dispose());
      controllerRef.current = null;
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
  };
}
