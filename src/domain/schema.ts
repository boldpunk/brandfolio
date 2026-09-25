/**
 * Runtime schemas and TypeScript types for the serialisable project document.
 *
 * The document never contains Blob or Object URL values: assets are referenced
 * by ID and stored separately (IndexedDB table or assets/ folder in a ZIP).
 */
import { z } from 'zod';
import { isCanonicalHex } from './color';
import { FONT_WEIGHTS, resolveFamily, isBundledFamily } from './fonts';
import {
  CUSTOM_FONT_LIMITS,
  IMAGERY_MAX_IMAGES,
  LIST_LIMITS,
  PALETTE_LIMITS,
  TEXT_LIMITS,
  VOICE_QUALITIES,
} from './limits';
import { msg } from '@/i18n/core';
import { LOCALES } from '@/i18n/locales';
import { validationMessages } from '@/i18n/messages/validation';

/** Messages are read when a check fails, so they follow the current interface language. */
const v = () => msg(validationMessages);

export const CURRENT_SCHEMA_VERSION = 3;

export const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, { error: () => v().invalidId });

const text = (max: number) => z.string().max(max, { error: () => v().maxChars(max) });
const list = (maxItems: number, maxLength: number = TEXT_LIMITS.listItem) =>
  z.array(text(maxLength)).max(maxItems, { error: () => v().maxItems(maxItems) });

export const hexSchema = z.string().refine(isCanonicalHex, { error: () => v().hex });

/** Reference to a BrandColor.id. null means "not chosen": renderers fall back by role. */
export const colorRefSchema = idSchema.nullable();

// ---------------------------------------------------------------- colors

export const COLOR_ROLES = ['primary', 'secondary', 'accent', 'background', 'text', 'custom'] as const;
export type ColorRole = (typeof COLOR_ROLES)[number];

export const brandColorSchema = z.object({
  id: idSchema,
  name: text(60),
  role: z.enum(COLOR_ROLES),
  hex: hexSchema,
});
export type BrandColor = z.infer<typeof brandColorSchema>;

// ---------------------------------------------------------------- typography

export const TYPOGRAPHY_ROLES = ['heading', 'body', 'caption'] as const;
export type TypographyRole = (typeof TYPOGRAPHY_ROLES)[number];

/** A brand's own font family (Pro): one uploaded TTF/OTF asset per weight. */
export const CUSTOM_FONT_CATEGORIES = ['sans', 'serif', 'display', 'mono'] as const;
export const customFontSchema = z.object({
  id: idSchema,
  name: text(60).min(1, { error: () => v().fontNameRequired }),
  category: z.enum(CUSTOM_FONT_CATEGORIES),
  files: z
    .array(z.object({ weight: z.number().int().refine((w) => (FONT_WEIGHTS as readonly number[]).includes(w), { error: () => v().fontWeight }), assetId: idSchema }))
    .min(1)
    .max(CUSTOM_FONT_LIMITS.filesPerFamily, { error: () => v().maxItems(CUSTOM_FONT_LIMITS.filesPerFamily) })
    .refine((files) => new Set(files.map((f) => f.weight)).size === files.length, { error: () => v().fontWeightRepeat }),
});
export type CustomFont = z.infer<typeof customFontSchema>;

/** familyId is a bundled family (fonts.ts) or the id of a brand.customFonts entry; checked in findBrokenReferences. */
export const typographyStyleSchema = z.object({
  role: z.enum(TYPOGRAPHY_ROLES),
  familyId: idSchema,
  weight: z.number().int(),
  /** CSS px in the editor; converted to pt (×72/96) for PDF. */
  sizePx: z.number().min(8).max(96),
  /** Unitless multiplier of font size. */
  lineHeight: z.number().min(0.9).max(2.4),
  /** Letter spacing in em. */
  trackingEm: z.number().min(-0.1).max(0.4),
});
export type TypographyStyle = z.infer<typeof typographyStyleSchema>;

// ---------------------------------------------------------------- logo

export const LOGO_VARIANTS = ['primary', 'alternative', 'mark', 'light'] as const;
export type LogoVariantKind = (typeof LOGO_VARIANTS)[number];

