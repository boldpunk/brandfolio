/**
 * BrandbookViewModel: the single, render-ready description of a brandbook.
 * Both the HTML preview and the PDF adapter consume it, so content, tokens,
 * order and visibility are identical in both. It contains no React, no Blob
 * and no URLs; assets are referenced by ID and resolved by each renderer.
 */
import { contrastRatio, formatHsl, formatRatio, formatRgb, hexToRgb, readableTextOn, rgbToHsl } from '@/domain/color';
import { pxToPt, resolveFamily, WEIGHT_LABELS, type CustomFontFamily } from '@/domain/fonts';
import type {
  AssetMeta,
  BrandColor,
  ColorRole,
  LogoVariantKind,
  MockupColors,
  Project,
  SectionKind,
  TemplateId,
  TypographyRole,
  TypographyStyle,
} from '@/domain/schema';
import { LOCALE_TAGS, type Locale } from '@/i18n/locales';
import { brandMessages } from '@/i18n/messages/brand';
import { documentMessages } from '@/i18n/messages/document';

export type AssetRef = { id: string; mimeType: AssetMeta['mimeType']; width: number; height: number; filename: string };

export type ResolvedColor = {
  id: string;
  name: string;
  role: ColorRole;
  roleLabel: string;
  hex: string;
  rgb: string;
  hsl: string;
  /** Readable label color on top of this swatch. */
  onColor: string;
  contrastWithBackground: number;
  contrastWithText: number;
};

export type ResolvedType = {
  role: TypographyRole;
  roleLabel: string;
  familyLabel: string;
  cssFamily: string;
  weight: number;
  weightLabel: string;
  sizePx: number;
  sizePt: number;
  lineHeight: number;
  trackingEm: number;
};

export type Tokens = {
  background: string;
  text: string;
  primary: string;
  secondary: string;
  accent: string;
  muted: string;
  type: Record<TypographyRole, ResolvedType>;
};

export type LabeledText = { label: string; text: string };

export type ResolvedMockupColors = { background: string; text: string; accent: string };

export type MockupVM =
  | { kind: 'business-card'; colors: ResolvedMockupColors; personName: string; personRole: string; phone: string }
  | { kind: 'social-post'; colors: ResolvedMockupColors; headline: string; caption: string }
  | { kind: 'website-hero'; colors: ResolvedMockupColors; headline: string; subheadline: string; ctaLabel: string }
  | { kind: 'packaging-label'; colors: ResolvedMockupColors; productName: string; descriptor: string; netContent: string };

type SectionBase = { kind: SectionKind; title: string; number: number; isEmpty: boolean };

export type SectionVM =
  | (SectionBase & {
      kind: 'cover';
      heading: string;
      subtitle: string;
      version: string;
      dateLabel: string;
      author: string;
      logo: AssetRef | null;
      /** Light logo version, used when a template puts the cover on a dark surface. */
      light: AssetRef | null;
      background: string;
      /** False when the user left the cover background on automatic. */
      backgroundChosen: boolean;
      foreground: string;
    })
  | (SectionBase & { kind: 'about'; description: string; blocks: LabeledText[]; values: string[] })
  | (SectionBase & {
      kind: 'logo';
      variants: { kind: LogoVariantKind; label: string; asset: AssetRef }[];
      primary: AssetRef | null;
      light: AssetRef | null;
      clearSpace: number;
      minSizePx: number | null;
      minSizeMm: number | null;
      usageRules: string;
      doRules: string[];
      dontRules: string[];
      misuse: Project['brand']['logo']['misuse'];
      backgrounds: { light: string; dark: string; brand: string };
    })
  | (SectionBase & { kind: 'colors'; colors: ResolvedColor[]; backgroundHex: string; textHex: string })
  | (SectionBase & { kind: 'typography'; styles: ResolvedType[]; sampleHeading: string; sampleParagraph: string })
  | (SectionBase & {
      kind: 'imagery';
      images: { id: string; asset: AssetRef; caption: string; focalX: number; focalY: number }[];
      rules: LabeledText[];
    })
  | (SectionBase & {
      kind: 'voice';
      qualities: { title: string; description: string }[];
      rules: string[];
      pairs: { say: string; avoid: string }[];
    })
  | (SectionBase & {
      kind: 'applications';
      mockups: MockupVM[];
      brandName: string;
      logo: AssetRef | null;
      logoOnDark: AssetRef | null;
      contacts: { email: string; website: string; organization: string };
    })
  | (SectionBase & { kind: 'contacts'; organization: string; email: string; website: string; usageNote: string });

