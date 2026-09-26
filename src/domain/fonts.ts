/**
 * Font families bundled with the app. Only these weights exist as files in
 * public/fonts (see scripts/build-fonts.py), so the editor can only offer them.
 * Brands can add their own families (brand.customFonts, Pro); a typography
 * style's familyId is then the custom font's id.
 */
export const FONT_FAMILY_IDS = ['manrope', 'noto-sans', 'noto-serif'] as const;
export type FontFamilyId = (typeof FONT_FAMILY_IDS)[number];

export type FontFamilyInfo = {
  id: FontFamilyId;
  /** Name used for CSS @font-face and PDF Font.register. */
  cssFamily: string;
  label: string;
  category: 'sans' | 'serif';
  weights: readonly number[];
  /** File name prefix inside public/fonts, e.g. Manrope-400.ttf. */
  filePrefix: string;
  /** Characters this subset cannot render; the editor warns when used. */
  missingGlyphs: readonly string[];
};

export const FONT_FAMILIES: Record<FontFamilyId, FontFamilyInfo> = {
  manrope: {
    id: 'manrope',
    cssFamily: 'BF Manrope',
    label: 'Manrope',
    category: 'sans',
    weights: [400, 600, 700],
    filePrefix: 'Manrope',
    missingGlyphs: ['ʻ'],
  },
  'noto-sans': {
    id: 'noto-sans',
    cssFamily: 'BF Noto Sans',
    label: 'Noto Sans',
    category: 'sans',
    weights: [400, 600, 700],
    filePrefix: 'NotoSans',
    missingGlyphs: [],
  },
  'noto-serif': {
    id: 'noto-serif',
    cssFamily: 'BF Noto Serif',
    label: 'Noto Serif',
    category: 'serif',
    weights: [400, 700],
    filePrefix: 'NotoSerif',
    missingGlyphs: [],
  },
};

export const WEIGHT_LABELS: Record<number, string> = {
  100: 'Thin',
  200: 'ExtraLight',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'SemiBold',
  700: 'Bold',
  800: 'ExtraBold',
  900: 'Black',
};

export const FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

/** A brand's own font family: one uploaded TTF/OTF file per weight. */
export type CustomFontFamily = {
  id: string;
  name: string;
  category: 'sans' | 'serif' | 'display' | 'mono';
  files: { weight: number; assetId: string }[];
};

export function isBundledFamily(id: string): id is FontFamilyId {
  return (FONT_FAMILY_IDS as readonly string[]).includes(id);
}

/**
 * CSS / PDF family name of a custom font. It includes a hash of the file ids,
 * so replacing a file yields a new name and no renderer (the browser's font
 * set, react-pdf's registry) can serve a stale face.
 */
export function customCssFamily(font: Pick<CustomFontFamily, 'id' | 'files'>): string {
  let hash = 0x811c9dc5;
  for (const ch of font.files.map((f) => `${f.weight}:${f.assetId}`).sort().join('|')) {
    hash = Math.imul(hash ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  }
  return `BF Custom ${font.id} ${hash.toString(36)}`;
}

export type ResolvedFamily = { label: string; cssFamily: string; weights: readonly number[]; missingGlyphs: readonly string[]; custom: boolean };

/**
 * Looks a family up among the bundled and the brand's own fonts. An unknown id
 * (a custom font that was removed) resolves to Noto Sans so rendering never
 * fails; schema validation reports the broken reference.
 */
export function resolveFamily(id: string, customFonts: readonly CustomFontFamily[] = []): ResolvedFamily {
  if (isBundledFamily(id)) {
    const f = FONT_FAMILIES[id];
    return { label: f.label, cssFamily: f.cssFamily, weights: f.weights, missingGlyphs: f.missingGlyphs, custom: false };
  }
  const custom = customFonts.find((f) => f.id === id);
  if (custom) {
    const weights = [...new Set(custom.files.map((f) => f.weight))].sort((a, b) => a - b);
    return { label: custom.name, cssFamily: customCssFamily(custom), weights, missingGlyphs: [], custom: true };
  }
  return resolveFamily('noto-sans');
}

export function fontFileName(family: FontFamilyId, weight: number): string {
  return `${FONT_FAMILIES[family].filePrefix}-${weight}.ttf`;
}

/** Nearest available weight, used when switching family. */
export function nearestWeight(family: string, weight: number, customFonts: readonly CustomFontFamily[] = []): number {
  const weights = resolveFamily(family, customFonts).weights;
  return weights.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), weights[0] ?? 400);
}

/** CSS px to PDF pt: 1px = 1/96 in, 1pt = 1/72 in. */
export function pxToPt(px: number): number {
  return (px * 72) / 96;
}
