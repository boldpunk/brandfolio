/**
 * Validates an uploaded file and turns it into an Asset ready for storage.
 * The file type is taken from its bytes, not from the name or browser MIME.
 */
import { createId } from '@/domain/ids';
import { ASSET_LIMITS } from '@/domain/limits';
import type { Asset, AssetKind, AssetMimeType } from '@/domain/schema';
import { sanitizeSvg } from './svgSanitizer';

export type IngestResult = { ok: true; asset: Asset; notes: string[] } | { ok: false; error: string };

type Dimensions = { width: number; height: number };

/** Decodes the image fully to prove it is not corrupt. Injectable for tests. */
export type Decoder = (blob: Blob) => Promise<Dimensions>;

export const browserDecoder: Decoder = async (blob) => {
  const bitmap = await createImageBitmap(blob);
  try {
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
};

export function sniffType(bytes: Uint8Array): AssetMimeType | null {
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 1024)).replace(/^\uFEFF/, '').trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(head) || /^<\?xml/i.test(head) && /<svg[\s>]/i.test(head)) {
    return 'image/svg+xml';
  }
  return null;
}

/** Reads dimensions from the file header, before any decoding (guards decompression bombs). */
export function headerDimensions(bytes: Uint8Array, type: 'image/png' | 'image/jpeg'): Dimensions | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (type === 'image/png') {
    if (bytes.length < 24) return null;
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1]!;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = view.getUint16(offset + 2);
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
    offset += 2 + length;
  }
  return null;
}

const EXTENSIONS: Record<AssetMimeType, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/svg+xml': 'svg' };

function cleanFilename(name: string, type: AssetMimeType): string {
  const base = name.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f]/g, '').trim() || 'file';
  const stem = base.replace(/\.[^.]*$/, '').slice(0, 200) || 'file';
  return `${stem}.${EXTENSIONS[type]}`;
}

export async function ingestFile(
  file: File,
  options: { kind: AssetKind; projectId: string; allowSvg?: boolean; decode?: Decoder },
): Promise<IngestResult> {
  const { kind, projectId, allowSvg = kind === 'logo', decode = browserDecoder } = options;
  const allowed = allowSvg ? 'PNG, JPEG или SVG' : 'PNG или JPEG';
  if (file.size === 0) return { ok: false, error: 'Файл пустой.' };
  if (file.size > ASSET_LIMITS.maxBytes) {
    return { ok: false, error: `Файл больше 5 МиБ (${(file.size / 1024 / 1024).toFixed(1)} МиБ). Уменьшите его и загрузите снова.` };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffType(bytes);
  if (!type || (type === 'image/svg+xml' && !allowSvg)) {
    return { ok: false, error: `Неподдерживаемый формат. Загрузите ${allowed}.` };
  }

  if (type === 'image/svg+xml') {
    let source: string;
    try {
      source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return { ok: false, error: 'SVG не в кодировке UTF-8 или повреждён.' };
    }
    const result = sanitizeSvg(source);
    if (!result.ok) return { ok: false, error: result.reason };
    const blob = new Blob([result.svg], { type });
    return {
      ok: true,
      notes: result.removed.length ? ['Из SVG удалены служебные данные и небезопасные атрибуты.'] : [],
      asset: {
        id: createId('a'),
        projectId,
        kind,
        mimeType: type,
        filename: cleanFilename(file.name, type),
        byteSize: blob.size,
        width: Math.max(1, Math.round(result.width)),
        height: Math.max(1, Math.round(result.height)),
        blob,
      },
    };
  }

  const header = headerDimensions(bytes, type);
  if (!header || header.width === 0 || header.height === 0) return { ok: false, error: 'Файл повреждён: не удалось прочитать размеры изображения.' };
  if (header.width * header.height > ASSET_LIMITS.maxPixels) {
    return { ok: false, error: `Изображение ${header.width}×${header.height} больше 20 мегапикселей. Уменьшите его.` };
  }
  const blob = new Blob([bytes], { type });
  let size: Dimensions;
  try {
    size = await decode(blob);
  } catch {
    return { ok: false, error: 'Файл повреждён: браузер не смог его открыть.' };
  }
  return {
    ok: true,
    notes: [],
    asset: {
      id: createId('a'),
      projectId,
      kind,
      mimeType: type,
      filename: cleanFilename(file.name, type),
      byteSize: blob.size,
      width: size.width,
      height: size.height,
      blob,
    },
  };
}