export type BrandbookViewModel = {
  projectId: string;
  revision: number;
  templateId: TemplateId;
  /** Language of the document's own labels (project.language), not of the interface. */
  language: Locale;
  documentTitle: string;
  author: string;
  tokens: Tokens;
  sections: SectionVM[];
  /** Sections that are switched on but have nothing to show; renderers skip them in export. */
  emptySections: SectionKind[];
  /** Assets the document needs; export checks that all are present before rendering. */
  requiredAssetIds: string[];
};

const LOGO_KINDS: LogoVariantKind[] = ['primary', 'alternative', 'mark', 'light'];

export const TYPE_SAMPLE = {
  alphabetRu: 'Аа Бб Вв Гг Дд Ее Ёё Жж Зз Ии Йй Кк Лл Мм Нн Оо Пп Рр Сс Тт Уу Фф Хх Цц Чч Шш Щщ Ъъ Ыы Ьь Ээ Юю Яя',
  alphabetLatin: 'Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk Ll Mm Nn Oo Pp Qq Rr Ss Tt Uu Vv Ww Xx Yy Zz',
  digits: '0123456789 № % & ( ) « » — ‘ ’',
  uzbek: 'O‘zbekiston, G‘ijduvon, o‘, g‘',
};

const hasText = (s: string) => s.trim().length > 0;

function pickByRole(colors: BrandColor[], role: ColorRole): BrandColor | undefined {
  return colors.find((c) => c.role === role);
}

export function resolveTokens(project: Project): Omit<Tokens, 'type'> {
  const colors = project.brand.colors;
  const byLuminance = [...colors].sort((a, b) => contrastRatio(b.hex, '#000000') - contrastRatio(a.hex, '#000000'));
  const background = pickByRole(colors, 'background')?.hex ?? byLuminance[0]?.hex ?? '#FFFFFF';
  const text = pickByRole(colors, 'text')?.hex ?? byLuminance.at(-1)?.hex ?? '#1A1A1A';
  const firstBrand = colors.find((c) => c.role !== 'background' && c.role !== 'text')?.hex;
  const primary = pickByRole(colors, 'primary')?.hex ?? firstBrand ?? text;
  const secondary = pickByRole(colors, 'secondary')?.hex ?? primary;
  const accent = pickByRole(colors, 'accent')?.hex ?? primary;
  return { background, text, primary, secondary, accent, muted: mix(text, background, 0.35) };
}

/** Linear sRGB-space mix used only for secondary text tone in documents. */
function mix(a: string, b: string, amount: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  const c = (p: number, q: number) => Math.round(p + (q - p) * amount).toString(16).padStart(2, '0');
  return `#${c(x.r, y.r)}${c(x.g, y.g)}${c(x.b, y.b)}`.toUpperCase();
}

function resolveType(style: TypographyStyle, language: Locale, customFonts: readonly CustomFontFamily[]): ResolvedType {
  const family = resolveFamily(style.familyId, customFonts);
  return {
    role: style.role,
    roleLabel: brandMessages[language].typeRoles[style.role],
    familyLabel: family.label,
    cssFamily: family.cssFamily,
    weight: style.weight,
    weightLabel: WEIGHT_LABELS[style.weight] ?? String(style.weight),
    sizePx: style.sizePx,
    sizePt: Math.round(pxToPt(style.sizePx) * 10) / 10,
    lineHeight: style.lineHeight,
    trackingEm: style.trackingEm,
  };
}

function formatDate(iso: string, language: Locale): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(LOCALE_TAGS[language], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(y!, m! - 1, d!));
}

