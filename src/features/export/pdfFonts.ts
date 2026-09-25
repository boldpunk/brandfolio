import { Font } from '@react-pdf/renderer';
import { FONT_FAMILIES, FONT_FAMILY_IDS, fontFileName } from '@/domain/fonts';

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
