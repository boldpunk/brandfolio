/**
 * Font families bundled with the app. Only these weights exist as files in
 * public/fonts (see scripts/build-fonts.py), so the editor can only offer them.
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
  400: 'Regular',
  600: 'SemiBold',
  700: 'Bold',
};

export function fontFileName(family: FontFamilyId, weight: number): string {
  return `${FONT_FAMILIES[family].filePrefix}-${weight}.ttf`;
}

/** Nearest available weight, used when switching family. */
export function nearestWeight(family: FontFamilyId, weight: number): number {
  const weights = FONT_FAMILIES[family].weights;
  return weights.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), weights[0] ?? 400);
}

/** CSS px to PDF pt: 1px = 1/96 in, 1pt = 1/72 in. */
export function pxToPt(px: number): number {
  return (px * 72) / 96;
}
