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

export class BrandfolioDb extends Dexie {
  projects!: EntityTable<ProjectRecord, 'id'>;
  assets!: EntityTable<AssetRecord, 'id'>;

  constructor(name = 'brandfolio') {
    super(name);
    this.version(1).stores({
      projects: 'id, updatedAt, title',
      assets: 'id, projectId',
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
