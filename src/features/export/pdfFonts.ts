import { Font } from '@react-pdf/renderer';
import { customCssFamily, FONT_FAMILIES, FONT_FAMILY_IDS, fontFileName } from '@/domain/fonts';
import type { CustomFont } from '@/domain/schema';

const ZWSP = '\u200B';
let registered = false;

/**
 * Registers the bundled static TTF files with react-pdf. Must run in the same
 * JS context that renders the PDF (main thread or the worker).
 */
export function registerPdfFonts(origin: string = globalThis.location?.origin ?? ''): void {
  if (registered) return;
  const base = `${origin}${import.meta.env.BASE_URL}fonts/`;
  for (const id of FONT_FAMILY_IDS) {
    const family = FONT_FAMILIES[id];
    Font.register({
      family: family.cssFamily,
      fonts: family.weights.map((weight) => ({ src: base + fontFileName(id, weight), fontWeight: weight })),
    });
  }
  // Keep ordinary words whole: react-pdf's default English hyphenation mangles
  // Russian and Uzbek words. Very long tokens (URLs) get U+200B break points
  // from softBreak(); textkit only breaks at spaces and "syllables", so those
  // points are exposed as syllables. textkit draws a '-' at such a break.
  Font.registerHyphenationCallback((word) => (word.includes(ZWSP) ? word.split(/(?<=\u200B)/) : [word]));
  registered = true;
}

const pdfFamilies = new Set<string>();
const fileUrls = new Map<string, string>();

/**
 * Registers the brand's own fonts (brand.customFonts) with react-pdf. Family
 * names change whenever a file changes (customCssFamily), so a registration
 * is kept for the session. Call before rendering, in the same JS context.
 */
export function registerPdfBrandFonts(fonts: readonly CustomFont[], blobs: ReadonlyMap<string, Blob>): void {
  for (const font of fonts) {
    const family = customCssFamily(font);
    if (pdfFamilies.has(family)) continue;
    const sources = font.files.flatMap((file) => {
      const blob = blobs.get(file.assetId);
      if (!blob) return [];
      let url = fileUrls.get(file.assetId);
      if (!url) {
        url = URL.createObjectURL(blob);
        fileUrls.set(file.assetId, url);
      }
      return [{ src: url, fontWeight: file.weight }];
    });
    if (!sources.length) continue;
    Font.register({ family, fonts: sources });
    pdfFamilies.add(family);
  }
}
