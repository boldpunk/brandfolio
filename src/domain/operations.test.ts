import { describe, expect, it } from 'vitest';
import { addColor, colorUsages, moveSection, placeSection, removeColor, setSectionVisible } from './operations';
import { createEmptyProject } from './project';
import { projectSchema } from './schema';

describe('sections', () => {
  it('keeps the cover first', () => {
    const p = createEmptyProject('X');
    expect(moveSection(p, 'cover', 1)).toBe(p);
    expect(moveSection(p, 'about', -1)).toBe(p);
    expect(placeSection(p, 'contacts', 0).sections[0]!.kind).toBe('cover');
  });

  it('moves sections up and down', () => {
    const p = moveSection(createEmptyProject('X'), 'logo', -1);
    expect(p.sections.map((s) => s.kind).slice(0, 3)).toEqual(['cover', 'logo', 'about']);
    const q = placeSection(p, 'contacts', 1);
    expect(q.sections[1]!.kind).toBe('contacts');
    expect(projectSchema.safeParse(q).success).toBe(true);
  });

  it('never hides the last visible section', () => {
    let p = createEmptyProject('X');
    for (const s of p.sections) p = setSectionVisible(p, s.kind, false);
    expect(p.sections.filter((s) => s.visible)).toHaveLength(1);
    expect(projectSchema.safeParse(p).success).toBe(true);
  });
});

describe('colors', () => {
  it('replaces references when a used color is removed', () => {
    let p = createEmptyProject('X');
    p = addColor(p, { name: 'Терракота', role: 'accent', hex: '#B65C3A' });
    const accent = p.brand.colors[2]!.id;
    const bg = p.brand.colors[0]!.id;
    p = { ...p, brand: { ...p.brand, cover: { ...p.brand.cover, backgroundColorId: accent } } };
    p.brand.mockups = { ...p.brand.mockups, socialPost: { ...p.brand.mockups.socialPost, colors: { backgroundColorId: accent, textColorId: null, accentColorId: accent } } };
    expect(colorUsages(p, accent)).toEqual(['фон обложки', 'макет «публикация»']);
    const next = removeColor(p, accent, bg);
    expect(next.brand.colors).toHaveLength(2);
    expect(next.brand.cover.backgroundColorId).toBe(bg);
    expect(next.brand.mockups.socialPost.colors).toEqual({ backgroundColorId: bg, textColorId: null, accentColorId: bg });
    expect(projectSchema.safeParse(next).success).toBe(true);
  });

  it('keeps at least two colors', () => {
    const p = createEmptyProject('X');
    expect(removeColor(p, p.brand.colors[0]!.id, null)).toBe(p);
  });

  it('allows at most 12 colors', () => {
    let p = createEmptyProject('X');
    for (let i = 0; i < 20; i++) p = addColor(p, { name: `C${i}`, role: 'custom', hex: '#000000' });
    expect(p.brand.colors).toHaveLength(12);
  });
});
