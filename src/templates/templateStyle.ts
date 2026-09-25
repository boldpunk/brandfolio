/**
 * Per-template layout parameters shared by the HTML preview and the PDF
 * adapter. Templates differ in composition (cover, section openers, grids,
 * color presentation), not only in colors.
 */
import type { TemplateId } from '@/domain/schema';
import { readableOn, type Tokens } from '@/features/brandbook/viewModel';

export type TemplateStyle = {
  id: TemplateId;
  /** Page margins in CSS px at 96 dpi (A4 = 794 × 1123). */
  margin: { top: number; right: number; bottom: number; left: number };
  /** Section opener composition. */
  opener: 'editorial' | 'rail' | 'field';
  cover: 'editorial' | 'grid' | 'bleed' | 'split' | 'center';
  colors: 'tall' | 'cards' | 'bands' | 'circles';
  /** Page color: the brand background, the brand text color (inverted), or background tinted with primary. */
  surface: 'light' | 'dark' | 'tint';
  /** Section and cover headings set in capitals. */
  caps: boolean;
  /** Row labels set in capitals. */
  labelCaps: boolean;
  /** Width of the label column for label/content rows, as a fraction of content width. */
  labelColumn: number;
  headingScale: number;
  running: boolean;
};

export const TEMPLATE_STYLES: Record<TemplateId, TemplateStyle> = {
  editorial: {
    id: 'editorial',
    margin: { top: 72, right: 64, bottom: 72, left: 96 },
    opener: 'editorial',
    cover: 'editorial',
    colors: 'tall',
    labelColumn: 0.3,
    headingScale: 1.5,
    running: false,
    surface: 'light',
    caps: false,
    labelCaps: false,
  },
  studio: {
    id: 'studio',
    margin: { top: 88, right: 56, bottom: 72, left: 56 },
    opener: 'rail',
    cover: 'grid',
    colors: 'cards',
    labelColumn: 0.25,
    headingScale: 1,
    running: true,
    surface: 'light',
    caps: false,
    labelCaps: true,
  },
  contrast: {
    id: 'contrast',
    margin: { top: 64, right: 56, bottom: 72, left: 56 },
    opener: 'field',
    cover: 'bleed',
    colors: 'bands',
    labelColumn: 0.28,
    headingScale: 1.25,
    running: false,
    surface: 'light',
    caps: false,
    labelCaps: false,
  },
  noir: {
    id: 'noir',
    margin: { top: 72, right: 64, bottom: 72, left: 64 },
    opener: 'editorial',
    cover: 'editorial',
    colors: 'bands',
    labelColumn: 0.3,
    headingScale: 1.4,
    running: false,
    surface: 'dark',
    caps: true,
    labelCaps: true,
  },
  swiss: {
    id: 'swiss',
    margin: { top: 88, right: 48, bottom: 72, left: 48 },
    opener: 'rail',
    cover: 'split',
    colors: 'tall',
    labelColumn: 0.33,
    headingScale: 1.35,
    running: true,
    surface: 'light',
    caps: true,
    labelCaps: true,
  },
  soft: {
    id: 'soft',
    margin: { top: 80, right: 72, bottom: 80, left: 72 },
    opener: 'editorial',
    cover: 'center',
    colors: 'circles',
    labelColumn: 0.28,
    headingScale: 1.3,
    running: false,
    surface: 'tint',
    caps: false,
    labelCaps: false,
  },
};

export const PAGE = { width: 794, height: 1123 } as const;

/** Width available for content between the page margins, in px. */
export function contentWidth(t: TemplateStyle): number {
  return PAGE.width - t.margin.left - t.margin.right;
}

/** Width of the content column in label/content rows, in px (24 px gap). */
export function rowContentWidth(t: TemplateStyle): number {
  return contentWidth(t) * (1 - t.labelColumn) - 24;
}

/**
 * Size of a logo placed in a box, keeping its proportions and leaving room for
 * a clear-space frame of `clearSpace` × logo height on every side.
 */
export function fitLogo(ratio: number, boxWidth: number, boxHeight: number, clearSpace = 0, maxHeight = 64): { width: number; height: number } {
  const height = Math.max(4, Math.min(maxHeight, boxWidth / (ratio + 2 * clearSpace), boxHeight / (1 + 2 * clearSpace)));
  return { width: height * ratio, height };
}

/**
 * Scale for the cover title so that long titles stay on the cover: at most
 * three lines and the longest word on one line. Glyph width is estimated at
 * 0.62 em, which is on the safe side for the bundled sans and serif faces.
 */
export function coverTitleScale(text: string, baseScale: number, sizePx: number, widthPx: number): number {
  const em = 0.62;
  const longestWord = Math.max(1, ...text.split(/\s+/).map((w) => w.length));
  const byWord = widthPx / (longestWord * em * sizePx);
  const byLines = Math.sqrt((3 * widthPx) / (Math.max(1, text.length) * em * sizePx));
  return Math.max(0.6, Math.min(baseScale, byWord, byLines));
}

/**
 * Cover colors: the user's chosen cover color wins; otherwise the template
 * decides (a primary-color bleed or the page surface), with readable text.
 */
export function coverColors(t: TemplateStyle, tokens: Tokens, cover: { backgroundChosen: boolean; background: string; foreground: string }): { background: string; foreground: string } {
  if (cover.backgroundChosen) return { background: cover.background, foreground: cover.foreground };
  const background = t.cover === 'bleed' ? tokens.primary : tokens.background;
  return { background, foreground: readableOn(background, tokens) };
}
