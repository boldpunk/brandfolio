/**
 * Color math used by the palette editor, contrast checker and exports.
 * Pure functions only: no React, storage or PDF dependencies.
 */

export type Rgb = { r: number; g: number; b: number };
export type Hsl = { h: number; s: number; l: number };

const SHORT_HEX = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const LONG_HEX = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

/**
 * Accepts #RGB, #RRGGBB (with or without "#", any case, surrounding spaces)
 * and returns the canonical upper-case #RRGGBB, or null when invalid.
 */
export function normalizeHex(input: string): string | null {
  const value = input.trim();
  const short = SHORT_HEX.exec(value);
  if (short) {
    const [, r, g, b] = short;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  const long = LONG_HEX.exec(value);
  if (long) {
    return `#${long[1]}${long[2]}${long[3]}`.toUpperCase();
  }
  return null;
}

export function isCanonicalHex(value: string): boolean {
  return /^#[0-9A-F]{6}$/.test(value);
}

export function hexToRgb(hex: string): Rgb {
  const normalized = normalizeHex(hex);
  if (!normalized) throw new Error(`Invalid HEX color: ${hex}`);
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s: s * 100, l: l * 100 };
}

export function formatRgb(rgb: Rgb): string {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

export function formatHsl(hsl: Hsl): string {
  return `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%)`;
}

function channelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

/** Unrounded WCAG contrast ratio, from 1 to 21. */
export function contrastRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(hexA);
  const lb = relativeLuminance(hexB);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export const AA_NORMAL_TEXT = 4.5;
export const AA_LARGE_TEXT = 3;

export type ContrastResult = {
  /** Exact ratio; pass/fail decisions use this value. */
  ratio: number;
  /** For display only, e.g. "4.48:1". Truncated so it never overstates. */
  label: string;
  normalText: boolean;
  largeText: boolean;
};

export function checkContrast(hexA: string, hexB: string): ContrastResult {
  const ratio = contrastRatio(hexA, hexB);
  return {
    ratio,
    label: `${formatRatio(ratio)}:1`,
    normalText: ratio >= AA_NORMAL_TEXT,
    largeText: ratio >= AA_LARGE_TEXT,
  };
}

/**
 * Two decimals, truncated rather than rounded so 4.4999 shows as 4.49
 * (a fail) instead of 4.50 (which would read as a pass).
 */
export function formatRatio(ratio: number): string {
  const truncated = Math.floor(ratio * 100) / 100;
  return truncated.toFixed(2).replace(/\.?0+$/, '');
}

/** Picks black or white text for a swatch label, whichever contrasts more. */
export function readableTextOn(hex: string): '#191919' | '#FFFFFF' {
  return contrastRatio(hex, '#191919') >= contrastRatio(hex, '#FFFFFF') ? '#191919' : '#FFFFFF';
}
