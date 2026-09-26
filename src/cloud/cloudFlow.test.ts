// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import markSvg from '@/tests/fixtures/mark.svg?raw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@/domain/ids';
import { createEmptyProject } from '@/domain/project';
import type { Asset, Project } from '@/domain/schema';
import { BrandfolioDb, setDb } from '@/storage/db';
import { createProject, getAssets, getProject, listProjects, saveProject } from '@/storage/projectRepository';
import { resetAccount, setSignedIn } from './account';
import { keepMineAsCloudCopy, openOnThisDevice, pushLinked, saveToCloud, takeCloudVersion } from './actions';
import { CloudError, type CloudApi } from './api';
import { ENTITLEMENTS, type Me } from './contract';
import { getLink } from './links';

/** In-memory server with the contract's revision and plan rules. */
function fakeServer(limit: number | null = null) {
  const projects = new Map<string, { project: Project; revision: number }>();
  const assets = new Map<string, Blob>();
  const log: string[] = [];
  const me: Me = {
    id: 'u1',
    email: 'a@b.c',
    name: 'A',
    plan: 'free',
    planUntil: null,
    entitlements: { ...ENTITLEMENTS.free, cloudProjects: limit },
    usage: { cloudProjects: 0 },
  };
  const unused = () => Promise.reject(new Error('not used in this test'));
  const api: CloudApi = {
    me: async () => me,
    register: unused,
    login: unused,
    logout: async () => undefined,
    listProjects: unused,
    getProject: async (id) => {
      const stored = projects.get(id);
      if (!stored) throw new CloudError('not_found', 404, 'missing');
      return { project: structuredClone(stored.project), revision: stored.revision, updatedAt: '', share: null };
    },
    putProject: async (project, baseRevision) => {
      log.push(`PUT ${project.id} base=${baseRevision}`);
      const stored = projects.get(project.id);
      if ((stored?.revision ?? null) !== baseRevision) throw new CloudError('conflict', 409, 'stale', { revision: stored?.revision });
      if (!stored && limit !== null && projects.size >= limit) throw new CloudError('plan_limit', 403, 'limit');
      const missing = project.assetIds.filter((id) => !assets.has(id));
      if (missing.length) throw new CloudError('bad_request', 400, 'missing', { missingAssets: missing });
      const revision = (stored?.revision ?? 0) + 1;
      projects.set(project.id, { project: structuredClone(project), revision });
      me.usage.cloudProjects = projects.size;
      return { revision, updatedAt: '' };
    },
    deleteProject: async (id) => void projects.delete(id),
    hasAsset: async (id) => {
      log.push(`HEAD ${id}`);
      return assets.has(id);
    },
    putAsset: async (id, _projectId, blob) => {
      log.push(`PUT asset ${id} ${blob.type}`);
      assets.set(id, blob);
    },
    getAsset: async (id) => {
      const blob = assets.get(id);
      if (!blob) throw new CloudError('not_found', 404, 'missing');
      return blob;
    },
    putShare: unused,
    getShared: unused,
    getSharedAsset: unused,
    adminSetPlan: unused,
  };
  return { api, projects, assets, log, me };
}

/** Each "device" is its own IndexedDB. */
const devices: BrandfolioDb[] = [];
function useDevice(db: BrandfolioDb) {
  setDb(db);
}
function newDevice() {
  const db = new BrandfolioDb(`test-${createId()}`);
  devices.push(db);
  return db;
}

async function projectWithLogo(title = 'Cloud brand'): Promise<Project> {
  const base = createEmptyProject(title);
  // A script inside the SVG must never survive a trip through the cloud.
  const dirty = markSvg.replace('</svg>', '<script>alert(1)</script></svg>');
  const asset: Asset = {
    id: createId('a'),
    projectId: base.id,
    kind: 'logo',
    mimeType: 'image/svg+xml',
    filename: 'mark.svg',
    byteSize: dirty.length,
    width: 10,
    height: 10,
    blob: new Blob([dirty], { type: 'image/svg+xml' }),
  };
  const project = { ...base, assetIds: [asset.id], brand: { ...base.brand, logo: { ...base.brand.logo, variants: { ...base.brand.logo.variants, primary: asset.id } } } };
  return createProject(project, [asset]);
}

let server: ReturnType<typeof fakeServer>;
beforeEach(() => {
  server = fakeServer();
  resetAccount(server.api);
  setSignedIn(server.me);
});
afterEach(async () => {
  for (const db of devices.splice(0)) await db.delete();
  setDb(null);
  resetAccount();
});

