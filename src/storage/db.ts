import { Dexie, type EntityTable } from 'dexie';
import type { Asset, Project } from '@/domain/schema';

/** Stored project document. Validated with projectSchema on every write. */
export type ProjectRecord = Project;
/**
 * Asset metadata plus binary. The binary is stored as an ArrayBuffer: WebKit
 * (Safari private windows, Playwright's WebKit) refuses Blobs in IndexedDB.
 * Records written before that change still carry `blob` and stay readable.
 */
export type AssetRecord = Omit<Asset, 'blob'> & { bytes?: ArrayBuffer; blob?: Blob };
/**
 * A local project that is also stored in the cloud (same ID on both sides).
 * `cloudRevision` is the server revision this device last wrote or read;
 * `accountId` keeps links of one account from acting for another one.
 */
export type CloudLinkRecord = { projectId: string; accountId: string; cloudRevision: number; syncedAt: string };

export class BrandfolioDb extends Dexie {
  projects!: EntityTable<ProjectRecord, 'id'>;
  assets!: EntityTable<AssetRecord, 'id'>;
  cloudLinks!: EntityTable<CloudLinkRecord, 'projectId'>;

  constructor(name = 'brandfolio') {
    super(name);
    this.version(1).stores({
      projects: 'id, updatedAt, title',
      assets: 'id, projectId',
    });
    // v2 only adds the cloud link table; v1 stores stay as they are.
    this.version(2).stores({
      projects: 'id, updatedAt, title',
      assets: 'id, projectId',
      cloudLinks: 'projectId, accountId',
    });
  }
}

let instance: BrandfolioDb | null = null;
export function getDb(): BrandfolioDb {
  instance ??= new BrandfolioDb();
  return instance;
}
/** Tests use isolated databases. */
export function setDb(db: BrandfolioDb | null) {
  instance = db;
}
