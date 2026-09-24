import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyProject } from '@/domain/project';
import type { Project } from '@/domain/schema';
import { RevisionConflictError, StorageWriteError } from '@/storage/errors';
import { SaveController, type SaveStatus } from './saveController';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
}

function setup(save: (p: Project, rev: number) => Promise<Project>) {
  const statuses: SaveStatus[] = [];
  const controller = new SaveController({ save, initialRevision: 0, debounceMs: 600, onChange: (s) => statuses.push(s.status) });
  return { controller, statuses };
}

const base = createEmptyProject('P');
const edit = (title: string): Project => ({ ...base, title });

describe('SaveController', () => {
  it('debounces edits into one write', async () => {
    const save = vi.fn(async (p: Project, rev: number) => ({ ...p, revision: rev + 1 }));
    const { controller } = setup(save);
    controller.schedule(edit('a'));
    controller.schedule(edit('ab'));
    controller.schedule(edit('abc'));
    await vi.advanceTimersByTimeAsync(599);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await controller.flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]![0].title).toBe('abc');
    expect(controller.getState()).toMatchObject({ status: 'saved', savedRevision: 1 });
  });

  it('never runs two writes at once and writes edits made during a save afterwards', async () => {
    const first = deferred<Project>();
    const calls: [string, number][] = [];
    const save = vi.fn((p: Project, rev: number) => {
      calls.push([p.title, rev]);
      return calls.length === 1 ? first.promise : Promise.resolve({ ...p, revision: rev + 1 });
    });
    const { controller, statuses } = setup(save);
    controller.schedule(edit('one'));
    const flushing = controller.flush();
    controller.schedule(edit('two'));
    await vi.advanceTimersByTimeAsync(600);
    expect(save).toHaveBeenCalledTimes(1); // second write waits
    expect(controller.getState().status).toBe('saving');
    first.resolve({ ...edit('one'), revision: 1 });
    await flushing;
    await controller.flush();
    expect(calls).toEqual([
      ['one', 0],
      ['two', 1],
    ]);
    expect(statuses.at(-1)).toBe('saved');
    expect(controller.hasUnsavedChanges()).toBe(false);
  });

  it('does not report saved when the write fails, and keeps the edit for retry', async () => {
    let fail = true;
    const save = vi.fn(async (p: Project, rev: number) => {
      if (fail) throw new StorageWriteError(Object.assign(new Error('quota'), { name: 'QuotaExceededError' }));
      return { ...p, revision: rev + 1 };
    });
    const { controller, statuses } = setup(save);
    controller.schedule(edit('x'));
    await controller.flush();
    expect(statuses).not.toContain('saved');
    expect(controller.getState()).toMatchObject({ status: 'error', quotaExceeded: true });
    expect(controller.hasUnsavedChanges()).toBe(true);
    // Further edits do not hammer storage while in error state.
    controller.schedule(edit('xy'));
    await vi.advanceTimersByTimeAsync(600);
    expect(save).toHaveBeenCalledTimes(1);
    fail = false;
    await controller.retry();
    expect(save.mock.calls.at(-1)![0].title).toBe('xy');
    expect(controller.getState().status).toBe('saved');
  });

  it('stops autosave on conflict and keeps the in-memory state', async () => {
    const save = vi.fn(async () => {
      throw new RevisionConflictError(5);
    });
    const { controller } = setup(save);
    controller.schedule(edit('mine'));
    await controller.flush();
    expect(controller.getState().status).toBe('conflict');
    controller.schedule(edit('mine 2'));
    await vi.advanceTimersByTimeAsync(5000);
    await controller.flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(controller.hasUnsavedChanges()).toBe(true);
    controller.reset(5);
    expect(controller.getState()).toMatchObject({ status: 'saved', savedRevision: 5 });
    expect(controller.hasUnsavedChanges()).toBe(false);
  });
});
