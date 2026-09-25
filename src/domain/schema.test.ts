import { describe, expect, it } from 'vitest';
import { migrateProject, parseProject, SchemaVersionError } from './migrations';
import { createEmptyProject } from './project';
import { CURRENT_SCHEMA_VERSION, projectSchema } from './schema';

const clone = <T,>(v: T): T => structuredClone(v);

describe('project schema', () => {
  it('accepts a fresh empty project', () => {
    const project = createEmptyProject('Новый бренд');
    expect(projectSchema.safeParse(project).success).toBe(true);
  });

  it('rejects a reference to a missing asset', () => {
    const project = createEmptyProject('X');
    project.brand.logo.variants.primary = 'a_missing';
    const result = projectSchema.safeParse(project);
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.join('.') === 'brand.logo.variants.primary')).toBe(true);
  });

  it('rejects a reference to a deleted color', () => {
    const project = createEmptyProject('X');
    project.brand.mockups.socialPost.colors.backgroundColorId = 'c_gone';
    expect(projectSchema.safeParse(project).success).toBe(false);
  });

  it('requires cover first and at least one visible section', () => {
    const project = createEmptyProject('X');
    const moved = clone(project);
    moved.sections.reverse();
    expect(projectSchema.safeParse(moved).success).toBe(false);
    const hidden = clone(project);
    hidden.sections.forEach((s) => (s.visible = false));
    expect(projectSchema.safeParse(hidden).success).toBe(false);
  });

  it('enforces text limits without trimming', () => {
    const project = createEmptyProject('X');
    project.brand.cover.title = 'я'.repeat(81);
    expect(projectSchema.safeParse(project).success).toBe(false);
    project.brand.cover.title = 'я'.repeat(80);
    expect(projectSchema.safeParse(project).success).toBe(true);
  });

  it('allows only http(s) URLs', () => {
    const project = createEmptyProject('X');
    for (const bad of ['javascript:alert(1)', 'ftp://example.com', 'example.com', 'data:text/html,x']) {
      project.brand.contacts.website = bad;
      expect(projectSchema.safeParse(project).success, bad).toBe(false);
    }
    project.brand.contacts.website = 'https://example.com/путь';
    expect(projectSchema.safeParse(project).success).toBe(true);
  });

  it('rejects unavailable font weights', () => {
    const project = createEmptyProject('X');
    project.brand.typography.heading = { ...project.brand.typography.heading, familyId: 'noto-serif', weight: 600 };
    expect(projectSchema.safeParse(project).success).toBe(false);
  });

  it('accepts brand fonts and checks their files, ids and weights', () => {
    const project = createEmptyProject('X');
    project.assetIds = ['a_regular', 'a_bold'];
    project.brand.customFonts = [{ id: 'f_brand', name: 'Brand Sans', category: 'sans', files: [{ weight: 400, assetId: 'a_regular' }, { weight: 700, assetId: 'a_bold' }] }];
    project.brand.typography.heading = { ...project.brand.typography.heading, familyId: 'f_brand', weight: 700 };
    expect(projectSchema.safeParse(project).success).toBe(true);

    const badWeight = structuredClone(project);
    badWeight.brand.typography.heading.weight = 600;
    expect(projectSchema.safeParse(badWeight).success).toBe(false);

    const unknownFamily = structuredClone(project);
    unknownFamily.brand.typography.heading.familyId = 'f_removed';
    expect(projectSchema.safeParse(unknownFamily).success).toBe(false);

    const missingFile = structuredClone(project);
    missingFile.assetIds = ['a_regular'];
    expect(projectSchema.safeParse(missingFile).success).toBe(false);

    const shadowsBundled = structuredClone(project);
    shadowsBundled.brand.customFonts[0]!.id = 'manrope';
    shadowsBundled.brand.typography.heading.familyId = 'manrope';
    expect(projectSchema.safeParse(shadowsBundled).success).toBe(false);

    const sameWeight = structuredClone(project);
    sameWeight.brand.customFonts[0]!.files[1]!.weight = 400;
    expect(projectSchema.safeParse(sameWeight).success).toBe(false);
  });

  it('rejects non-canonical HEX in stored documents', () => {
    const project = createEmptyProject('X');
    project.brand.colors[0]!.hex = '#fff';
    expect(projectSchema.safeParse(project).success).toBe(false);
  });
});

describe('migrations', () => {
  it('rejects a future schema version with an explanation', () => {
    const project = { ...createEmptyProject('X'), schemaVersion: 99 };
    expect(() => parseProject(project)).toThrow(SchemaVersionError);
    expect(() => parseProject(project)).toThrow(/более новой версией/);
  });

  it('rejects missing schemaVersion', () => {
    expect(() => migrateProject({ title: 'x' })).toThrow(SchemaVersionError);
  });

  it('runs migrations in order up to the target version', () => {
    const steps = {
      1: (d: Record<string, unknown> & { schemaVersion: number }) => ({ ...d, schemaVersion: 2, a: 1 }),
      2: (d: Record<string, unknown> & { schemaVersion: number }) => ({ ...d, schemaVersion: 3, b: (d.a as number) + 1 }),
    };
    expect(migrateProject({ schemaVersion: 1 }, steps, 3)).toEqual({ schemaVersion: 3, a: 1, b: 2 });
    expect(() => migrateProject({ schemaVersion: 1 }, {}, 2)).toThrow(/Нет миграции/);
  });

  it('upgrades a v1 document with Russian document labels and no brand fonts', () => {
    const current = createEmptyProject('Старый проект');
    const { customFonts: _fonts, ...brand } = current.brand;
    const { language: _language, ...v1 } = { ...current, brand, schemaVersion: 1 };
    const parsed = parseProject(clone(v1));
    expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(parsed.language).toBe('ru');
    expect(parsed.brand.customFonts).toEqual([]);
  });

  it('upgrades a v2 document: brand fonts start empty', () => {
    const current = createEmptyProject('Проект v2', 'editorial', new Date(), 'uz');
    const { customFonts: _fonts, ...brand } = current.brand;
    const parsed = parseProject(clone({ ...current, brand, schemaVersion: 2 }));
    expect(parsed).toEqual(current);
  });

  it('parses a current document unchanged', () => {
    const project = createEmptyProject('Проект');
    expect(parseProject(clone(project))).toEqual(project);
  });
});
