/**
 * Serialises autosave writes for one open project.
 *
 * - Debounces edits, flushes on demand (Ctrl/Cmd+S, leaving the project).
 * - Only one write is in flight; edits made meanwhile are written after it,
 *   so an older async save can never land on top of a newer revision.
 * - Reports "saved" only after the transaction succeeded.
 * - On a revision conflict it stops autosaving until the user decides.
 */
import type { Project } from '@/domain/schema';
import { RevisionConflictError, StorageWriteError } from '@/storage/errors';

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';

export type SaveState = {
  status: SaveStatus;
  error: string | null;
  quotaExceeded: boolean;
  savedRevision: number;
  savedAt: string | null;
};

type Options = {
  save: (project: Project, expectedRevision: number) => Promise<Project>;
  initialRevision: number;
  debounceMs: number;
  onChange: (state: SaveState) => void;
};

export class SaveController {
  private readonly options: Options;
  private state: SaveState;
  private pending: Project | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<void> | null = null;
  private disposed = false;

  constructor(options: Options) {
    this.options = options;
    this.state = { status: 'saved', error: null, quotaExceeded: false, savedRevision: options.initialRevision, savedAt: null };
  }

  getState(): SaveState {
    return this.state;
  }

  hasUnsavedChanges(): boolean {
    return this.pending !== null || this.inFlight !== null;
  }

  /** Called after every edit with the latest document. */
  schedule(project: Project): void {
    if (this.disposed) return;
    this.pending = project;
    // Keep edits in memory. After a conflict we never overwrite; after a storage
    // error the user retries explicitly, so the error stays visible.
    if (this.state.status === 'conflict' || this.state.status === 'error') return;
    if (this.state.status !== 'saving') this.update({ status: 'dirty' });
    this.clearTimer();
    this.timer = setTimeout(() => void this.flush(), this.options.debounceMs);
  }

  /** Writes pending changes now and resolves when nothing is left to write. */
  async flush(): Promise<void> {
    this.clearTimer();
    while (!this.disposed) {
      if (this.inFlight) {
        await this.inFlight;
        continue;
      }
      if (!this.pending || this.state.status === 'conflict') return;
      if (this.state.status === 'error' && !this.retrying) return;
      this.retrying = false;
      const snapshot = this.pending;
      this.inFlight = this.write(snapshot);
      await this.inFlight;
      this.inFlight = null;
      if (this.state.status === 'error' || this.state.status === 'conflict') return;
    }
  }

  private retrying = false;

  /** Retry after a storage error. */
  retry(): Promise<void> {
    if (this.state.status !== 'error') return this.flush();
    this.retrying = true;
    this.update({ status: 'dirty', error: null, quotaExceeded: false });
    return this.flush();
  }

  /** After the user reloaded the fresh version from storage. */
  reset(revision: number): void {
    this.clearTimer();
    this.pending = null;
    this.update({ status: 'saved', error: null, quotaExceeded: false, savedRevision: revision });
  }

  dispose(): void {
    this.clearTimer();
    this.disposed = true;
  }

  private async write(snapshot: Project): Promise<void> {
    this.update({ status: 'saving', error: null });
    try {
      const saved = await this.options.save(snapshot, this.state.savedRevision);
      if (this.pending === snapshot) this.pending = null;
      this.update({
        status: this.pending ? 'dirty' : 'saved',
        savedRevision: saved.revision,
        savedAt: saved.updatedAt,
        error: null,
        quotaExceeded: false,
      });
    } catch (error) {
      if (error instanceof RevisionConflictError) {
        this.update({ status: 'conflict', error: error.message });
      } else {
        this.update({
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
          quotaExceeded: error instanceof StorageWriteError && error.quota,
        });
      }
    }
  }

  private update(patch: Partial<SaveState>) {
    this.state = { ...this.state, ...patch };
    this.options.onChange(this.state);
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
