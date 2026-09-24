// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import pngDataUrl from '@/tests/fixtures/ring-alpha.png?inline';
import markSvg from '@/tests/fixtures/mark.svg?raw';
import { headerDimensions, ingestFile, sniffType, type Decoder } from './ingest';

const okDecoder: Decoder = async () => ({ width: 240, height: 240 });
const brokenDecoder: Decoder = async () => {
  throw new Error('decode failed');
};

function pngHeader(width: number, height: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(64));
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}
const file = (bytes: BlobPart, name: string, type = '') => new File([bytes], name, { type });

describe('asset ingestion (A05)', () => {
  it('sniffs types from bytes', () => {
    expect(sniffType(pngHeader(1, 1))).toBe('image/png');
    expect(sniffType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffType(new TextEncoder().encode('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg">'))).toBe('image/svg+xml');
    expect(sniffType(new TextEncoder().encode('GIF89a'))).toBeNull();
  });

  it('reads JPEG dimensions from SOF', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0, 0, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x2c, 0x02, 0x58, 0x03]);
    expect(headerDimensions(jpeg, 'image/jpeg')).toEqual({ width: 600, height: 300 });
  });

  it('accepts a PNG with the right metadata', async () => {
    const bytes = Uint8Array.from(atob(pngDataUrl.split(',')[1]!), (c) => c.charCodeAt(0));
    const r = await ingestFile(file(bytes, 'C:\\fakepath\\Лого.PNG', 'image/png'), { kind: 'logo', projectId: 'p1', decode: okDecoder });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.asset).toMatchObject({ mimeType: 'image/png', filename: 'Лого.png', width: 240, height: 240, projectId: 'p1' });
  });

  it('rejects wrong types regardless of extension', async () => {
    const r = await ingestFile(file('GIF89a....', 'logo.png', 'image/png'), { kind: 'logo', projectId: 'p', decode: okDecoder });
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/Неподдерживаемый формат/) });
  });

  it('rejects oversize files and huge pixel counts before decoding', async () => {
    const big = await ingestFile(file(new Uint8Array(5 * 1024 * 1024 + 1), 'a.png'), { kind: 'logo', projectId: 'p', decode: okDecoder });
    expect(big).toMatchObject({ ok: false, error: expect.stringMatching(/5 МиБ/) });
    let decoded = false;
    const bomb = await ingestFile(file(pngHeader(10000, 10000), 'a.png'), {
      kind: 'image',
      projectId: 'p',
      decode: async () => ((decoded = true), { width: 1, height: 1 }),
    });
    expect(bomb).toMatchObject({ ok: false, error: expect.stringMatching(/20 мегапикселей/) });
    expect(decoded).toBe(false);
  });

  it('rejects corrupt images', async () => {
    const r = await ingestFile(file(pngHeader(10, 10), 'a.png'), { kind: 'logo', projectId: 'p', decode: brokenDecoder });
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/повреждён/) });
  });

  it('stores a sanitized SVG copy and refuses unsupported SVG', async () => {
    const ok = await ingestFile(file(markSvg, 'mark.svg'), { kind: 'logo', projectId: 'p' });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(await ok.asset.blob.text()).not.toContain('\n  <rect'); // rebuilt, not the original text
    const bad = await ingestFile(file('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><text>A</text></svg>', 'a.svg'), { kind: 'logo', projectId: 'p' });
    expect(bad).toMatchObject({ ok: false, error: expect.stringMatching(/PNG/) });
  });

  it('does not accept SVG for imagery', async () => {
    const r = await ingestFile(file(markSvg, 'mark.svg'), { kind: 'image', projectId: 'p' });
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/PNG или JPEG/) });
  });
});
