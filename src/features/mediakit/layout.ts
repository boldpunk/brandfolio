/**
 * Layout math for the media kit, kept free of the DOM so it runs in Node
 * tests. Canvas drawing (render.ts) asks these functions where things go.
 */
import { contrastRatio, hexToRgb } from '@/domain/color';

export type Size = { width: number; height: number };
export type Rect = { x: number; y: number; width: number; height: number };

/** Largest size with the item's aspect ratio that fits in the box. */
export function fitContain(item: Size, box: Size): Size {
  const ratio = item.width / item.height || 1;
  const width = Math.min(box.width, box.height * ratio);
  return { width, height: width / ratio };
}

export type Align = 'left' | 'center' | 'right';

/** Item contained in a rect, aligned horizontally and centred vertically. */
export function alignRect(item: Size, rect: Rect, align: Align): Rect {
  const s = fitContain(item, rect);
  const x = align === 'left' ? rect.x : align === 'right' ? rect.x + rect.width - s.width : rect.x + (rect.width - s.width) / 2;
  return { x, y: rect.y + (rect.height - s.height) / 2, ...s };
}

/** Point on a circle at `degrees` (0 = right, 90 = down, canvas orientation). */
export function onCircle(cx: number, cy: number, r: number, degrees: number): { x: number; y: number } {
  const a = (degrees * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/**
 * Largest size with the item's aspect ratio whose corners stay inside a circle
 * of `radius`, so a circular crop (avatars) never cuts the logo.
 */
export function fitInCircle(item: Size, radius: number): Size {
  const ratio = item.width / item.height || 1;
  // Half-diagonal = radius: (w/2)² + (w/2r)² = R², with r = ratio.
  const width = (2 * radius) / Math.sqrt(1 + 1 / (ratio * ratio));
  return { width, height: width / ratio };
}

/** Long side scaled to `longSide`, rounded to whole pixels. */
export function scaleToLongSide(item: Size, longSide: number): Size {
  const ratio = item.width / item.height || 1;
  return ratio >= 1
    ? { width: longSide, height: Math.max(1, Math.round(longSide / ratio)) }
    : { width: Math.max(1, Math.round(longSide * ratio)), height: longSide };
}

// ---------------------------------------------------------------- text

/** Width of `text` set at `size` px in the face the caller has in mind. */
export type Measure = (text: string, size: number) => number;

function breakWord(word: string, maxWidth: number, size: number, measure: Measure): string[] {
  const parts: string[] = [];
  let current = '';
  for (const ch of word) {
    if (current && measure(current + ch, size) > maxWidth) {
      parts.push(current);
      current = ch;
    } else current += ch;
  }
  if (current) parts.push(current);
  return parts;
}

/** Greedy word wrap; explicit line breaks are kept, over-long words are split. */
export function wrapText(text: string, maxWidth: number, size: number, measure: Measure): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      if (measure(word, size) <= maxWidth) line = word;
      else {
        const parts = breakWord(word, maxWidth, size, measure);
        lines.push(...parts.slice(0, -1));
        line = parts.at(-1) ?? '';
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export type FitOptions = { maxWidth: number; maxLines: number; maxSize: number; minSize: number };
export type FittedText = { size: number; lines: string[] };

/**
 * Largest font size (in whole px, from maxSize down to minSize) at which the
 * text wraps into at most `maxLines`. At the minimum size the text is cut to
 * `maxLines` with an ellipsis rather than overflowing the layout.
 */
export function fitText(text: string, options: FitOptions, measure: Measure): FittedText {
  const { maxWidth, maxLines, minSize } = options;
  const maxSize = Math.max(minSize, options.maxSize);
  const step = Math.max(1, Math.round((maxSize - minSize) / 40));
  for (let size = Math.round(maxSize); size >= minSize; size -= step) {
    const lines = wrapText(text, maxWidth, size, measure);
    if (lines.length <= maxLines) return { size, lines };
  }
  const lines = wrapText(text, maxWidth, minSize, measure);
  if (lines.length <= maxLines) return { size: minSize, lines };
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1] ?? '';
  while (last && measure(`${last}…`, minSize) > maxWidth) last = last.slice(0, -1).trimEnd();
  kept[maxLines - 1] = `${last}…`;
  return { size: minSize, lines: kept };
}

/** One or two initials for a monogram: "Forma Studio" → "FS", "forma" → "F". */
export function monogram(name: string): string {
  const words = name.trim().split(/[\s\-_.·—]+/u).filter((w) => /[\p{L}\p{N}]/u.test(w));
  const initial = (w: string) => [...w].find((ch) => /[\p{L}\p{N}]/u.test(ch)) ?? '';
  const letters = words.length > 1 ? initial(words[0]!) + initial(words[1]!) : initial(words[0] ?? '');
  return letters.toLocaleUpperCase() || '·';
}

/** "https://www.example.com/" → "example.com": how a URL reads on an image. */
export function displayUrl(url: string): string {
  return url
    .trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '');
}

// ---------------------------------------------------------------- color

/**
 * Mean color of the opaque pixels of an RGBA buffer (canvas ImageData), or
 * null for a fully transparent image. Used as a logo's overall tone.
 */
export function averageColor(data: ArrayLike<number>): string | null {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3]! < 128) continue;
    r += data[i]!;
    g += data[i + 1]!;
    b += data[i + 2]!;
    n++;
  }
  if (!n) return null;
  const hex = (v: number) => Math.round(v / n).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase();
}

/** Linear mix in sRGB, `amount` 0 → a, 1 → b. */
export function mixHex(a: string, b: string, amount: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  const c = (p: number, q: number) => Math.round(p + (q - p) * amount).toString(16).padStart(2, '0');
  return `#${c(x.r, y.r)}${c(x.g, y.g)}${c(x.b, y.b)}`.toUpperCase();
}

/** A logo (or any mark) is readable on a surface from this contrast of its tone. */
export const LOGO_MIN_CONTRAST = 1.6;

export type ToneCandidate<T> = { item: T; tone: string | null };

/**
 * First candidate (in brand preference order) whose tone reads on `surface`;
 * if none reaches the threshold, the most contrasting one when it is at least
 * distinguishable, else null so the caller can change the surface.
 */
export function pickReadable<T>(candidates: readonly ToneCandidate<T>[], surface: string, min = LOGO_MIN_CONTRAST): T | null {
  const ratio = (c: ToneCandidate<T>) => (c.tone ? contrastRatio(c.tone, surface) : min);
  const good = candidates.find((c) => ratio(c) >= min);
  if (good) return good.item;
  const best = [...candidates].sort((a, b) => ratio(b) - ratio(a))[0];
  return best && ratio(best) >= 1.25 ? best.item : null;
}

/**
 * Colors for decorative shapes on `surface`: the brand's own colors that stand
 * apart from it (secondary first), topped up with tints so there are always two.
 */
export function shapeColors(surface: string, palette: { secondary: string; accent: string; primary: string; background: string; text: string }): [string, string] {
  const distinct = (hex: string) => contrastRatio(hex, surface) >= 1.2;
  const picks: string[] = [];
  for (const hex of [palette.secondary, palette.accent, palette.primary]) {
    if (distinct(hex) && !picks.includes(hex)) picks.push(hex);
  }
  const contrast = contrastRatio(palette.text, surface) >= contrastRatio(palette.background, surface) ? palette.text : palette.background;
  picks.push(mixHex(surface, contrast, 0.14), mixHex(surface, contrast, 0.3));
  return [picks[0]!, picks[1]!];
}