export const logoSchema = z.object({
  variants: z.object({
    primary: idSchema.nullable(),
    alternative: idSchema.nullable(),
    mark: idSchema.nullable(),
    light: idSchema.nullable(),
  }),
  /** Clear space as a fraction of the logo height, e.g. 0.25. */
  clearSpace: z.number().min(0).max(2),
  minSizePx: z.number().int().min(0).max(2000).nullable(),
  minSizeMm: z.number().min(0).max(500).nullable(),
  usageRules: text(TEXT_LIMITS.longText),
  doRules: list(LIST_LIMITS.logoDoDont),
  dontRules: list(LIST_LIMITS.logoDoDont),
  /** Which built-in misuse illustrations to show (always labelled as wrong). */
  misuse: z.object({
    stretch: z.boolean(),
    rotate: z.boolean(),
    busyBackground: z.boolean(),
  }),
  /** Background used in the "on brand color" logo preview. */
  previewColorId: colorRefSchema,
});
export type LogoSettings = z.infer<typeof logoSchema>;

// ---------------------------------------------------------------- imagery

export const imageryItemSchema = z.object({
  id: idSchema,
  assetId: idSchema,
  caption: text(TEXT_LIMITS.caption),
  /** Focal point in percent, applied as object-position; the file is never changed. */
  focalX: z.number().min(0).max(100),
  focalY: z.number().min(0).max(100),
});
export type ImageryItem = z.infer<typeof imageryItemSchema>;

export const imagerySchema = z.object({
  images: z.array(imageryItemSchema).max(IMAGERY_MAX_IMAGES),
  lighting: text(TEXT_LIMITS.longText),
  composition: text(TEXT_LIMITS.longText),
  processing: text(TEXT_LIMITS.longText),
  avoid: text(TEXT_LIMITS.longText),
});
export type ImagerySettings = z.infer<typeof imagerySchema>;

// ---------------------------------------------------------------- voice

export const voiceSchema = z.object({
  qualities: z
    .array(z.object({ id: idSchema, title: text(60), description: text(TEXT_LIMITS.listItem) }))
    .length(VOICE_QUALITIES),
  rules: list(LIST_LIMITS.rules),
  pairs: z
    .array(z.object({ id: idSchema, say: text(TEXT_LIMITS.listItem), avoid: text(TEXT_LIMITS.listItem) }))
    .max(LIST_LIMITS.voicePairs),
});
export type VoiceSettings = z.infer<typeof voiceSchema>;

// ---------------------------------------------------------------- mockups

const mockupColors = z.object({
  backgroundColorId: colorRefSchema,
  textColorId: colorRefSchema,
  accentColorId: colorRefSchema,
});
export type MockupColors = z.infer<typeof mockupColors>;

const mockupText = text(TEXT_LIMITS.mockupText);

export const MOCKUP_KINDS = ['business-card', 'social-post', 'website-hero', 'packaging-label'] as const;
export type MockupKind = (typeof MOCKUP_KINDS)[number];

export const businessCardSchema = z.object({
  kind: z.literal('business-card'),
  enabled: z.boolean(),
  colors: mockupColors,
  personName: mockupText,
  personRole: mockupText,
  phone: text(40),
});
export const socialPostSchema = z.object({
  kind: z.literal('social-post'),
  enabled: z.boolean(),
  colors: mockupColors,
  headline: mockupText,
  caption: mockupText,
});
export const websiteHeroSchema = z.object({
  kind: z.literal('website-hero'),
  enabled: z.boolean(),
  colors: mockupColors,
  headline: mockupText,
  subheadline: mockupText,
  ctaLabel: text(40),
});
export const packagingLabelSchema = z.object({
  kind: z.literal('packaging-label'),
  enabled: z.boolean(),
  colors: mockupColors,
  productName: mockupText,
  descriptor: mockupText,
  netContent: text(40),
});

export const mockupConfigSchema = z.discriminatedUnion('kind', [
  businessCardSchema,
  socialPostSchema,
  websiteHeroSchema,
  packagingLabelSchema,
]);
export type MockupConfig = z.infer<typeof mockupConfigSchema>;
export type MockupOf<K extends MockupKind> = Extract<MockupConfig, { kind: K }>;

// ---------------------------------------------------------------- brand identity

