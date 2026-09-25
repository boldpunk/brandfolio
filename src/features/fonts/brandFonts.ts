/**
 * Adds a brand's own fonts (brand.customFonts) to the page's font set for the
 * HTML preview and canvas drawing; the PDF side is registerPdfBrandFonts in
 * features/export/pdfFonts.ts. Family names come from customCssFamily(),
 * which changes whenever a file changes, so registrations never go stale and
 * are simply kept for the session.
 */
import { useEffect } from 'react';
import { customCssFamily } from '@/domain/fonts';
import type { CustomFont } from '@/domain/schema';

/** Stable empty list for components without a project yet (keeps effect deps stable). */
export const NO_FONTS: readonly CustomFont[] = [];

const documentFaces = new Set<string>();

/** Adds every face of the given fonts to document.fonts; resolves when they are loaded. */
export async function registerDocumentFonts(fonts: readonly CustomFont[], blobs: ReadonlyMap<string, Blob>): Promise<void> {
  if (typeof FontFace === 'undefined' || typeof document === 'undefined') return;
  const pending: Promise<unknown>[] = [];
  for (const font of fonts) {
    const family = customCssFamily(font);
    for (const file of font.files) {
      const key = `${family}|${file.weight}`;
      const blob = blobs.get(file.assetId);
      if (documentFaces.has(key) || !blob) continue;
      documentFaces.add(key);
      pending.push(
        blob.arrayBuffer().then((bytes) => {
          const face = new FontFace(family, bytes, { weight: String(file.weight), display: 'block' });
          document.fonts.add(face);
          return face.load();
        }).catch(() => documentFaces.delete(key)),
      );
    }
  }
  await Promise.all(pending);
}

/** Registers the brand fonts with the page whenever the fonts or their files change. */
export function useBrandFonts(fonts: readonly CustomFont[], blobs: ReadonlyMap<string, Blob>): void {
  useEffect(() => {
    void registerDocumentFonts(fonts, blobs);
  }, [fonts, blobs]);
}
