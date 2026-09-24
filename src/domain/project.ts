import { createId } from './ids';
import {
  CURRENT_SCHEMA_VERSION,
  SECTION_KINDS,
  type BrandIdentity,
  type Project,
  type SectionConfig,
  type TemplateId,
} from './schema';

export const SECTION_LABELS: Record<SectionConfig['kind'], string> = {
  cover: 'Обложка',
  about: 'О бренде',
  logo: 'Логотип',
  colors: 'Цвета',
  typography: 'Типографика',
  imagery: 'Стиль изображений',
  voice: 'Тон общения',
  applications: 'Примеры применения',
  contacts: 'Контакты',
};

export function defaultSections(): SectionConfig[] {
  return SECTION_KINDS.map((kind) => ({ kind, visible: true }));
}

/**
 * Empty brand: every text is blank so nothing invented reaches the export.
 * The palette starts with two neutral colors because a brandbook needs at
 * least two (background and text) for any layout to render.
 */
export function emptyBrand(): BrandIdentity {
  const background = createId('c');
  const textColor = createId('c');
  return {
    cover: {
      title: '',
      subtitle: '',
      version: '1.0',
      date: '',
      author: '',
      logoVariant: 'primary',
      backgroundColorId: null,
    },
    about: { description: '', mission: '', values: [], audience: '', positioning: '' },
    logo: {
      variants: { primary: null, alternative: null, mark: null, light: null },
      clearSpace: 0.25,
      minSizePx: null,
      minSizeMm: null,
      usageRules: '',
      doRules: [],
      dontRules: [],
      misuse: { stretch: true, rotate: true, busyBackground: true },
      previewColorId: null,
    },
    colors: [
      { id: background, name: 'Фон', role: 'background', hex: '#FFFFFF' },
      { id: textColor, name: 'Текст', role: 'text', hex: '#1A1A1A' },
    ],
    typography: {
      heading: { role: 'heading', familyId: 'manrope', weight: 700, sizePx: 40, lineHeight: 1.1, trackingEm: -0.01 },
      body: { role: 'body', familyId: 'noto-sans', weight: 400, sizePx: 16, lineHeight: 1.5, trackingEm: 0 },
      caption: { role: 'caption', familyId: 'noto-sans', weight: 400, sizePx: 12, lineHeight: 1.4, trackingEm: 0.02 },
    },
    imagery: { images: [], lighting: '', composition: '', processing: '', avoid: '' },
    voice: {
      qualities: [
        { id: createId('q'), title: '', description: '' },
        { id: createId('q'), title: '', description: '' },
        { id: createId('q'), title: '', description: '' },
      ],
      rules: [],
      pairs: [],
    },
    mockups: {
      businessCard: {
        kind: 'business-card',
        enabled: true,
        colors: { backgroundColorId: null, textColorId: null, accentColorId: null },
        personName: '',
        personRole: '',
        phone: '',
      },
      socialPost: {
        kind: 'social-post',
        enabled: true,
        colors: { backgroundColorId: null, textColorId: null, accentColorId: null },
        headline: '',
        caption: '',
      },
      websiteHero: {
        kind: 'website-hero',
        enabled: true,
        colors: { backgroundColorId: null, textColorId: null, accentColorId: null },
        headline: '',
        subheadline: '',
        ctaLabel: '',
      },
      packagingLabel: {
        kind: 'packaging-label',
        enabled: true,
        colors: { backgroundColorId: null, textColorId: null, accentColorId: null },
        productName: '',
        descriptor: '',
        netContent: '',
      },
    },
    contacts: { organization: '', email: '', website: '', usageNote: '' },
  };
}

export function createEmptyProject(title: string, templateId: TemplateId = 'editorial', now = new Date()): Project {
  const iso = now.toISOString();
  return {
    id: createId('p'),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    revision: 0,
    title,
    createdAt: iso,
    updatedAt: iso,
    templateId,
    isDemo: false,
    brand: emptyBrand(),
    sections: defaultSections(),
    assetIds: [],
  };
}
