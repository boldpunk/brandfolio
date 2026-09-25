/**
 * Editor state for the open project: document history plus UI selection.
 * Business rules live in src/domain; this store only sequences them.
 */
import { create } from 'zustand';
import type { Project, SectionKind } from '@/domain/schema';
import { canRedo, canUndo, commit, createHistory, redo, undo, type History } from './history';

export type EditorView = SectionKind | 'all';

type EditorState = {
  history: History<Project> | null;
  view: EditorView;
  load: (project: Project) => void;
  unload: () => void;
  /** Applies an edit. Same coalesceKey in quick succession merges into one undo step. */
  apply: (recipe: (project: Project) => Project, coalesceKey?: string) => void;
  undo: () => void;
  redo: () => void;
  setView: (view: EditorView) => void;
};

export const useEditorStore = create<EditorState>((set) => ({
  history: null,
  view: 'cover',
  load: (project) => set({ history: createHistory(project), view: 'cover' }),
  unload: () => set({ history: null }),
  apply: (recipe, coalesceKey) =>
    set((state) => {
      if (!state.history) return state;
      const next = recipe(state.history.present);
      return next === state.history.present ? state : { history: commit(state.history, next, coalesceKey ?? null) };
    }),
  undo: () => set((state) => (state.history && canUndo(state.history) ? { history: undo(state.history) } : state)),
  redo: () => set((state) => (state.history && canRedo(state.history) ? { history: redo(state.history) } : state)),
  setView: (view) => set({ view }),
}));

export function useProject(): Project {
  const project = useEditorStore((s) => s.history?.present);
  if (!project) throw new Error('No project loaded in editor');
  return project;
}

/** Shallow helper to update a nested part of the brand. */
export function useBrandUpdater() {
  const apply = useEditorStore((s) => s.apply);
  return function update<K extends keyof Project['brand']>(key: K, patch: Partial<Project['brand'][K]>, coalesceKey?: string) {
    apply((p) => ({ ...p, brand: { ...p.brand, [key]: { ...p.brand[key], ...patch } } }), coalesceKey);
  };
}