export const coverSchema = z.object({
  title: text(TEXT_LIMITS.title),
  subtitle: text(TEXT_LIMITS.subtitle),
  version: text(40),
  /** ISO date (YYYY-MM-DD) or empty. */
  date: z.union([z.literal(''), z.iso.date()]),
  author: text(TEXT_LIMITS.short),
  logoVariant: z.enum(LOGO_VARIANTS),
  backgroundColorId: colorRefSchema,
});

export const aboutSchema = z.object({
  description: text(TEXT_LIMITS.longText),
  mission: text(TEXT_LIMITS.longText),
  values: list(LIST_LIMITS.values),
  audience: text(TEXT_LIMITS.longText),
  positioning: text(TEXT_LIMITS.longText),
});

const safeUrl = z
  .string()
  .max(300)
  .refine((v) => v === '' || isHttpUrl(v), { error: () => v().httpOnly });

export const contactsSchema = z.object({
  organization: text(TEXT_LIMITS.short),
  email: z.union([z.literal(''), z.email({ error: () => v().email }).max(254)]),
  website: safeUrl,
  usageNote: text(TEXT_LIMITS.longText),
});

export const brandIdentitySchema = z.object({
  cover: coverSchema,
  about: aboutSchema,
  logo: logoSchema,
  colors: z
    .array(brandColorSchema)
    .min(PALETTE_LIMITS.min, { error: () => v().minColors(PALETTE_LIMITS.min) })
    .max(PALETTE_LIMITS.max, { error: () => v().maxColors(PALETTE_LIMITS.max) }),
  typography: z.object({
    heading: typographyStyleSchema,
    body: typographyStyleSchema,
    caption: typographyStyleSchema,
  }),
  customFonts: z
    .array(customFontSchema)
    .max(CUSTOM_FONT_LIMITS.families, { error: () => v().maxItems(CUSTOM_FONT_LIMITS.families) }),
  imagery: imagerySchema,
  voice: voiceSchema,
  mockups: z.object({
    businessCard: businessCardSchema,
    socialPost: socialPostSchema,
    websiteHero: websiteHeroSchema,
    packagingLabel: packagingLabelSchema,
  }),
  contacts: contactsSchema,
});
export type BrandIdentity = z.infer<typeof brandIdentitySchema>;
export type CoverSettings = z.infer<typeof coverSchema>;
export type AboutSettings = z.infer<typeof aboutSchema>;
export type ContactSettings = z.infer<typeof contactsSchema>;

// ---------------------------------------------------------------- sections

export const SECTION_KINDS = [
  'cover',
  'about',
  'logo',
  'colors',
  'typography',
  'imagery',
  'voice',
  'applications',
  'contacts',
] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

export const sectionConfigSchema = z.object({
  kind: z.enum(SECTION_KINDS),
  visible: z.boolean(),
});
export type SectionConfig = z.infer<typeof sectionConfigSchema>;

export const sectionsSchema = z
  .array(sectionConfigSchema)
  .length(SECTION_KINDS.length)
  .refine((s) => new Set(s.map((x) => x.kind)).size === SECTION_KINDS.length, { error: () => v().sectionsRepeat })
  .refine((s) => s[0]?.kind === 'cover', { error: () => v().coverFirst })
  .refine((s) => s.some((x) => x.visible), { error: () => v().oneSectionVisible });

// ---------------------------------------------------------------- project

/** The first three are free; the rest are Pro templates (templateInfo.ts). */
export const TEMPLATE_IDS = ['editorial', 'studio', 'contrast', 'noir', 'swiss', 'soft'] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export const projectSchema = z
  .object({
    id: idSchema,
    schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
    revision: z.number().int().min(0),
    title: text(TEXT_LIMITS.title).min(1, { error: () => v().titleRequired }),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    templateId: z.enum(TEMPLATE_IDS),
    /** Language of the document's own labels (section titles, captions); the interface language is separate. */
    language: z.enum(LOCALES),
    isDemo: z.boolean(),
    brand: brandIdentitySchema,
    sections: sectionsSchema,
    assetIds: z.array(idSchema),
  })
  .superRefine((project, ctx) => {
    for (const issue of findBrokenReferences(project)) {
      ctx.addIssue({ code: 'custom', message: issue.message, path: issue.path });
    }
  });
export type Project = z.infer<typeof projectSchema>;

// ---------------------------------------------------------------- assets

