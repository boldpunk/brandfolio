/**
 * The demonstration project "FORMA", an architecture studio. Fictional brand,
 * marked as demo, available in every document language (texts in demoMessages). Its palette is an authored direction for the demo; not every
 * combination passes WCAG and the document does not claim so.
 */
import { createId } from '@/domain/ids';
import { createEmptyProject } from '@/domain/project';
import type { Asset, Project } from '@/domain/schema';
import { rasterizeSvg } from '@/features/assets/rasterize';
import { ingestFile } from '@/features/assets/ingest';
import type { Locale } from '@/i18n/locales';
import { demoMessages } from '@/i18n/messages/demo';
import { createProject, getProject, listProjects } from '@/storage/projectRepository';
import { FORMA_COMPOSITIONS, FORMA_LOGO_LIGHT_SVG, FORMA_LOGO_SVG, FORMA_MARK_SVG } from './formaAssets';

async function asAsset(data: BlobPart, name: string, kind: Asset['kind'], projectId: string, language: Locale): Promise<Asset> {
  const result = await ingestFile(new File([data], name), { kind, projectId });
  if (!result.ok) throw new Error(demoMessages[language].fileError(name, result.error));
  return result.asset;
}

/** Builds the demo with all texts and document labels in `language`. */
export async function buildFormaDemo(now = new Date(), language: Locale = 'ru'): Promise<{ project: Project; assets: Asset[] }> {
  const d = demoMessages[language];
  const project = createEmptyProject(d.title, 'editorial', now, language);
  project.isDemo = true;
  const id = project.id;

  const logo = await asAsset(FORMA_LOGO_SVG, 'forma-logo.svg', 'logo', id, language);
  const light = await asAsset(FORMA_LOGO_LIGHT_SVG, 'forma-logo-light.svg', 'logo', id, language);
  const markAsset = await asAsset(FORMA_MARK_SVG, 'forma-mark.svg', 'logo', id, language);
  const images: Asset[] = [];
  for (const composition of FORMA_COMPOSITIONS) {
    images.push(await asAsset(await rasterizeSvg(composition.svg, 1600), composition.name, 'image', id, language));
  }

  const ivory = createId('c');
  const graphite = createId('c');
  const terracotta = createId('c');
  const sage = createId('c');
  const b = project.brand;

  b.colors = [
    { id: ivory, name: d.colors.ivory, role: 'background', hex: '#F3EFE7' },
    { id: graphite, name: d.colors.graphite, role: 'text', hex: '#242424' },
    { id: terracotta, name: d.colors.terracotta, role: 'primary', hex: '#B65C3A' },
    { id: sage, name: d.colors.sage, role: 'secondary', hex: '#8C9A82' },
  ];
  b.cover = {
    title: 'FORMA',
    subtitle: d.cover.subtitle,
    version: '1.0',
    date: now.toISOString().slice(0, 10),
    author: d.cover.author,
    logoVariant: 'primary',
    backgroundColorId: null,
  };
  b.about = {
    description: d.about.description,
    mission: d.about.mission,
    values: [...d.about.values],
    audience: d.about.audience,
    positioning: d.about.positioning,
  };
  b.logo = {
    variants: { primary: logo.id, alternative: null, mark: markAsset.id, light: light.id },
    clearSpace: 0.5,
    minSizePx: 96,
    minSizeMm: 25,
    usageRules: d.logo.usageRules,
    doRules: [...d.logo.doRules],
    dontRules: [...d.logo.dontRules],
    misuse: { stretch: true, rotate: true, busyBackground: true },
    previewColorId: terracotta,
  };
  b.typography = {
    heading: { role: 'heading', familyId: 'manrope', weight: 700, sizePx: 40, lineHeight: 1.1, trackingEm: -0.01 },
    body: { role: 'body', familyId: 'noto-serif', weight: 400, sizePx: 15, lineHeight: 1.55, trackingEm: 0 },
    caption: { role: 'caption', familyId: 'manrope', weight: 600, sizePx: 11, lineHeight: 1.4, trackingEm: 0.04 },
  };
  b.imagery = {
    images: images.map((asset, i) => {
      const composition = FORMA_COMPOSITIONS[i]!;
      return { id: createId('i'), assetId: asset.id, caption: d.imagery.captions[composition.key], focalX: composition.focalX, focalY: composition.focalY };
    }),
    lighting: d.imagery.lighting,
    composition: d.imagery.composition,
    processing: d.imagery.processing,
    avoid: d.imagery.avoid,
  };
  b.voice = {
    qualities: d.voice.qualities.map((q) => ({ id: createId('q'), ...q })),
    rules: [...d.voice.rules],
    pairs: d.voice.pairs.map((p) => ({ id: createId('v'), ...p })),
  };
  b.mockups = {
    businessCard: {
      kind: 'business-card',
      enabled: true,
      colors: { backgroundColorId: ivory, textColorId: graphite, accentColorId: graphite },
      personName: d.mockups.personName,
      personRole: d.mockups.personRole,
      phone: d.mockups.phone,
    },
    socialPost: {
      kind: 'social-post',
      enabled: true,
      colors: { backgroundColorId: terracotta, textColorId: ivory, accentColorId: ivory },
      headline: d.mockups.postHeadline,
      caption: d.mockups.postCaption,
    },
    websiteHero: {
      kind: 'website-hero',
      enabled: true,
      colors: { backgroundColorId: ivory, textColorId: graphite, accentColorId: terracotta },
      headline: d.mockups.heroHeadline,
      subheadline: d.mockups.heroSubheadline,
      ctaLabel: d.mockups.heroCta,
    },
    packagingLabel: {
      kind: 'packaging-label',
      enabled: true,
      colors: { backgroundColorId: ivory, textColorId: graphite, accentColorId: sage },
      productName: d.mockups.productName,
      descriptor: d.mockups.productDescriptor,
      netContent: d.mockups.netContent,
    },
  };
  b.contacts = {
    organization: d.contacts.organization,
    email: 'hello@example.com',
    website: 'https://example.com',
    usageNote: d.contacts.usageNote,
  };
  project.assetIds = [logo.id, light.id, markAsset.id, ...images.map((a) => a.id)];
  return { project, assets: [logo, light, markAsset, ...images] };
}

/**
 * Opens the user's demo copy in `language` if one exists (it is never
 * overwritten by a repeat visit), otherwise creates one in that language.
 * Demo copies in other languages are left alone.
 */
export async function openOrCreateDemo(language: Locale = 'ru'): Promise<string> {
  for (const summary of (await listProjects()).filter((p) => p.isDemo)) {
    const existing = await getProject(summary.id).catch(() => null);
    if (existing?.language === language) return existing.id;
  }
  const { project, assets } = await buildFormaDemo(undefined, language);
  await createProject(project, assets);
  return project.id;
}