export function buildViewModel(project: Project, assets: ReadonlyMap<string, AssetMeta>): BrandbookViewModel {
  const { brand, language } = project;
  const labels = brandMessages[language];
  const doc = documentMessages[language];
  const base = resolveTokens(project);
  const tokens: Tokens = {
    ...base,
    type: {
      heading: resolveType(brand.typography.heading, language, brand.customFonts),
      body: resolveType(brand.typography.body, language, brand.customFonts),
      caption: resolveType(brand.typography.caption, language, brand.customFonts),
    },
  };
  const colorHex = (id: string | null) => (id ? brand.colors.find((c) => c.id === id)?.hex : undefined);
  const asset = (id: string | null): AssetRef | null => {
    if (!id) return null;
    const meta = assets.get(id);
    if (!meta) return null;
    return { id, mimeType: meta.mimeType, width: meta.width ?? 1, height: meta.height ?? 1, filename: meta.filename };
  };
  const required = new Set<string>();
  const need = (ref: AssetRef | null) => (ref && required.add(ref.id), ref);

  const variants = brand.logo.variants;
  const primaryLogo = asset(variants.primary) ?? asset(variants.mark) ?? asset(variants.alternative);
  const lightLogo = asset(variants.light);

  const resolveMockupColors = (colors: MockupColors, fallbackBg: string): ResolvedMockupColors => {
    const background = colorHex(colors.backgroundColorId) ?? fallbackBg;
    const autoText = contrastRatio(base.text, background) >= contrastRatio(base.background, background) ? base.text : base.background;
    return {
      background,
      text: colorHex(colors.textColorId) ?? autoText,
      accent: colorHex(colors.accentColorId) ?? base.accent,
    };
  };

  const sections: SectionVM[] = [];
  const emptySections: SectionKind[] = [];
  let number = 0;

  for (const config of project.sections) {
    if (!config.visible) continue;
    const title = labels.sections[config.kind];
    const sectionNumber = config.kind === 'cover' ? 0 : ++number;
    let section: SectionVM;
    switch (config.kind) {
      case 'cover': {
        const background = colorHex(brand.cover.backgroundColorId) ?? base.background;
        const logoKind = brand.cover.logoVariant;
        const coverLogo = asset(variants[logoKind]) ?? primaryLogo;
        section = {
          kind: 'cover',
          title,
          number: sectionNumber,
          heading: brand.cover.title.trim() || project.title,
          subtitle: brand.cover.subtitle,
          version: brand.cover.version,
          dateLabel: formatDate(brand.cover.date, language),
          author: brand.cover.author,
          logo: need(coverLogo),
          light: need(lightLogo),
          background,
          backgroundChosen: colorHex(brand.cover.backgroundColorId) !== undefined,
          foreground: contrastRatio(base.text, background) >= contrastRatio(base.background, background) ? base.text : base.background,
          isEmpty: false,
        };
        break;
      }
      case 'about': {
        const a = brand.about;
        const blocks = [
          { label: doc.about.mission, text: a.mission },
          { label: doc.about.audience, text: a.audience },
          { label: doc.about.positioning, text: a.positioning },
        ].filter((b) => hasText(b.text));
        const values = a.values.filter(hasText);
        section = { kind: 'about', title, number: sectionNumber, description: a.description, blocks, values, isEmpty: !hasText(a.description) && !blocks.length && !values.length };
        break;
      }
      case 'logo': {
        const l = brand.logo;
        const list = LOGO_KINDS.map((kind) => ({ kind, label: labels.logoVariants[kind], asset: need(asset(variants[kind])) }))
          .filter((v): v is { kind: LogoVariantKind; label: string; asset: AssetRef } => v.asset !== null);
        section = {
          kind: 'logo',
          title,
          number: sectionNumber,
          variants: list,
          primary: primaryLogo,
          light: lightLogo,
          clearSpace: l.clearSpace,
          minSizePx: l.minSizePx,
          minSizeMm: l.minSizeMm,
          usageRules: l.usageRules,
          doRules: l.doRules.filter(hasText),
          dontRules: l.dontRules.filter(hasText),
          misuse: l.misuse,
          backgrounds: { light: '#FFFFFF', dark: '#1A1A1A', brand: colorHex(l.previewColorId) ?? base.primary },
          isEmpty: list.length === 0 && !hasText(l.usageRules),
        };
        break;
      }
      case 'colors': {
        const colors = brand.colors.map<ResolvedColor>((c) => {
          const rgb = hexToRgb(c.hex);
          return {
            id: c.id,
            name: c.name,
            role: c.role,
            roleLabel: labels.colorRoles[c.role],
            hex: c.hex,
            rgb: formatRgb(rgb),
            hsl: formatHsl(rgbToHsl(rgb)),
            onColor: readableTextOn(c.hex),
            contrastWithBackground: contrastRatio(c.hex, base.background),
            contrastWithText: contrastRatio(c.hex, base.text),
          };
        });
        section = { kind: 'colors', title, number: sectionNumber, colors, backgroundHex: base.background, textHex: base.text, isEmpty: colors.length === 0 };
        break;
      }
      case 'typography':
        section = {
          kind: 'typography',
          title,
          number: sectionNumber,
          styles: [tokens.type.heading, tokens.type.body, tokens.type.caption],
          sampleHeading: brand.cover.title.trim() || project.title,
          sampleParagraph: brand.about.description.trim(),
          isEmpty: false,
        };
        break;
      case 'imagery': {
        const im = brand.imagery;
        const images = im.images
          .map((i) => ({ id: i.id, asset: need(asset(i.assetId)), caption: i.caption, focalX: i.focalX, focalY: i.focalY }))
          .filter((i): i is typeof i & { asset: AssetRef } => i.asset !== null);
        const rules = [
          { label: doc.imagery.lighting, text: im.lighting },
          { label: doc.imagery.composition, text: im.composition },
          { label: doc.imagery.processing, text: im.processing },
          { label: doc.imagery.avoid, text: im.avoid },
        ].filter((r) => hasText(r.text));
        section = { kind: 'imagery', title, number: sectionNumber, images, rules, isEmpty: !images.length && !rules.length };
        break;
      }
      case 'voice': {
        const v = brand.voice;
        const qualities = v.qualities.filter((q) => hasText(q.title) || hasText(q.description)).map(({ title: t, description }) => ({ title: t, description }));
        const rules = v.rules.filter(hasText);
        const pairs = v.pairs.filter((p) => hasText(p.say) || hasText(p.avoid)).map(({ say, avoid }) => ({ say, avoid }));
        section = { kind: 'voice', title, number: sectionNumber, qualities, rules, pairs, isEmpty: !qualities.length && !rules.length && !pairs.length };
        break;
      }
      case 'applications': {
        const m = brand.mockups;
        const mockups: MockupVM[] = [];
        if (m.businessCard.enabled)
          mockups.push({ kind: 'business-card', colors: resolveMockupColors(m.businessCard.colors, base.background), personName: m.businessCard.personName, personRole: m.businessCard.personRole, phone: m.businessCard.phone });
        if (m.socialPost.enabled)
          mockups.push({ kind: 'social-post', colors: resolveMockupColors(m.socialPost.colors, base.primary), headline: m.socialPost.headline, caption: m.socialPost.caption });
        if (m.websiteHero.enabled)
          mockups.push({ kind: 'website-hero', colors: resolveMockupColors(m.websiteHero.colors, base.background), headline: m.websiteHero.headline, subheadline: m.websiteHero.subheadline, ctaLabel: m.websiteHero.ctaLabel });
        if (m.packagingLabel.enabled)
          mockups.push({ kind: 'packaging-label', colors: resolveMockupColors(m.packagingLabel.colors, base.background), productName: m.packagingLabel.productName, descriptor: m.packagingLabel.descriptor, netContent: m.packagingLabel.netContent });
        need(primaryLogo);
        need(lightLogo);
        section = {
          kind: 'applications',
          title,
          number: sectionNumber,
          mockups,
          brandName: brand.cover.title.trim() || project.title,
          logo: primaryLogo,
          logoOnDark: lightLogo,
          contacts: { email: brand.contacts.email, website: brand.contacts.website, organization: brand.contacts.organization },
          isEmpty: mockups.length === 0,
        };
        break;
      }
      case 'contacts': {
        const c = brand.contacts;
        section = {
          kind: 'contacts',
          title,
          number: sectionNumber,
          organization: c.organization,
          email: c.email,
          website: c.website,
          usageNote: c.usageNote,
          isEmpty: ![c.organization, c.email, c.website, c.usageNote].some(hasText),
        };
        break;
      }
    }
    if (section.isEmpty) emptySections.push(section.kind);
    sections.push(section);
  }

  return {
    projectId: project.id,
    revision: project.revision,
    templateId: project.templateId,
    language,
    documentTitle: brand.cover.title.trim() || project.title,
    author: brand.cover.author.trim() || brand.contacts.organization.trim(),
    tokens,
    sections,
    emptySections,
    requiredAssetIds: [...required],
  };
}