export const ASSET_KINDS = ['logo', 'image', 'font'] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];
export const ASSET_MIME_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'font/ttf', 'font/otf'] as const;
export type AssetMimeType = (typeof ASSET_MIME_TYPES)[number];

/** Asset metadata; the binary lives beside it (IndexedDB Blob or ZIP entry). */
export const assetMetaSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  kind: z.enum(ASSET_KINDS),
  mimeType: z.enum(ASSET_MIME_TYPES),
  filename: z.string().min(1).max(255),
  byteSize: z.number().int().positive(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
export type AssetMeta = z.infer<typeof assetMetaSchema>;
export type Asset = AssetMeta & { blob: Blob };

// ---------------------------------------------------------------- export manifest

export const exportManifestSchema = z.object({
  format: z.literal('brandfolio-project'),
  schemaVersion: z.number().int().positive(),
  exportedAt: z.iso.datetime(),
  appVersion: z.string().max(40),
  assets: z
    .array(
      assetMetaSchema.omit({ projectId: true }).extend({
        /** Path inside the archive, always under assets/. */
        path: z.string().regex(/^assets\/[A-Za-z0-9_-]{1,64}\.(png|jpg|svg|ttf|otf)$/),
        sha256: z.string().regex(/^[0-9a-f]{64}$/),
      }),
    )
    .max(100),
});
export type ExportManifest = z.infer<typeof exportManifestSchema>;

// ---------------------------------------------------------------- helpers

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.length > 0;
  } catch {
    return false;
  }
}

type ReferenceIssue = { message: string; path: (string | number)[] };

/** Every asset or color ID mentioned in the brand must exist. */
export function findBrokenReferences(project: {
  brand: BrandIdentity;
  assetIds: string[];
}): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];
  const assets = new Set(project.assetIds);
  const colors = new Set(project.brand.colors.map((c) => c.id));
  const { brand } = project;

  if (colors.size !== brand.colors.length) {
    issues.push({ message: v().colorIdsRepeat, path: ['brand', 'colors'] });
  }
  if (assets.size !== project.assetIds.length) {
    issues.push({ message: v().assetIdsRepeat, path: ['assetIds'] });
  }

  for (const variant of LOGO_VARIANTS) {
    const id = brand.logo.variants[variant];
    if (id && !assets.has(id)) {
      issues.push({ message: v().missingLogo(variant), path: ['brand', 'logo', 'variants', variant] });
    }
  }
  brand.imagery.images.forEach((image, index) => {
    if (!assets.has(image.assetId)) {
      issues.push({ message: v().missingImage, path: ['brand', 'imagery', 'images', index, 'assetId'] });
    }
  });

  const fontIds = new Set<string>();
  brand.customFonts.forEach((font, index) => {
    if (fontIds.has(font.id) || isBundledFamily(font.id)) issues.push({ message: v().fontIdsRepeat, path: ['brand', 'customFonts', index, 'id'] });
    fontIds.add(font.id);
    font.files.forEach((file, fileIndex) => {
      if (!assets.has(file.assetId)) issues.push({ message: v().missingFontFile(font.name), path: ['brand', 'customFonts', index, 'files', fileIndex, 'assetId'] });
    });
  });
  for (const role of TYPOGRAPHY_ROLES) {
    const style = brand.typography[role];
    if (!isBundledFamily(style.familyId) && !fontIds.has(style.familyId)) {
      issues.push({ message: v().unknownFont, path: ['brand', 'typography', role, 'familyId'] });
    } else if (!resolveFamily(style.familyId, brand.customFonts).weights.includes(style.weight)) {
      issues.push({ message: v().fontWeight, path: ['brand', 'typography', role, 'weight'] });
    }
  }

  const checkColor = (id: string | null, path: (string | number)[]) => {
    if (id && !colors.has(id)) issues.push({ message: v().deletedColorRef, path });
  };
  checkColor(brand.cover.backgroundColorId, ['brand', 'cover', 'backgroundColorId']);
  checkColor(brand.logo.previewColorId, ['brand', 'logo', 'previewColorId']);
  for (const [key, mockup] of Object.entries(brand.mockups)) {
    for (const [slot, id] of Object.entries(mockup.colors)) {
      checkColor(id, ['brand', 'mockups', key, 'colors', slot]);
    }
  }
  return issues;
}