describe('cloud flow', () => {
  it('uploads assets before the project, then links it', async () => {
    const laptop = newDevice();
    useDevice(laptop);
    const project = await projectWithLogo();
    const link = await saveToCloud(project.id, server.api);
    const assetId = project.assetIds[0]!;
    expect(server.log).toEqual([`HEAD ${assetId}`, `PUT asset ${assetId} image/svg+xml`, `PUT ${project.id} base=null`]);
    expect(link).toMatchObject({ projectId: project.id, accountId: 'u1', cloudRevision: 1, syncedAt: project.updatedAt });
    expect(await getLink(project.id, 'u1')).toEqual(link);
    expect(await getLink(project.id, 'someone-else')).toBeNull();

    // Next push: the asset is known in this session, no HEAD again.
    server.log.length = 0;
    await pushLinked(project.id, 1, server.api);
    expect(server.log).toEqual([`PUT ${project.id} base=1`]);
  });

  it('re-uploads assets the server lost', async () => {
    useDevice(newDevice());
    const project = await projectWithLogo();
    await saveToCloud(project.id, server.api);
    server.assets.clear();
    await pushLinked(project.id, 1, server.api);
    expect(server.assets.size).toBe(1);
  });

  it('opens a cloud project on another device with the same ID and sanitised files', async () => {
    useDevice(newDevice());
    const project = await projectWithLogo();
    await saveToCloud(project.id, server.api);

    const phone = newDevice();
    useDevice(phone);
    const opened = await openOnThisDevice(project.id, server.api);
    expect(opened.id).toBe(project.id);
    const [asset] = await getAssets(opened.assetIds);
    expect(asset!.id).toBe(project.assetIds[0]);
    const svg = await asset!.blob.text();
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('<script');
    expect(await getLink(project.id, 'u1')).toMatchObject({ cloudRevision: 1 });
  });

  it('detects a conflict and resolves it by taking the cloud version, keeping mine as a copy', async () => {
    const laptop = newDevice();
    useDevice(laptop);
    const project = await projectWithLogo('Shared');
    await saveToCloud(project.id, server.api);

    const phone = newDevice();
    useDevice(phone);
    const onPhone = await openOnThisDevice(project.id, server.api);
    await saveProject({ ...onPhone, title: 'From phone' }, onPhone.revision);
    await pushLinked(project.id, 1, server.api);

    useDevice(laptop);
    const mine = await saveProject({ ...project, title: 'From laptop' }, project.revision);
    await expect(pushLinked(project.id, 1, server.api)).rejects.toMatchObject({ code: 'conflict' });
    expect(server.projects.get(project.id)!.project.title).toBe('From phone');

    const { fresh, copy } = await takeCloudVersion(mine, server.api);
    expect(fresh.title).toBe('From phone');
    expect((await getProject(project.id))!.title).toBe('From phone');
    expect(copy.title).toContain('From laptop');
    expect(await getLink(project.id, 'u1')).toMatchObject({ cloudRevision: 2 });
    expect(await getLink(copy.id, 'u1')).toBeNull();
    expect((await listProjects()).length).toBe(2);
  });

  it('resolves a conflict by saving mine as a new cloud project', async () => {
    const laptop = newDevice();
    useDevice(laptop);
    const project = await projectWithLogo('Shared');
    await saveToCloud(project.id, server.api);
    const cloudCopy = server.projects.get(project.id)!;
    server.projects.set(project.id, { project: { ...cloudCopy.project, title: 'Elsewhere' }, revision: 2 });

    const mine = await saveProject({ ...project, title: 'Mine' }, project.revision);
    const copy = await keepMineAsCloudCopy(mine, server.api);
    expect(server.projects.get(copy.id)!.project.title).toContain('Mine');
    expect(await getLink(copy.id, 'u1')).toMatchObject({ cloudRevision: 1 });
    expect((await getProject(project.id))!.title).toBe('Elsewhere');
    expect(await getLink(project.id, 'u1')).toMatchObject({ cloudRevision: 2 });
  });

  it('reports the plan limit without linking', async () => {
    server = fakeServer(1);
    resetAccount(server.api);
    setSignedIn(server.me);
    useDevice(newDevice());
    const first = await projectWithLogo('One');
    const second = await projectWithLogo('Two');
    await saveToCloud(first.id, server.api);
    await expect(saveToCloud(second.id, server.api)).rejects.toMatchObject({ code: 'plan_limit' });
    expect(await getLink(second.id, 'u1')).toBeNull();
  });
});
