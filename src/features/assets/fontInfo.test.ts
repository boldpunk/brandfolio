import { describe, expect, it } from 'vitest';
import manropeUrl from '../../../public/fonts/Manrope-700.ttf?inline';
import notoSerifUrl from '../../../public/fonts/NotoSerif-400.ttf?inline';
import { ingestFile } from './ingest';
import { readFontInfo, sniffFont } from './fontInfo';

const fromDataUrl = (url: string) => Uint8Array.from(atob(url.slice(url.indexOf(',') + 1)), (c) => c.charCodeAt(0));
const manrope700 = fromDataUrl(manropeUrl);
const notoSerif400 = fromDataUrl(notoSerifUrl);

describe('readFontInfo', () => {
  it('reads family and weight of bundled fonts', () => {
    expect(readFontInfo(manrope700)).toMatchObject({ type: 'font/ttf', family: 'Manrope', weight: 700, italic: false, restricted: false });
    expect(readFontInfo(notoSerif400)).toMatchObject({ family: 'Noto Serif', weight: 400 });
  });

  it('rejects non-fonts and truncated files', () => {
    expect(sniffFont(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(readFontInfo(new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull(); // WOFF2
    expect(readFontInfo(manrope700.slice(0, 400))).toBeNull();
  });

  it('flags fonts whose license forbids embedding', () => {
    const copy = manrope700.slice();
    const view = new DataView(copy.buffer);
    const tables = view.getUint16(4);
    for (let i = 0; i < tables; i++) {
      const at = 12 + i * 16;
      if (String.fromCharCode(...copy.slice(at, at + 4)) === 'OS/2') view.setUint16(view.getUint32(at + 8) + 8, 0x0002);
    }
    expect(readFontInfo(copy)?.restricted).toBe(true);
  });
});

describe('ingestFile for fonts', () => {
  const ok = async () => {};
  it('stores a TTF as a font asset with its detected family', async () => {
    const result = await ingestFile(new File([manrope700], 'Manrope-Bold.ttf'), { kind: 'font', projectId: 'p1', validateFont: ok });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asset).toMatchObject({ kind: 'font', mimeType: 'font/ttf', filename: 'Manrope-Bold.ttf', projectId: 'p1' });
    expect(result.font?.weight).toBe(700);
  });

  it('rejects images and files the browser cannot load', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect((await ingestFile(new File([png], 'x.ttf'), { kind: 'font', projectId: 'p1', validateFont: ok })).ok).toBe(false);
    const broken = await ingestFile(new File([manrope700], 'x.ttf'), { kind: 'font', projectId: 'p1', validateFont: () => Promise.reject(new Error('bad')) });
    expect(broken.ok).toBe(false);
  });
});