/** Human text for a contrast ratio used in documents. */
/**
 * Tokens for a template's page surface. 'dark' swaps the brand's background
 * and text colors (an inverted book); 'tint' washes the background with a
 * little of the primary color. Brand colors themselves never change.
 */
export function surfaceTokens(tokens: Tokens, surface: 'light' | 'dark' | 'tint'): Tokens {
  if (surface === 'dark') return { ...tokens, background: tokens.text, text: tokens.background, muted: mix(tokens.background, tokens.text, 0.45) };
  if (surface === 'tint') {
    const background = mix(tokens.background, tokens.primary, 0.08);
    return { ...tokens, background, muted: mix(tokens.text, background, 0.35) };
  }
  return tokens;
}

export function ratioLabel(ratio: number): string {
  return `${formatRatio(ratio)}:1`;
}

/** Of the brand's text and background colors, the one more readable on `surface`. */
export function readableOn(surface: string, tokens: Pick<Tokens, 'text' | 'background'>): string {
  return contrastRatio(tokens.text, surface) >= contrastRatio(tokens.background, surface) ? tokens.text : tokens.background;
}

/** True when white text reads better than black on this color. */
export function isDark(hex: string): boolean {
  return contrastRatio(hex, '#FFFFFF') > contrastRatio(hex, '#000000');
}

/** Light logo on dark surfaces when the user uploaded one; never a CSS filter. */
export function logoForSurface(surface: string, logo: AssetRef | null, light: AssetRef | null): AssetRef | null {
  return isDark(surface) && light ? light : logo;
}
