/**
 * Validates an uploaded file and turns it into an Asset ready for storage.
 * The file type is taken from its bytes, not from the name or browser MIME.
 * Brand fonts (kind 'font') accept TTF/OTF only and report what they found
 * (family name, weight) so the editor can prefill the form.
 */
import { createId } from '@/domain/ids';
import { ASSET_LIMITS } from '@/domain/limits';
import type { Asset, AssetKind, AssetMimeType } from '@/domain/schema';
import { msg } from '@/i18n/core';
import { assetsMessages } from '@/i18n/messages/assets';
import { readFontInfo, type FontInfo } from './fontInfo';
import { sanitizeSvg } from './svgSanitizer';

export type IngestResult = { ok: true; asset: Asset; notes: string[]; font?: FontInfo } | { ok: false; error: string };

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

/** Proves the browser can use a font file. Injectable for tests (Node has no FontFace). */
export type FontValidator = (bytes: Uint8Array) => Promise<void>;

export const browserFontValidator: FontValidator = async (bytes) => {
  if (typeof FontFace === 'undefined') return;
  await new FontFace('bf-probe', bytes.slice().buffer).load();
};

type ImageMimeType = Exclude<AssetMimeType, 'font/ttf' | 'font/otf'>;

export function sniffType(bytes: Uint8Array): ImageMimeType | null {
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

const EXTENSIONS: Record<AssetMimeType, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/svg+xml': 'svg', 'font/ttf': 'ttf', 'font/otf': 'otf' };

function cleanFilename(name: string, type: AssetMimeType): string {
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  const base = name.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f]/g, '').trim() || 'file';
  const stem = base.replace(/\.[^.]*$/, '').slice(0, 200) || 'file';
  return `${stem}.${EXTENSIONS[type]}`;
}

export async function ingestFile(
  file: File,
  options: { kind: AssetKind; projectId: string; allowSvg?: boolean; decode?: Decoder; validateFont?: FontValidator },
): Promise<IngestResult> {
  const { kind, projectId, allowSvg = kind === 'logo', decode = browserDecoder } = options;
  const m = msg(assetsMessages);
  if (kind === 'font') return ingestFont(file, projectId, options.validateFont ?? browserFontValidator);
  const allowed = allowSvg ? m.allowedWithSvg : m.allowedRaster;
  if (file.size === 0) return { ok: false, error: m.empty };
  if (file.size > ASSET_LIMITS.maxBytes) {
    return { ok: false, error: m.tooBig((file.size / 1024 / 1024).toFixed(1)) };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffType(bytes);
  if (!type || (type === 'image/svg+xml' && !allowSvg)) {
    return { ok: false, error: m.unsupported(allowed) };
  }

  if (type === 'image/svg+xml') {
    let source: string;
    try {
      source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return { ok: false, error: m.svgEncoding };
    }
    const result = sanitizeSvg(source);
    if (!result.ok) return { ok: false, error: result.reason };
    const blob = new Blob([result.svg], { type });
    return {
      ok: true,
      notes: result.removed.length ? [m.svgCleaned] : [],
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
  if (!header || header.width === 0 || header.height === 0) return { ok: false, error: m.noDimensions };
  if (header.width * header.height > ASSET_LIMITS.maxPixels) {
    return { ok: false, error: m.tooManyPixels(header.width, header.height) };
  }
  const blob = new Blob([bytes], { type });
  let size: Dimensions;
  try {
    size = await decode(blob);
  } catch {
    return { ok: false, error: m.decodeFailed };
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

async function ingestFont(file: File, projectId: string, validate: FontValidator): Promise<IngestResult> {
  const m = msg(assetsMessages);
  if (file.size === 0) return { ok: false, error: m.empty };
  if (file.size > ASSET_LIMITS.maxBytes) return { ok: false, error: m.tooBig((file.size / 1024 / 1024).toFixed(1)) };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = readFontInfo(bytes);
  if (!info) return { ok: false, error: m.font.invalid };
  if (info.restricted) return { ok: false, error: m.font.restricted };
  if (info.italic) return { ok: false, error: m.font.italic };
  try {
    await validate(bytes);
  } catch {
    return { ok: false, error: m.font.loadFailed };
  }
  const blob = new Blob([bytes], { type: info.type });
  return {
    ok: true,
    notes: info.variable ? [m.font.variable] : [],
    font: info,
    asset: { id: createId('a'), projectId, kind: 'font', mimeType: info.type, filename: cleanFilename(file.name, info.type), byteSize: blob.size, blob },
  };
}
