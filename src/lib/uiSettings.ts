/**
 * Small interface preferences. localStorage is used only for these; project
 * data lives in IndexedDB.
 */
import { useSyncExternalStore } from 'react';
import type { TemplateId } from '@/domain/schema';

export type UiSettings = {
  storageNoticeDismissed: boolean;
  defaultTemplate: TemplateId;
  projectSort: 'updated' | 'title';
  editorZoom: number | 'fit';
};

const KEY = 'brandfolio:ui';
const DEFAULTS: UiSettings = { storageNoticeDismissed: false, defaultTemplate: 'editorial', projectSort: 'updated', editorZoom: 'fit' };

let current: UiSettings = read();
const listeners = new Set<() => void>();

function read(): UiSettings {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<UiSettings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

export function getUiSettings(): UiSettings {
  return current;
}

export function setUiSettings(patch: Partial<UiSettings>) {
  current = { ...current, ...patch };
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(current));
  } catch {
    // Private mode or quota: the preference simply is not remembered.
  }
  listeners.forEach((l) => l());
}

export function useUiSettings(): UiSettings {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}
