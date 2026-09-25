/** Magic-byte checks: the declared Content-Type must match what the bytes are. */
export const ASSET_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'font/ttf', 'font/otf'] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export function isAssetType(value: string): value is AssetType {
  return (ASSET_TYPES as readonly string[]).includes(value);
}

const startsWith = (bytes: Uint8Array, prefix: readonly number[]) =>
  bytes.length >= prefix.length && prefix.every((b, i) => bytes[i] === b);
const ascii = (s: string) => [...s].map((ch) => ch.charCodeAt(0));

function looksLikeSvg(bytes: Uint8Array): boolean {
  // Skip a UTF-8 BOM and leading whitespace, then expect <svg or <?xml.
  const head = new TextDecoder('utf-8', { fatal: false })
    .decode(bytes.subarray(0, 256))
    .replace(/^﻿/, '')
    .trimStart();
  return /^<svg[\s>/]/i.test(head) || head.startsWith('<?xml');
}

export function bytesMatchType(bytes: Uint8Array, type: AssetType): boolean {
  switch (type) {
    case 'image/png':
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/jpeg':
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case 'image/svg+xml':
      return looksLikeSvg(bytes);
    case 'font/ttf':
      return startsWith(bytes, [0x00, 0x01, 0x00, 0x00]) || startsWith(bytes, ascii('true'));
    case 'font/otf':
      return startsWith(bytes, ascii('OTTO'));
  }
}
