/**
 * Pure edits of brand.customFonts. Each keeps project.assetIds and the
 * typography styles consistent, so the result always passes the schema.
 */
import { nearestWeight } from '@/domain/fonts';
import { createId } from '@/domain/ids';
import { CUSTOM_FONT_LIMITS } from '@/domain/limits';
import { TYPOGRAPHY_ROLES, type Asset, type CustomFont, type Project, type TypographyRole } from '@/domain/schema';
import type { FontInfo } from '@/features/assets/fontInfo';

export type AddFontResult = { ok: true; project: Project; fontId: string; replaced: boolean } | { ok: false; reason: 'families' | 'files' };

const FALLBACK: Record<TypographyRole, string> = { heading: 'manrope', body: 'noto-sans', caption: 'noto-sans' };

export function guessCategory(name: string): CustomFont['category'] {
  if (/mono|code/i.test(name)) return 'mono';
  if (/serif|garamond|times|roman|slab/i.test(name) && !/sans/i.test(name)) return 'serif';
  if (/display|poster|headline/i.test(name)) return 'display';
  return 'sans';
}

const stem = (filename: string) => filename.replace(/\.[^.]*$/, '').replace(/[-_ ]?(thin|extralight|light|regular|book|medium|semibold|bold|extrabold|black|heavy|\d00)$/i, '').trim() || filename;

/**
 * Adds an uploaded font file. With `intoFontId` it goes into that family;
 * otherwise into the family with the same name (case-insensitive) or a new
 * one. A file with a weight the family already has replaces that file.
 */
export function addFontFile(project: Project, asset: Asset, info: Pick<FontInfo, 'family' | 'weight'>, intoFontId?: string): AddFontResult {
  const fonts = project.brand.customFonts;
  const name = (info.family ?? stem(asset.filename)).slice(0, 60);
  const target = intoFontId ? fonts.find((f) => f.id === intoFontId) : fonts.find((f) => f.name.trim().toLowerCase() === name.trim().toLowerCase());
  let assetIds = project.assetIds.includes(asset.id) ? project.assetIds : [...project.assetIds, asset.id];

  if (!target) {
    if (fonts.length >= CUSTOM_FONT_LIMITS.families) return { ok: false, reason: 'families' };
    const font: CustomFont = { id: createId('f'), name, category: guessCategory(name), files: [{ weight: info.weight, assetId: asset.id }] };
    return { ok: true, fontId: font.id, replaced: false, project: { ...project, assetIds, brand: { ...project.brand, customFonts: [...fonts, font] } } };
  }

  const previous = target.files.find((f) => f.weight === info.weight);
  if (!previous && target.files.length >= CUSTOM_FONT_LIMITS.filesPerFamily) return { ok: false, reason: 'files' };
  const files = previous
    ? target.files.map((f) => (f.weight === info.weight ? { ...f, assetId: asset.id } : f))
    : [...target.files, { weight: info.weight, assetId: asset.id }].sort((a, b) => a.weight - b.weight);
  if (previous && previous.assetId !== asset.id) assetIds = assetIds.filter((id) => id !== previous.assetId);
  const customFonts = fonts.map((f) => (f.id === target.id ? { ...f, files } : f));
  return { ok: true, fontId: target.id, replaced: Boolean(previous), project: { ...project, assetIds, brand: { ...project.brand, customFonts } } };
}

/** Removes one weight; the last weight removes the family. Styles move to the nearest remaining weight. */
export function removeFontFile(project: Project, fontId: string, weight: number): Project {
  const font = project.brand.customFonts.find((f) => f.id === fontId);
  if (!font) return project;
  if (font.files.length <= 1) return removeFont(project, fontId);
  const file = font.files.find((f) => f.weight === weight);
  const customFonts = project.brand.customFonts.map((f) => (f.id === fontId ? { ...f, files: f.files.filter((x) => x.weight !== weight) } : f));
  const typography = { ...project.brand.typography };
  for (const role of TYPOGRAPHY_ROLES) {
    const style = typography[role];
    if (style.familyId === fontId && style.weight === weight) typography[role] = { ...style, weight: nearestWeight(fontId, weight, customFonts) };
  }
  return {
    ...project,
    assetIds: file ? project.assetIds.filter((id) => id !== file.assetId) : project.assetIds,
    brand: { ...project.brand, customFonts, typography },
  };
}

/** Removes a family and its files; styles that used it fall back to the bundled defaults. */
export function removeFont(project: Project, fontId: string): Project {
  const font = project.brand.customFonts.find((f) => f.id === fontId);
  if (!font) return project;
  const dropped = new Set(font.files.map((f) => f.assetId));
  const typography = { ...project.brand.typography };
  for (const role of TYPOGRAPHY_ROLES) {
    const style = typography[role];
    if (style.familyId === fontId) typography[role] = { ...style, familyId: FALLBACK[role], weight: nearestWeight(FALLBACK[role], style.weight) };
  }
  return {
    ...project,
    assetIds: project.assetIds.filter((id) => !dropped.has(id)),
    brand: { ...project.brand, customFonts: project.brand.customFonts.filter((f) => f.id !== fontId), typography },
  };
}

export function updateFont(project: Project, fontId: string, patch: Partial<Pick<CustomFont, 'name' | 'category'>>): Project {
  return { ...project, brand: { ...project.brand, customFonts: project.brand.customFonts.map((f) => (f.id === fontId ? { ...f, ...patch } : f)) } };
}

/** Uses a family for a typography role at the weight closest to the current one. */
export function applyFontToRole(project: Project, role: TypographyRole, familyId: string): Project {
  const style = project.brand.typography[role];
  const weight = nearestWeight(familyId, style.weight, project.brand.customFonts);
  return { ...project, brand: { ...project.brand, typography: { ...project.brand.typography, [role]: { ...style, familyId, weight } } } };
}
