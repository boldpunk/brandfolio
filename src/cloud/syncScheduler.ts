/**
 * Pushes one linked project to the cloud after local saves.
 *
 * - Debounced (a burst of saves becomes one upload); one upload in flight,
 *   saves made meanwhile are uploaded after it.
 * - Network and server trouble: retried with exponential backoff, the edits
 *   stay safe locally in the meantime.
 * - 409 conflict: stops for good. The user chooses what happens; nothing is
 *   ever overwritten on either side automatically.
 */
import { isCloudError } from './api';

export type CloudSyncStatus =
  /** Cloud holds the latest local save. */
  | 'synced'
  /** Local saves wait for the debounce. */
  | 'pending'
  | 'syncing'
  /** Could not reach the server; retrying with backoff. */
  | 'offline'
  | 'conflict'
  /** The server refused the upload; retried after the next save. */
  | 'error'
  /** Session ended; the user must sign in again. */
  | 'signedOut'
  /** The cloud copy was deleted elsewhere. */
  | 'gone';

export type CloudSyncState = {
  status: CloudSyncStatus;
  cloudRevision: number;
  error: string | null;
  /** Failed attempts in a row (for backoff). */
  attempt: number;
  /** When the next automatic retry runs (ms since epoch), if one is planned. */
  retryAt: number | null;
};

export type PushResult = { cloudRevision: number };

type Options = {
  /** Uploads the latest local version with this base revision. */
  push: (baseRevision: number) => Promise<PushResult>;
  initialRevision: number;
  onChange: (state: CloudSyncState) => void;
  debounceMs?: number;
  backoffMs?: (attempt: number) => number;
  now?: () => number;
};

export const SYNC_DEBOUNCE_MS = 2000;

/** 2 s, 4 s, 8 s … capped at one minute. */
export function defaultBackoff(attempt: number): number {
  return Math.min(60_000, 2000 * 2 ** Math.max(0, attempt - 1));
}

const STOPPED: ReadonlySet<CloudSyncStatus> = new Set(['conflict', 'signedOut', 'gone']);

export class CloudSyncScheduler {
  private readonly options: Required<Options>;
  private state: CloudSyncState;
  private dirty = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<void> | null = null;
  private disposed = false;

  constructor(options: Options) {
    this.options = { debounceMs: SYNC_DEBOUNCE_MS, backoffMs: defaultBackoff, now: Date.now, ...options };
    this.state = { status: 'synced', cloudRevision: options.initialRevision, error: null, attempt: 0, retryAt: null };
  }

  getState(): CloudSyncState {
    return this.state;
  }

  hasPending(): boolean {
    return this.dirty || this.inFlight !== null;
  }

  /** After each successful local save. */
  schedule(): void {
    if (this.disposed || STOPPED.has(this.state.status)) return;
    this.dirty = true;
    // While offline the backoff timer is already set; a new save must not hammer the server.
    if (this.state.status === 'offline') return;
    if (this.state.status !== 'syncing') this.update({ status: 'pending', error: null });
    this.setTimer(this.options.debounceMs);
  }

  /** Uploads now if anything is waiting; resolves when idle. */
  async flush(): Promise<void> {
    this.clearTimer();
    while (!this.disposed) {
      if (this.inFlight) {
        await this.inFlight;
        continue;
      }
      if (!this.dirty || STOPPED.has(this.state.status)) return;
      this.inFlight = this.run();
      await this.inFlight;
      this.inFlight = null;
      if (this.state.status !== 'synced' && this.state.status !== 'pending') return;
    }
  }

  /** "Try again" from the user, or the browser came back online. */
  retryNow(): Promise<void> {
    if (this.state.status === 'offline' || this.state.status === 'error') {
      this.dirty = true;
      this.update({ status: 'pending', retryAt: null });
    }
    return this.flush();
  }

  dispose(): void {
    this.clearTimer();
    this.disposed = true;
  }

  private async run(): Promise<void> {
    this.dirty = false;
    this.update({ status: 'syncing', error: null, retryAt: null });
    try {
      const result = await this.options.push(this.state.cloudRevision);
      this.update({ status: this.dirty ? 'pending' : 'synced', cloudRevision: result.cloudRevision, attempt: 0, error: null });
    } catch (error) {
      // The local version still differs from the cloud one.
      this.dirty = true;
      const message = error instanceof Error ? error.message : String(error);
      if (isCloudError(error, 'conflict')) this.update({ status: 'conflict', error: message });
      else if (isCloudError(error, 'unauthorized')) this.update({ status: 'signedOut', error: message });
      else if (isCloudError(error, 'not_found')) this.update({ status: 'gone', error: message });
      else if (isCloudError(error) && error.transient) {
        const attempt = this.state.attempt + 1;
        const delay = this.options.backoffMs(attempt);
        this.update({ status: 'offline', error: message, attempt, retryAt: this.options.now() + delay });
        if (!this.disposed) this.setTimer(delay, true);
      } else {
        this.update({ status: 'error', error: message });
      }
    }
  }

  private setTimer(ms: number, retry = false) {
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      void (retry ? this.retryNow() : this.flush());
    }, ms);
  }

  private update(patch: Partial<CloudSyncState>) {
    this.state = { ...this.state, ...patch };
    if (!this.disposed) this.options.onChange(this.state);
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
