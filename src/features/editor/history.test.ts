import { describe, expect, it } from 'vitest';
import { commit, createHistory, redo, undo } from './history';

describe('history (A04)', () => {
  it('undoes and redoes in order', () => {
    let h = createHistory('a');
    h = commit(h, 'b', null, 0);
    h = commit(h, 'c', null, 0);
    h = undo(h);
    expect(h.present).toBe('b');
    h = undo(h);
    expect(h.present).toBe('a');
    h = redo(h);
    expect(h.present).toBe('b');
  });

  it('a new edit after undo clears redo', () => {
    let h = commit(commit(createHistory(1), 2), 3);
    h = undo(h);
    h = commit(h, 4);
    expect(h.future).toEqual([]);
    expect(redo(h).present).toBe(4);
  });

  it('coalesces typing in one field into one step', () => {
    let h = createHistory('');
    h = commit(h, 'П', 'title', 1000);
    h = commit(h, 'Пр', 'title', 1200);
    h = commit(h, 'При', 'title', 1400);
    expect(h.past).toEqual(['']);
    expect(undo(h).present).toBe('');
  });

  it('does not coalesce across fields, pauses or undo', () => {
    let h = createHistory('');
    h = commit(h, 'a', 'x', 0);
    h = commit(h, 'ab', 'y', 10);
    expect(h.past).toHaveLength(2);
    h = commit(h, 'abc', 'y', 5000);
    expect(h.past).toHaveLength(3);
    h = undo(h);
    h = commit(h, 'abX', 'y', 5100);
    expect(h.past).toHaveLength(3);
  });

  it('keeps at most 50 steps', () => {
    let h = createHistory(0);
    for (let i = 1; i <= 80; i++) h = commit(h, i);
    expect(h.past).toHaveLength(50);
    expect(h.past[0]).toBe(30);
  });
});
