/**
 * Undo/redo history of whole-document snapshots.
 *
 * Consecutive edits with the same coalesce key (typing in one field) within
 * COALESCE_MS merge into one step. Any other edit, undo or redo ends the run.
 */
import { HISTORY_LIMIT } from '@/domain/limits';

export const COALESCE_MS = 1500;

export type History<T> = {
  past: T[];
  present: T;
  future: T[];
  lastKey: string | null;
  lastAt: number;
};

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], lastKey: null, lastAt: 0 };
}

export function commit<T>(h: History<T>, next: T, key: string | null = null, now = Date.now()): History<T> {
  if (next === h.present) return h;
  const coalesce = key !== null && key === h.lastKey && now - h.lastAt < COALESCE_MS && h.past.length > 0;
  const past = coalesce ? h.past : [...h.past, h.present].slice(-HISTORY_LIMIT);
  return { past, present: next, future: [], lastKey: key, lastAt: now };
}

export function undo<T>(h: History<T>): History<T> {
  const previous = h.past.at(-1);
  if (previous === undefined) return h;
  return { past: h.past.slice(0, -1), present: previous, future: [h.present, ...h.future], lastKey: null, lastAt: 0 };
}

export function redo<T>(h: History<T>): History<T> {
  const [next, ...rest] = h.future;
  if (next === undefined) return h;
  return { past: [...h.past, h.present].slice(-HISTORY_LIMIT), present: next, future: rest, lastKey: null, lastAt: 0 };
}

export const canUndo = (h: History<unknown>) => h.past.length > 0;
export const canRedo = (h: History<unknown>) => h.future.length > 0;
