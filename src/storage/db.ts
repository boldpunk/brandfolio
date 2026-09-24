import { Dexie, type EntityTable } from 'dexie';
import type { Asset, Project } from '@/domain/schema';

/** Stored project document. Validated with projectSchema on every write. */
export type ProjectRecord = Project;
/** Asset metadata plus binary. The Blob never enters the project document. */
export type AssetRecord = Asset;

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
