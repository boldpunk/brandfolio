import { createId } from './ids';
import type { Project } from './schema';

/**
 * Returns a copy of the project with a new project ID, new asset IDs (per the
 * map) and fresh internal list IDs, so the copy shares nothing with its source.
 * Every asset ID referenced by the project must be present in assetIdMap.
 */
export function remapProject(project: Project, newProjectId: string, assetIdMap: ReadonlyMap<string, string>): Project {
  const mapAsset = (id: string): string => {
    const next = assetIdMap.get(id);
    if (!next) throw new Error(`Нет нового ID для ассета ${id}`);
    return next;
  };
  const mapNullableAsset = (id: string | null) => (id === null ? null : mapAsset(id));

  const colorIdMap = new Map(project.brand.colors.map((c) => [c.id, createId('c')]));
  const mapColor = (id: string | null) => (id === null ? null : (colorIdMap.get(id) ?? null));

  const brand = structuredClone(project.brand);
  brand.colors = brand.colors.map((c) => ({ ...c, id: colorIdMap.get(c.id)! }));
  brand.cover.backgroundColorId = mapColor(brand.cover.backgroundColorId);
  brand.logo.previewColorId = mapColor(brand.logo.previewColorId);
  brand.logo.variants = {
    primary: mapNullableAsset(brand.logo.variants.primary),
    alternative: mapNullableAsset(brand.logo.variants.alternative),
    mark: mapNullableAsset(brand.logo.variants.mark),
    light: mapNullableAsset(brand.logo.variants.light),
  };
  brand.imagery.images = brand.imagery.images.map((img) => ({ ...img, id: createId('i'), assetId: mapAsset(img.assetId) }));
  brand.voice.qualities = brand.voice.qualities.map((q) => ({ ...q, id: createId('q') }));
  brand.voice.pairs = brand.voice.pairs.map((p) => ({ ...p, id: createId('v') }));
  for (const mockup of Object.values(brand.mockups)) {
    mockup.colors = {
      backgroundColorId: mapColor(mockup.colors.backgroundColorId),
      textColorId: mapColor(mockup.colors.textColorId),
      accentColorId: mapColor(mockup.colors.accentColorId),
    };
  }

  return {
    ...structuredClone(project),
    id: newProjectId,
    brand,
    assetIds: project.assetIds.map(mapAsset),
  };
}

/** Asset IDs actually used by the brand (logo variants and imagery). */
export function referencedAssetIds(project: Pick<Project, 'brand'>): Set<string> {
  const ids = new Set<string>();
  for (const id of Object.values(project.brand.logo.variants)) if (id) ids.add(id);
  for (const img of project.brand.imagery.images) ids.add(img.assetId);
  return ids;
}
