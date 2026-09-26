// @vitest-environment jsdom
import { strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { describe, expect, it } from 'vitest';
import markSvg from '@/tests/fixtures/mark.svg?raw';
import { createEmptyProject } from '@/domain/project';
import type { Asset, Project } from '@/domain/schema';
import { ingestFile, type Decoder } from '@/features/assets/ingest';
import { buildTokens, exportArchive, ImportError, readArchive, unpackLimited } from './archive';

const decode: Decoder = async () => ({ width: 240, height: 240 });

function pngBytes(): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(64));
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(bytes.buffer).setUint32(16, 240);
  new DataView(bytes.buffer).setUint32(20, 240);
  return bytes;
}

async function sample(): Promise<{ project: Project; assets: Asset[] }> {
  const project = createEmptyProject('Тест');
  const logo = await ingestFile(new File([markSvg], 'mark.svg'), { kind: 'logo', projectId: project.id, decode });
  const image = await ingestFile(new File([pngBytes()], 'photo.png'), { kind: 'image', projectId: project.id, decode });
  if (!logo.ok || !image.ok) throw new Error('fixture');
  project.brand.logo.variants.primary = logo.asset.id;
  project.brand.imagery.images = [{ id: 'img1', assetId: image.asset.id, caption: 'Фото', focalX: 50, focalY: 50 }];
  project.assetIds = [logo.asset.id, image.asset.id];
  return { project, assets: [logo.asset, image.asset] };
}

async function zipOf(blob: Blob) {
  return unzipSync(new Uint8Array(await blob.arrayBuffer()));
}
const blobOf = (files: Zippable) => new Blob([zipSync(files)]);

describe('project archive', () => {
  it('round-trips a project with new IDs and valid references', async () => {
    const { project, assets } = await sample();
    const blob = await exportArchive(project, assets);
    const files = await zipOf(blob);
    expect(Object.keys(files).sort()).toEqual(expect.arrayContaining(['project.json', 'tokens.json', 'tokens.css', 'README.txt']));

    const imported = await readArchive(blob, { decode });
    expect(imported.project.id).not.toBe(project.id);
    expect(imported.project.revision).toBe(0);
    expect(imported.project.title).toBe('Тест');
    expect(imported.assets).toHaveLength(2);
    const ids = new Set(imported.assets.map((a) => a.id));
    expect(ids.has(imported.project.brand.logo.variants.primary!)).toBe(true);
    expect(ids.has(imported.project.brand.imagery.images[0]!.assetId)).toBe(true);
    expect(imported.assets.every((a) => a.projectId === imported.project.id)).toBe(true);
  });

  it('writes the README in the document language', async () => {
    const { project, assets } = await sample();
    const readme = async (language: Project['language']) => new TextDecoder().decode((await zipOf(await exportArchive({ ...project, language }, assets)))['README.txt']);
    expect(await readme('ru')).toContain('Как восстановить');
    expect(await readme('uz')).toContain('Qanday tiklash mumkin');
    expect(await readme('en')).toContain('How to restore');
  });

  it('writes CSS and JSON tokens from the palette', async () => {
    const { project } = await sample();
    project.brand.colors = [{ id: 'c1', name: 'Графит', role: 'text', hex: '#242424' }, { id: 'c2', name: 'Фон', role: 'background', hex: '#FFFFFF' }];
    const tokens = buildTokens(project);
    expect(tokens.css).toContain('#242424');
    expect(JSON.parse(tokens.json)).toBeTruthy();
  });

  it('rejects path traversal and unexpected files', () => {
    expect(() => unpackLimited(zipSync({ '../evil.txt': strToU8('x'), 'project.json': strToU8('{}') }))).toThrow(ImportError);
    expect(() => unpackLimited(zipSync({ 'project.json': strToU8('{}'), 'script.js': strToU8('x') }))).toThrow(/неожиданный файл/);
  });

  it('rejects oversized entries while inflating (zip bomb)', () => {
    const bomb = zipSync({ 'project.json': new Uint8Array(3 * 1024 * 1024) }, { level: 9 });
    expect(bomb.byteLength).toBeLessThan(100_000);
    expect(() => unpackLimited(bomb)).toThrow(/слишком большой/);
  });

  it('rejects too many files, empty and non-zip input', () => {
    const many: Zippable = { 'project.json': strToU8('{}') };
    for (let i = 0; i < 101; i++) many[`assets/a${i}.png`] = pngBytes();
    expect(() => unpackLimited(zipSync(many))).toThrow(/больше 100 файлов/);
    expect(() => unpackLimited(strToU8('not a zip at all, definitely not'))).toThrow(/не является ZIP/);
    expect(() => unpackLimited(zipSync({}))).toThrow(ImportError);
  });

  it('refuses archives from a newer schema version', async () => {
    const { project, assets } = await sample();
    const files = await zipOf(await exportArchive(project, assets));
    const doc = JSON.parse(new TextDecoder().decode(files['project.json']));
    files['project.json'] = strToU8(JSON.stringify({ ...doc, schemaVersion: 99 }));
    await expect(readArchive(blobOf(files), { decode })).rejects.toThrow(/более новой версией/);
  });

  it('refuses a missing or tampered asset file', async () => {
    const { project, assets } = await sample();
    const files = await zipOf(await exportArchive(project, assets));
    const assetPath = Object.keys(files).find((p) => p.endsWith('.png'))!;

    const missing = { ...files };
    delete missing[assetPath];
    await expect(readArchive(blobOf(missing), { decode })).rejects.toThrow(/отсутствует файл/);

    const tampered = { ...files, [assetPath]: new Uint8Array([...files[assetPath]!].map((b, i) => (i === 40 ? b ^ 1 : b))) };
    await expect(readArchive(blobOf(tampered), { decode })).rejects.toThrow(/контрольная сумма/);
  });

  it('refuses a project.json with broken references', async () => {
    const { project, assets } = await sample();
    const files = await zipOf(await exportArchive(project, assets));
    const doc = JSON.parse(new TextDecoder().decode(files['project.json']));
    doc.project.brand.logo.variants.primary = 'a_does_not_exist';
    files['project.json'] = strToU8(JSON.stringify(doc));
    await expect(readArchive(blobOf(files), { decode })).rejects.toThrow(ImportError);
  });
});
