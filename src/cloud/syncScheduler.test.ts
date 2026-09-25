import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudError } from './api';
import { CloudSyncScheduler, defaultBackoff, type CloudSyncStatus, type PushResult } from './syncScheduler';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
}

function setup(push: (base: number) => Promise<PushResult>) {
  const statuses: CloudSyncStatus[] = [];
  const scheduler = new CloudSyncScheduler({ push, initialRevision: 3, debounceMs: 2000, onChange: (s) => statuses.push(s.status) });
  return { scheduler, statuses };
}

const ok = (base: number) => Promise.resolve({ cloudRevision: base + 1 });

describe('CloudSyncScheduler', () => {
  it('debounces saves into one upload with the last known revision', async () => {
    const push = vi.fn(ok);
    const { scheduler } = setup(push);
    scheduler.schedule();
    await vi.advanceTimersByTimeAsync(1000);
    scheduler.schedule();
    await vi.advanceTimersByTimeAsync(1999);
    expect(push).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await scheduler.flush();
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(3);
    expect(scheduler.getState()).toMatchObject({ status: 'synced', cloudRevision: 4 });
  });

  it('keeps one upload in flight and uploads saves made meanwhile afterwards', async () => {
    const first = deferred<PushResult>();
    const bases: number[] = [];
    const push = vi.fn((base: number) => {
      bases.push(base);
      return bases.length === 1 ? first.promise : ok(base);
    });
    const { scheduler } = setup(push);
    scheduler.schedule();
    const flushing = scheduler.flush();
    expect(scheduler.getState().status).toBe('syncing');
    scheduler.schedule();
    await vi.advanceTimersByTimeAsync(5000);
    expect(push).toHaveBeenCalledTimes(1);
    first.resolve({ cloudRevision: 4 });
    await flushing;
    await scheduler.flush();
    expect(bases).toEqual([3, 4]);
    expect(scheduler.getState()).toMatchObject({ status: 'synced', cloudRevision: 5 });
  });

  it('stops for good on a conflict and never pushes again', async () => {
    const push = vi.fn(() => Promise.reject(new CloudError('conflict', 409, 'stale', { revision: 9 })));
    const { scheduler } = setup(push);
    scheduler.schedule();
    await scheduler.flush();
    expect(scheduler.getState().status).toBe('conflict');
    scheduler.schedule();
    await vi.advanceTimersByTimeAsync(120_000);
    await scheduler.retryNow();
    await scheduler.flush();
    expect(push).toHaveBeenCalledTimes(1);
    expect(scheduler.getState().cloudRevision).toBe(3);
  });

  it('retries network errors with growing delays, then succeeds', async () => {
    let failures = 3;
    const push = vi.fn((base: number) => (failures-- > 0 ? Promise.reject(new CloudError('network', 0, 'offline')) : ok(base)));
    const { scheduler } = setup(push);
    scheduler.schedule();
    await scheduler.flush();
    expect(scheduler.getState()).toMatchObject({ status: 'offline', attempt: 1 });

    // A save while offline does not trigger an extra upload before the backoff ends.
    scheduler.schedule();
    await vi.advanceTimersByTimeAsync(1999);
    expect(push).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(push).toHaveBeenCalledTimes(2);
    expect(scheduler.getState()).toMatchObject({ status: 'offline', attempt: 2 });

    await vi.advanceTimersByTimeAsync(3999);
    expect(push).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(push).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(8000);
    expect(push).toHaveBeenCalledTimes(4);
    expect(scheduler.getState()).toMatchObject({ status: 'synced', attempt: 0, cloudRevision: 4 });
  });

  it('retries at once when asked (browser back online)', async () => {
    let fail = true;
    const push = vi.fn((base: number) => (fail ? Promise.reject(new CloudError('server_error', 503, 'down')) : ok(base)));
    const { scheduler } = setup(push);
    scheduler.schedule();
    await scheduler.flush();
    expect(scheduler.getState().status).toBe('offline');
    fail = false;
    await scheduler.retryNow();
    expect(scheduler.getState().status).toBe('synced');
    expect(push).toHaveBeenCalledTimes(2);
  });

  it('waits for the next save after a refusal, and reports sign-out and deletion as final', async () => {
    const refusal = vi.fn(() => Promise.reject(new CloudError('too_large', 413, 'big')));
    const a = setup(refusal);
    a.scheduler.schedule();
    await a.scheduler.flush();
    expect(a.scheduler.getState().status).toBe('error');
    await vi.advanceTimersByTimeAsync(120_000);
    expect(refusal).toHaveBeenCalledTimes(1);
    a.scheduler.schedule();
    await vi.advanceTimersByTimeAsync(2000);
    expect(refusal).toHaveBeenCalledTimes(2);

    const b = setup(() => Promise.reject(new CloudError('unauthorized', 401, 'out')));
    b.scheduler.schedule();
    await b.scheduler.flush();
    expect(b.scheduler.getState().status).toBe('signedOut');

    const c = setup(() => Promise.reject(new CloudError('not_found', 404, 'gone')));
    c.scheduler.schedule();
    await c.scheduler.flush();
    expect(c.scheduler.getState().status).toBe('gone');
  });

  it('does nothing after dispose', async () => {
    const push = vi.fn(ok);
    const { scheduler, statuses } = setup(push);
    scheduler.schedule();
    scheduler.dispose();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(push).not.toHaveBeenCalled();
    expect(statuses).toEqual(['pending']);
  });

  it('caps the backoff at one minute', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 20].map(defaultBackoff)).toEqual([2000, 4000, 8000, 16000, 32000, 60000, 60000, 60000]);
  });
});
