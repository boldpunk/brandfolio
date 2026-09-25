/**
 * Reads what the editor needs from a TrueType/OpenType file without a font
 * library: the family name (name table), the weight (OS/2 usWeightClass),
 * italic and embedding flags. Also proves the table directory is sane, so a
 * renamed ZIP or a truncated file is rejected before it reaches the PDF.
 */

export type FontFileType = 'font/ttf' | 'font/otf';

export type FontInfo = {
  type: FontFileType;
  family: string | null;
  /** usWeightClass rounded to a multiple of 100 in 100…900; 400 when unknown. */
  weight: number;
  italic: boolean;
  /** OS/2 fsType says the font must not be embedded (restricted license). */
  restricted: boolean;
  /** Has an fvar table: a variable font; only its default instance is used. */
  variable: boolean;
};

export function sniffFont(bytes: Uint8Array): FontFileType | null {
  if (bytes.length < 12) return null;
  const tag = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!);
  if (tag === 'OTTO') return 'font/otf';
  if (tag === 'true' || (bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0)) return 'font/ttf';
  return null;
}

type Table = { offset: number; length: number };

/** Parses the table directory; null when the file is not a well-formed sfnt. */
export function readFontInfo(bytes: Uint8Array): FontInfo | null {
  const type = sniffFont(bytes);
  if (!type) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const numTables = view.getUint16(4);
  if (numTables === 0 || numTables > 200 || 12 + numTables * 16 > bytes.length) return null;
  const tables = new Map<string, Table>();
  for (let i = 0; i < numTables; i++) {
    const at = 12 + i * 16;
    const tag = String.fromCharCode(bytes[at]!, bytes[at + 1]!, bytes[at + 2]!, bytes[at + 3]!);
    const offset = view.getUint32(at + 8);
    const length = view.getUint32(at + 12);
    if (offset + length > bytes.length) return null;
    tables.set(tag, { offset, length });
  }
  // Every usable font has these; without them it cannot be rendered.
  if (!tables.has('cmap') || !tables.has('head') || !(tables.has('glyf') || tables.has('CFF ') || tables.has('CFF2'))) return null;

  let weight = 400;
  let italic = false;
  let restricted = false;
  const os2 = tables.get('OS/2');
  if (os2 && os2.length >= 64) {
    const raw = view.getUint16(os2.offset + 4);
    if (raw >= 1 && raw <= 1000) weight = Math.min(900, Math.max(100, Math.round(raw / 100) * 100));
    // fsType bit 1 (0x0002) alone means "Restricted License embedding".
    restricted = (view.getUint16(os2.offset + 8) & 0x000f) === 0x0002;
    italic = (view.getUint16(os2.offset + 62) & 0x0001) !== 0;
  }
  return { type, family: readFamilyName(view, tables.get('name')), weight, italic, restricted, variable: tables.has('fvar') };
}

/** Typographic family (name ID 16) if present, else family (ID 1); Windows English first. */
function readFamilyName(view: DataView, table: Table | undefined): string | null {
  if (!table || table.length < 6) return null;
  const count = view.getUint16(table.offset + 2);
  const storage = table.offset + view.getUint16(table.offset + 4);
  const candidates: { score: number; value: string }[] = [];
  for (let i = 0; i < count; i++) {
    const at = table.offset + 6 + i * 12;
    if (at + 12 > table.offset + table.length) break;
    const platform = view.getUint16(at);
    const language = view.getUint16(at + 4);
    const nameId = view.getUint16(at + 6);
    const length = view.getUint16(at + 8);
    const offset = storage + view.getUint16(at + 10);
    if ((nameId !== 1 && nameId !== 16) || offset + length > view.byteLength) continue;
    let value = '';
    if (platform === 3 || platform === 0) {
      for (let j = 0; j + 1 < length; j += 2) value += String.fromCharCode(view.getUint16(offset + j));
    } else if (platform === 1) {
      for (let j = 0; j < length; j++) value += String.fromCharCode(view.getUint8(offset + j));
    } else continue;
    value = value.replace(/[\u0000-\u001f]/g, '').trim();
    if (!value) continue;
    const score = (nameId === 16 ? 4 : 0) + (platform === 3 ? 2 : 0) + (language === 0x409 || (platform === 1 && language === 0) ? 1 : 0);
    candidates.push({ score, value });
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.value.slice(0, 60) ?? null;
}
