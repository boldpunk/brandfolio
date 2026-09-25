import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '@/domain/project';
import { projectSchema, type Asset } from '@/domain/schema';
import { addFontFile, applyFontToRole, guessCategory, removeFont, removeFontFile } from './fontOperations';

const fontAsset = (id: string, filename = 'Brand-Regular.ttf'): Asset => ({
  id,
  projectId: 'p',
  kind: 'font',
  mimeType: 'font/ttf',
  filename,
  byteSize: 10,
  blob: new Blob([]),
});

describe('brand font operations', () => {
  it('groups files by family name and replaces a repeated weight', () => {
    let project = createEmptyProject('X');
    const first = addFontFile(project, fontAsset('a1'), { family: 'Brand Sans', weight: 400 });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    project = first.project;
    const second = addFontFile(project, fontAsset('a2'), { family: 'brand sans', weight: 700 });
    if (!second.ok) throw new Error('expected ok');
    project = second.project;
    expect(project.brand.customFonts).toHaveLength(1);
    expect(project.brand.customFonts[0]!.files.map((f) => f.weight)).toEqual([400, 700]);

    const replaced = addFontFile(project, fontAsset('a3'), { family: 'Brand Sans', weight: 700 });
    if (!replaced.ok) throw new Error('expected ok');
    expect(replaced.replaced).toBe(true);
    expect(replaced.project.assetIds).toEqual(['a1', 'a3']);
    expect(projectSchema.safeParse(replaced.project).success).toBe(true);
  });

  it('names a family from the file when the font has no name and respects limits', () => {
    const project = createEmptyProject('X');
    const result = addFontFile(project, fontAsset('a1', 'Acme_Serif-Bold.otf'), { family: null, weight: 700 });
    if (!result.ok) throw new Error('expected ok');
    expect(result.project.brand.customFonts[0]).toMatchObject({ name: 'Acme_Serif', category: 'serif' });

    let full = createEmptyProject('Y');
    for (let i = 0; i < 4; i++) {
      const r = addFontFile(full, fontAsset(`b${i}`), { family: `Family ${i}`, weight: 400 });
      if (!r.ok) throw new Error('expected ok');
      full = r.project;
    }
    expect(addFontFile(full, fontAsset('b9'), { family: 'Fifth', weight: 400 })).toEqual({ ok: false, reason: 'families' });
  });

  it('keeps typography valid when weights or families are removed', () => {
    const added = addFontFile(createEmptyProject('X'), fontAsset('a1'), { family: 'Brand', weight: 400 });
    if (!added.ok) throw new Error('expected ok');
    const bold = addFontFile(added.project, fontAsset('a2'), { family: 'Brand', weight: 700 });
    if (!bold.ok) throw new Error('expected ok');
    let project = applyFontToRole(bold.project, 'heading', bold.fontId);
    expect(project.brand.typography.heading).toMatchObject({ familyId: bold.fontId, weight: 700 });

    project = removeFontFile(project, bold.fontId, 700);
    expect(project.brand.typography.heading.weight).toBe(400);
    expect(project.assetIds).toEqual(['a1']);
    expect(projectSchema.safeParse(project).success).toBe(true);

    project = removeFont(project, bold.fontId);
    expect(project.brand.typography.heading.familyId).toBe('manrope');
    expect(project.brand.customFonts).toEqual([]);
    expect(project.assetIds).toEqual([]);
    expect(projectSchema.safeParse(project).success).toBe(true);
  });

  it('guesses categories from names', () => {
    expect(guessCategory('JetBrains Mono')).toBe('mono');
    expect(guessCategory('PT Serif')).toBe('serif');
    expect(guessCategory('Noto Sans')).toBe('sans');
  });
});
