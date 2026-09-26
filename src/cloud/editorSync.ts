/**
 * Cloud side of one open editor: finds the project's cloud link for the
 * signed-in account and, if there is one, runs a CloudSyncScheduler that
 * uploads after every successful local save.
 */
import { getProject } from '@/storage/projectRepository';
import { ensureAccount } from './account';
import { pushLinked } from './actions';
import { getLink } from './links';
import { CloudSyncScheduler, type CloudSyncState } from './syncScheduler';

export type EditorCloudState =
  /** No API, signed out, or still finding out: cloud UI stays hidden. */
  | { kind: 'off' }
  /** Signed in, this project is only on this device. */
  | { kind: 'local' }
  | { kind: 'linked'; sync: CloudSyncState };

export class EditorCloudSession {
  private readonly projectId: string;
  private readonly onChange: (state: EditorCloudState) => void;
  private scheduler: CloudSyncScheduler | null = null;
  private generation = 0;
  private disposed = false;
  private readonly onOnline = () => void this.scheduler?.retryNow();

  constructor(projectId: string, onChange: (state: EditorCloudState) => void) {
    this.projectId = projectId;
    this.onChange = onChange;
    globalThis.addEventListener?.('online', this.onOnline);
  }

  /** (Re)reads the account and link. Called at start and after linking or resolving a conflict. */
  async start(): Promise<void> {
    const generation = ++this.generation;
    this.scheduler?.dispose();
    this.scheduler = null;
    const account = await ensureAccount();
    if (this.stale(generation)) return;
    if (account.status !== 'signedIn') return this.onChange({ kind: 'off' });
    const accountId = account.me.id;
    const link = await getLink(this.projectId, accountId).catch(() => null);
    if (this.stale(generation)) return;
    if (!link) return this.onChange({ kind: 'local' });

    const scheduler = new CloudSyncScheduler({
      initialRevision: link.cloudRevision,
      push: async (baseRevision) => ({ cloudRevision: (await pushLinked(this.projectId, baseRevision)).cloudRevision }),
      onChange: (sync) => !this.stale(generation) && this.onChange({ kind: 'linked', sync }),
    });
    this.scheduler = scheduler;
    this.onChange({ kind: 'linked', sync: scheduler.getState() });

    // Saved here while offline or in another session: upload now.
    const project = await getProject(this.projectId).catch(() => null);
    if (!this.stale(generation) && project && project.updatedAt > link.syncedAt) scheduler.schedule();
  }

  /** After each successful local save. */
  localSaved(): void {
    this.scheduler?.schedule();
  }

  retry(): Promise<void> {
    return this.scheduler?.retryNow() ?? Promise.resolve();
  }

  /** Leaving the editor: upload what is waiting, then stop. */
  async leave(): Promise<void> {
    const scheduler = this.scheduler;
    this.dispose();
    if (scheduler?.hasPending()) await scheduler.flush().catch(() => undefined);
    scheduler?.dispose();
  }

  dispose(): void {
    this.disposed = true;
    this.generation++;
    globalThis.removeEventListener?.('online', this.onOnline);
  }

  private stale(generation: number): boolean {
    return this.disposed || generation !== this.generation;
  }
}
