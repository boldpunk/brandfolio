/**
 * Pure edit operations on a project. Each returns a new project and never
 * mutates its input, so the editor can keep snapshots for undo.
 */
import { createId } from './ids';
import { PALETTE_LIMITS } from './limits';
import { msg } from '@/i18n/core';
import { brandMessages } from '@/i18n/messages/brand';
import { validationMessages } from '@/i18n/messages/validation';
import type { BrandColor, Project, SectionKind } from './schema';

export function moveSection(project: Project, kind: SectionKind, direction: -1 | 1): Project {
  const sections = [...project.sections];
  const index = sections.findIndex((s) => s.kind === kind);
  const target = index + direction;
  // The cover always stays first.
  if (index <= 0 || target <= 0 || target >= sections.length) return project;
  [sections[index], sections[target]] = [sections[target]!, sections[index]!];
  return { ...project, sections };
}

/** Moves a section to a new index (drag and drop). Index 0 is reserved for the cover. */
export function placeSection(project: Project, kind: SectionKind, toIndex: number): Project {
  const from = project.sections.findIndex((s) => s.kind === kind);
  if (from <= 0) return project;
  const clamped = Math.min(Math.max(toIndex, 1), project.sections.length - 1);
  if (clamped === from) return project;
  const sections = [...project.sections];
  const [moved] = sections.splice(from, 1);
  sections.splice(clamped, 0, moved!);
  return { ...project, sections };
}

export function canHideSection(project: Project, kind: SectionKind): boolean {
  return project.sections.some((s) => s.visible && s.kind !== kind);
}

export function setSectionVisible(project: Project, kind: SectionKind, visible: boolean): Project {
  if (!visible && !canHideSection(project, kind)) return project;
  return { ...project, sections: project.sections.map((s) => (s.kind === kind ? { ...s, visible } : s)) };
}

// ---------------------------------------------------------------- colors

export const canAddColor = (project: Project) => project.brand.colors.length < PALETTE_LIMITS.max;
export const canRemoveColor = (project: Project) => project.brand.colors.length > PALETTE_LIMITS.min;

export function addColor(project: Project, color: Omit<BrandColor, 'id'>): Project {
  if (!canAddColor(project)) return project;
  return { ...project, brand: { ...project.brand, colors: [...project.brand.colors, { ...color, id: createId('c') }] } };
}

export function updateColor(project: Project, id: string, patch: Partial<Omit<BrandColor, 'id'>>): Project {
  return {
    ...project,
    brand: { ...project.brand, colors: project.brand.colors.map((c) => (c.id === id ? { ...c, ...patch } : c)) },
  };
}

export function moveColor(project: Project, id: string, direction: -1 | 1): Project {
  const colors = [...project.brand.colors];
  const index = colors.findIndex((c) => c.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= colors.length) return project;
  [colors[index], colors[target]] = [colors[target]!, colors[index]!];
  return { ...project, brand: { ...project.brand, colors } };
}

/** Where a color is referenced, in words (interface language), for the delete dialog. */
export function colorUsages(project: Project, id: string): string[] {
  const { brand } = project;
  const m = msg(validationMessages).colorUse;
  const names = msg(brandMessages).mockups;
  const uses: string[] = [];
  if (brand.cover.backgroundColorId === id) uses.push(m.coverBackground);
  if (brand.logo.previewColorId === id) uses.push(m.logoBackground);
  for (const [key, mockup] of Object.entries(brand.mockups) as [keyof typeof names, Project['brand']['mockups'][keyof typeof names]][]) {
    if (Object.values(mockup.colors).includes(id)) uses.push(m.mockup(names[key].toLowerCase()));
  }
  return uses;
}

/**
 * Removes a color and points every reference to the replacement (or to
 * "automatic" when null) so layouts keep rendering.
 */
export function removeColor(project: Project, id: string, replacementId: string | null): Project {
  if (!canRemoveColor(project)) return project;
  if (replacementId === id) replacementId = null;
  const swap = (ref: string | null) => (ref === id ? replacementId : ref);
  const { brand } = project;
  const mockups = Object.fromEntries(
    Object.entries(brand.mockups).map(([key, mockup]) => [
      key,
      {
        ...mockup,
        colors: {
          backgroundColorId: swap(mockup.colors.backgroundColorId),
          textColorId: swap(mockup.colors.textColorId),
          accentColorId: swap(mockup.colors.accentColorId),
        },
      },
    ]),
  ) as Project['brand']['mockups'];
  return {
    ...project,
    brand: {
      ...brand,
      colors: brand.colors.filter((c) => c.id !== id),
      cover: { ...brand.cover, backgroundColorId: swap(brand.cover.backgroundColorId) },
      logo: { ...brand.logo, previewColorId: swap(brand.logo.previewColorId) },
      mockups,
    },
  };
}

