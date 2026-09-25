/**
 * Text and binary files of the media kit, as pure functions: palettes (CSS,
 * Adobe ASE, GIMP GPL), the HTML email signature and the README.
 */
import { contrastRatio, hexToRgb } from '@/domain/color';
import type { LogoVariantKind } from '@/domain/schema';
import { fileBaseName } from '@/features/export/fileNames';
import type { mediakitMessages } from '@/i18n/messages/mediakit';
import { COLOR_FILES, COVER_FORMATS, FAVICON_FORMATS, LOGO_KINDS, LOGO_ON_BRAND, LOGO_RENDER_PX, README_PATH, SIGNATURE_PATH, SOCIAL_FORMATS } from './formats';

export type PaletteColor = { name: string; hex: string };
export type RoleColors = { background: string; text: string; primary: string; secondary: string; accent: string };

// ---------------------------------------------------------------- CSS

const cssComment = (text: string) => text.replace(/\*\//g, '* /').replace(/[\r\n]+/g, ' ');

/** ASCII custom property suffixes from color names, unique, `color-N` when nothing is left. */
export function colorSlugs(colors: readonly PaletteColor[]): string[] {
  const used = new Set<string>();
  return colors.map((c, i) => {
    const base = fileBaseName(c.name).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || `color-${i + 1}`;
    let slug = base;
    for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
    used.add(slug);
    return slug;
  });
}

export function colorsCss(brandName: string, colors: readonly PaletteColor[], roles: RoleColors): string {
  const slugs = colorSlugs(colors);
  return [
    `/* ${cssComment(brandName)}: brand colors (Brandfolio media kit) */`,
    ':root {',
    ...(['background', 'text', 'primary', 'secondary', 'accent'] as const).map((r) => `  --brand-${r}: ${roles[r]};`),
    '',
    ...colors.map((c, i) => `  --color-${slugs[i]}: ${c.hex}; /* ${cssComment(c.name)} */`),
    '}',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------- GIMP / Inkscape

const gplText = (text: string) => text.replace(/[\r\n\t]+/g, ' ').trim();

/** GIMP palette (.gpl), read by GIMP, Inkscape and Krita. UTF-8. */
export function gplPalette(brandName: string, colors: readonly PaletteColor[]): string {
  const lines = ['GIMP Palette', `Name: ${gplText(brandName) || 'Brand'}`, `Columns: ${Math.min(Math.max(colors.length, 1), 8)}`, '#'];
  for (const c of colors) {
    const { r, g, b } = hexToRgb(c.hex);
    lines.push(`${String(r).padStart(3)} ${String(g).padStart(3)} ${String(b).padStart(3)}\t${gplText(c.name) || c.hex}`);
  }
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------- Adobe Swatch Exchange

const ASE_GROUP_START = 0xc001;
const ASE_GROUP_END = 0xc002;
const ASE_COLOR = 0x0001;
/** Color type: 0 global, 1 spot, 2 normal (process). */
const ASE_NORMAL = 2;

/** UTF-16 code units of the name plus the terminating zero, as ASE stores it. */
function aseName(name: string): number[] {
  const units: number[] = [];
  for (let i = 0; i < name.length; i++) units.push(name.charCodeAt(i));
  units.push(0);
  return units;
}

/**
 * Adobe Swatch Exchange 1.0, big-endian: "ASEF", version 1.0, block count,
 * then a group with one RGB color block per swatch (three float32 in 0..1).
 */
export function asePalette(groupName: string, colors: readonly PaletteColor[]): Uint8Array<ArrayBuffer> {
  type Block = { type: number; name?: number[]; rgb?: [number, number, number] };
  const blocks: Block[] = [
    { type: ASE_GROUP_START, name: aseName(groupName) },
    ...colors.map<Block>((c) => {
      const { r, g, b } = hexToRgb(c.hex);
      return { type: ASE_COLOR, name: aseName(c.name || c.hex), rgb: [r / 255, g / 255, b / 255] };
    }),
    { type: ASE_GROUP_END },
  ];
  const bodyLength = (b: Block) => (b.name ? 2 + b.name.length * 2 : 0) + (b.rgb ? 4 + 12 + 2 : 0);
  const total = 12 + blocks.reduce((sum, b) => sum + 6 + bodyLength(b), 0);
  const view = new DataView(new ArrayBuffer(total));
  let o = 0;
  const u8 = (v: number) => view.setUint8(o++, v);
  const u16 = (v: number) => (view.setUint16(o, v), (o += 2));
  const u32 = (v: number) => (view.setUint32(o, v), (o += 4));
  for (const ch of 'ASEF') u8(ch.charCodeAt(0));
  u16(1);
  u16(0);
  u32(blocks.length);
  for (const block of blocks) {
    u16(block.type);
    u32(bodyLength(block));
    if (block.name) {
      u16(block.name.length);
      block.name.forEach(u16);
    }
    if (block.rgb) {
      for (const ch of 'RGB ') u8(ch.charCodeAt(0));
      for (const v of block.rgb) {
        view.setFloat32(o, v);
        o += 4;
      }
      u16(ASE_NORMAL);
    }
  }
  return new Uint8Array(view.buffer);
}

// ---------------------------------------------------------------- email signature

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** A font name inside a style attribute; quotes and separators removed. */
const cssFontName = (label: string) => label.replace(/["'\\;<>{}]/g, '').trim();

export type FontCategory = 'sans' | 'serif' | 'display' | 'mono';

export function fontStack(label: string, category: FontCategory): string {
  const generic = category === 'serif' ? 'Georgia, \'Times New Roman\', serif' : category === 'mono' ? '\'Courier New\', monospace' : 'Arial, Helvetica, sans-serif';
  const name = cssFontName(label);
  return name ? `'${name}', ${generic}` : generic;
}

/** http(s) URL for a link, or null when the value is not a web address. */
export function safeWebUrl(value: string): string | null {
  const v = value.trim();
  if (!v || /\s/.test(v)) return null;
  const withScheme = /^https?:\/\//i.test(v) ? v : /^[a-z][a-z0-9+.-]*:/i.test(v) ? null : `https://${v}`;
  if (!withScheme) return null;
  try {
    const url = new URL(withScheme);
    return url.hostname.includes('.') ? url.href : null;
  } catch {
    return null;
  }
}

export function safeEmail(value: string): string | null {
  const v = value.trim();
  return /^[^\s@<>"'()\\,;:]+@[^\s@<>"'()\\,;:]+\.[^\s@<>"'()\\,;:]+$/.test(v) ? v : null;
}

export type SignatureInput = {
  lang: string;
  brandName: string;
  personName: string;
  personRole: string;
  organization: string;
  email: string;
  website: string;
  /** Relative path inside the kit; the README explains it must be hosted. */
  logo: { src: string; width: number; height: number } | null;
  colors: { text: string; muted: string; primary: string };
  fonts: { heading: string; body: string };
  hostingComment: string;
};

/** Signature background: email clients show it on white. */
const SIGNATURE_SURFACE = '#FFFFFF';

export function emailSignature(input: SignatureInput): string {
  const { fonts } = input;
  const colors = { ...input.colors, text: contrastRatio(input.colors.text, SIGNATURE_SURFACE) >= 4.5 ? input.colors.text : '#191919' };
  const link = contrastRatio(colors.primary, SIGNATURE_SURFACE) >= 4.5 ? colors.primary : colors.text;
  const muted = contrastRatio(colors.muted, SIGNATURE_SURFACE) >= 4.5 ? colors.muted : colors.text;
  const name = input.personName.trim() || input.organization.trim() || input.brandName.trim();
  const details = [input.personRole.trim(), input.personName.trim() ? input.organization.trim() : ''].filter(Boolean).join(' · ');
  const email = safeEmail(input.email);
  const web = safeWebUrl(input.website);
  const webLabel = input.website.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const row = (content: string, style: string) => `        <tr><td style="${style}">${content}</td></tr>`;
  const a = (href: string, text: string) => `<a href="${escapeHtml(href)}" style="color:${link};text-decoration:none;">${escapeHtml(text)}</a>`;
  const rows = [
    row(escapeHtml(name), `padding:0;font-family:${fonts.heading};font-size:16px;line-height:22px;font-weight:700;color:${colors.text};`),
    details && row(escapeHtml(details), `padding:2px 0 0;font-family:${fonts.body};font-size:13px;line-height:18px;color:${muted};`),
    email && row(a(`mailto:${email}`, email), `padding:8px 0 0;font-family:${fonts.body};font-size:13px;line-height:18px;`),
    web && row(a(web, webLabel), `padding:${email ? 2 : 8}px 0 0;font-family:${fonts.body};font-size:13px;line-height:18px;`),
  ].filter(Boolean);
  const logoCells = input.logo
    ? [
        `    <td style="padding:0 16px 0 0;vertical-align:middle;">`,
        `      <!-- ${input.hostingComment.replace(/--/g, '—')} -->`,
        `      <img src="${escapeHtml(input.logo.src)}" width="${input.logo.width}" height="${input.logo.height}" alt="${escapeHtml(input.brandName)}" style="display:block;border:0;outline:none;width:${input.logo.width}px;height:${input.logo.height}px;">`,
        '    </td>',
        `    <td style="width:3px;padding:0;background-color:${colors.primary};font-size:0;line-height:0;">&nbsp;</td>`,
      ]
    : [];
  return [
    '<!DOCTYPE html>',
    `<html lang="${escapeHtml(input.lang)}">`,
    '<head>',
    '<meta charset="utf-8">',
    `<title>${escapeHtml(name)}</title>`,
    '</head>',
    `<body style="margin:0;padding:16px;background-color:${SIGNATURE_SURFACE};">`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">`,
    '  <tr>',
    ...logoCells,
    `    <td style="padding:0 0 0 ${input.logo ? 16 : 0}px;vertical-align:middle;">`,
    `      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">`,
    ...rows,
    '      </table>',
    '    </td>',
    '  </tr>',
    '</table>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------- labels and README

type FileMessages = (typeof mediakitMessages)['ru']['files'];

const FORMAT_LABEL: Record<string, keyof FileMessages> = Object.fromEntries(
  [...SOCIAL_FORMATS, ...COVER_FORMATS, ...FAVICON_FORMATS, LOGO_ON_BRAND].map((f) => [f.path, f.id]),
);

/** Human description of a kit file in the language of `files`. */
export function fileLabel(path: string, files: FileMessages, variantLabels: Record<LogoVariantKind, string>): string {
  const key = FORMAT_LABEL[path];
  if (key) {
    const value = files[key];
    return typeof value === 'string' ? value : path;
  }
  const logo = /^logos\/([a-z]+)(-\d+)?\.(png|svg|jpg)$/.exec(path);
  const kind = LOGO_KINDS.find((k) => k === logo?.[1]);
  if (logo && kind) return logo[2] === `-${LOGO_RENDER_PX}` ? files.logoRender(variantLabels[kind]) : files.logoOriginal(variantLabels[kind]);
  switch (path) {
    case COLOR_FILES.css:
      return files.colorsCss;
    case COLOR_FILES.tokens:
      return files.tokensJson;
    case COLOR_FILES.ase:
      return files.ase;
    case COLOR_FILES.gpl:
      return files.gpl;
    case SIGNATURE_PATH:
      return files.signature;
    case README_PATH:
      return files.readme;
    default:
      return path;
  }
}

export type ReadmeEntry = { path: string; width?: number; height?: number; label: string };

/** Plain-text README: files grouped by folder with pixel sizes, then notes. */
export function readmeText(heading: string, created: string, entries: readonly ReadmeEntry[], notesHeading: string, notes: readonly string[]): string {
  const folders = new Map<string, ReadmeEntry[]>();
  for (const e of entries) {
    const slash = e.path.lastIndexOf('/');
    const folder = slash >= 0 ? e.path.slice(0, slash + 1) : '';
    folders.set(folder, [...(folders.get(folder) ?? []), e]);
  }
  // Files inside a folder are indented under it; columns line up across all of them.
  const name = (p: string) => (p.includes('/') ? `  ${p.slice(p.lastIndexOf('/') + 1)}` : p);
  const size = (e: ReadmeEntry) => (e.width && e.height ? `${e.width} × ${e.height}` : '');
  const nameWidth = Math.max(0, ...entries.map((e) => name(e.path).length));
  const sizeWidth = Math.max(0, ...entries.map((e) => size(e).length));
  const lines = [heading, created, ''];
  for (const [folder, list] of folders) {
    if (folder) lines.push(folder);
    for (const e of list) lines.push(`${name(e.path).padEnd(nameWidth)}  ${size(e).padEnd(sizeWidth)}  ${e.label}`.trimEnd());
    lines.push('');
  }
  if (notes.length) {
    lines.push(notesHeading);
    for (const note of notes) lines.push(`- ${note}`);
    lines.push('');
  }
  return lines.join('\n');
}
