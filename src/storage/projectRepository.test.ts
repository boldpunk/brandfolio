import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@/domain/ids';
import { createEmptyProject } from '@/domain/project';
import type { Asset, Project } from '@/domain/schema';
import { BrandfolioDb, setDb } from './db';
import { RevisionConflictError } from './errors';
import {
  collectGarbage,
  createProject,
  deleteProject,
  duplicateProject,
  getAssets,
  getProject,
  listProjects,
  putAsset,
  saveAsCopy,
  saveProject,
} from './projectRepository';

let db: BrandfolioDb;
beforeEach(() => {
  db = new BrandfolioDb(`test-${createId()}`);
  setDb(db);
});
afterEach(async () => {
  await db.delete();
  setDb(null);
});

function logoAsset(projectId: string, id = createId('a')): Asset {
  return {
    id,
    projectId,
    kind: 'logo',
    mimeType: 'image/png',
    filename: 'logo.png',
    byteSize: 4,
    width: 10,
    height: 10,
    blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' }),
  };
}

async function projectWithLogo(): Promise<{ project: Project; asset: Asset }> {
  const project = createEmptyProject('Бренд');
  const asset = logoAsset(project.id);
  project.assetIds = [asset.id];
  project.brand.logo.variants.primary = asset.id;
  await createProject(project, [asset]);
  return { project, asset };
}

describe('projectRepository', () => {
  it('stores asset bytes as an ArrayBuffer and reads legacy Blob records', async () => {
    const { project, asset } = await projectWithLogo();
    const stored = await db.assets.get(asset.id);
    expect(stored?.blob).toBeUndefined();
    expect(stored?.bytes).toBeInstanceOf(ArrayBuffer);
    const [read] = await getAssets([asset.id]);
    expect(read!.blob.type).toBe('image/png');
    expect([...new Uint8Array(await read!.blob.arrayBuffer())]).toEqual([1, 2, 3, 4]);

    const legacy = logoAsset(project.id);
    await db.assets.put(legacy);
    const [old] = await getAssets([legacy.id]);
    expect([...new Uint8Array(await old!.blob.arrayBuffer())]).toEqual([1, 2, 3, 4]);
  });

  it('creates, reads and lists projects', async () => {
    const { project } = await projectWithLogo();
    expect(await getProject(project.id)).toEqual(project);
    const list = await listProjects();
    expect(list).toHaveLength(1);
    expect(list[0]!.logoAssetId).toBe(project.brand.logo.variants.primary);
  });

  it('refuses to create a project whose asset files are missing (no partial write)', async () => {
    const project = createEmptyProject('X');
    project.assetIds = ['a_missing'];
    project.brand.logo.variants.primary = 'a_missing';
    await expect(createProject(project, [])).rejects.toThrow();
    expect(await listProjects()).toHaveLength(0);
  });

  it('increments revision and detects a conflicting save from another tab (A11)', async () => {
    const { project } = await projectWithLogo();
    const tabA = await saveProject({ ...project, title: 'A' }, 0);
    expect(tabA.revision).toBe(1);
    // Tab B still believes revision 0.
    await expect(saveProject({ ...project, title: 'B' }, 0)).rejects.toBeInstanceOf(RevisionConflictError);
    expect((await getProject(project.id))!.title).toBe('A');
  });

  it('rejects invalid documents without writing', async () => {
    const { project } = await projectWithLogo();
    await expect(saveProject({ ...project, title: '' }, 0)).rejects.toThrow();
    expect((await getProject(project.id))!.revision).toBe(0);
  });

  it('duplicates with independent assets; deleting the copy keeps the original (A02)', async () => {
    const { project, asset } = await projectWithLogo();
    const copy = await duplicateProject(project.id);
    expect(copy.id).not.toBe(project.id);
    expect(copy.title).toBe('Бренд (копия)');
    expect(copy.assetIds[0]).not.toBe(asset.id);
    expect(copy.brand.logo.variants.primary).toBe(copy.assetIds[0]);
    expect(copy.brand.colors.map((c) => c.id)).not.toEqual(project.brand.colors.map((c) => c.id));

    await saveProject({ ...copy, title: 'Изменённая копия' }, 0);
    await deleteProject(copy.id);

    const original = await getProject(project.id);
    expect(original).toEqual(project);
    const [originalAsset] = await getAssets([asset.id]);
    expect(await originalAsset!.blob.arrayBuffer()).toEqual(await asset.blob.arrayBuffer());
    expect(await getAssets(copy.assetIds)).toHaveLength(0);
  });

  it('saves the in-memory state as a copy after a conflict', async () => {
    const { project } = await projectWithLogo();
    const copy = await saveAsCopy({ ...project, title: 'Локальная версия' });
    expect(copy.title).toBe('Локальная версия (копия)');
    expect(await getAssets(copy.assetIds)).toHaveLength(1);
  });

  it('collects unreferenced assets when a project is opened', async () => {
    const { project, asset } = await projectWithLogo();
    const extra = logoAsset(project.id);
    await putAsset(extra);
    // The user removed the logo; assetIds still lists it for undo.
    const saved = await saveProject(
      { ...project, assetIds: [asset.id, extra.id], brand: { ...project.brand, logo: { ...project.brand.logo, variants: { ...project.brand.logo.variants, primary: extra.id } } } },
      0,
    );
    const cleaned = await collectGarbage(project.id);
    expect(cleaned!.assetIds).toEqual([extra.id]);
    expect(cleaned!.revision).toBe(saved.revision);
    expect(await getAssets([asset.id])).toHaveLength(0);
  });

  it('refuses to save references to assets that were never stored', async () => {
    const { project } = await projectWithLogo();
    const ghost = createId('a');
    const broken = { ...project, assetIds: [...project.assetIds, ghost] };
    broken.brand = { ...project.brand, logo: { ...project.brand.logo, variants: { ...project.brand.logo.variants, mark: ghost } } };
    await expect(saveProject(broken, 0)).rejects.toThrow(/Нет файлов/);
  });
});
