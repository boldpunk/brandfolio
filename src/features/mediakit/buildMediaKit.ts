/**
 * Builds the media kit: renders every image from the project's view model,
 * writes the palettes, signature and README, and packs it all into one ZIP.
 * Runs in the browser (Canvas 2D); nothing leaves the device.
 */
import { zipSync, type Zippable } from 'fflate';
import { FONT_FAMILIES, isBundledFamily } from '@/domain/fonts';
import type { Asset, LogoVariantKind, Project } from '@/domain/schema';
import { buildViewModel, readableOn } from '@/features/brandbook/viewModel';
import { buildTokens } from '@/features/export/archive';
import { msg } from '@/i18n/core';
import { brandMessages } from '@/i18n/messages/brand';
import { mediakitMessages } from '@/i18n/messages/mediakit';
// Registers the bundled document faces so canvas text can use them anywhere in the app.
import '@/templates/html/documentFonts.css';
import {
  COLOR_FILES,
  COVER_FORMATS,
  FAVICON_FORMATS,
  LOGO_KINDS,
  LOGO_ON_BRAND,
  LOGO_RENDER_PX,
  logoOriginalPath,
  logoRenderPath,
  README_PATH,
  SIGNATURE_PATH,
  SOCIAL_FORMATS,
} from './formats';
import { fitContain, pickReadable } from './layout';
import { loadFaces, loadImage, logoTone, renderFormat, renderLogo, type KitScene, type LoadedLogo } from './render';
import { asePalette, colorsCss, emailSignature, fileLabel, fontStack, gplPalette, readmeText, type FontCategory, type PaletteColor } from './writers';

export type MediaKitFile = { path: string; blob: Blob; width?: number; height?: number };
export type MediaKit = { files: MediaKitFile[]; zip: Blob };

const ORIGINAL_EXT: Partial<Record<Asset['mimeType'], 'svg' | 'png' | 'jpg'>> = { 'image/svg+xml': 'svg', 'image/png': 'png', 'image/jpeg': 'jpg' };

const text = (value: string, type: string) => new Blob([new TextEncoder().encode(value)], { type });

function fontCategory(project: Project, familyId: string): FontCategory {
  if (isBundledFamily(familyId)) return FONT_FAMILIES[familyId].category;
  return project.brand.customFonts.find((f) => f.id === familyId)?.category ?? 'sans';
}

async function loadLogos(project: Project, byId: ReadonlyMap<string, Asset>, urls: string[]): Promise<{ loaded: LoadedLogo[]; assets: Map<LogoVariantKind, Asset> }> {
  const loaded: LoadedLogo[] = [];
  const assets = new Map<LogoVariantKind, Asset>();
  for (const kind of LOGO_KINDS) {
    const id = project.brand.logo.variants[kind];
    const asset = id ? byId.get(id) : undefined;
    if (!asset || asset.kind !== 'logo' || !ORIGINAL_EXT[asset.mimeType]) continue;
    assets.set(kind, asset);
    const url = URL.createObjectURL(asset.blob);
    urls.push(url);
    const image = await loadImage(url);
    const vector = asset.mimeType === 'image/svg+xml';
    // SVG natural size may be a 300×150 default; the stored size comes from the viewBox.
    const width = (vector ? asset.width : image.naturalWidth) || image.naturalWidth || asset.width || 1;
    const height = (vector ? asset.height : image.naturalHeight) || image.naturalHeight || asset.height || 1;
    loaded.push({ kind, image, width, height, vector, tone: logoTone(image, { width, height }) });
  }
  return { loaded, assets };
}

export async function buildMediaKit(project: Project, assets: readonly Asset[], now = new Date()): Promise<MediaKit> {
  const byId = new Map(assets.map((a) => [a.id, a]));
  const vm = buildViewModel(project, byId);
  const { brand, language } = project;
  const t = vm.tokens;
  const doc = msg(mediakitMessages, language);
  const labels = brandMessages[language];
  const palette = { background: t.background, text: t.text, primary: t.primary, secondary: t.secondary, accent: t.accent };
  const colorHex = (id: string | null) => (id ? brand.colors.find((c) => c.id === id)?.hex : undefined);
  const socialColors = brand.mockups.socialPost.colors;
  const socialBackground = colorHex(socialColors.backgroundColorId) ?? t.primary;

  const faces = { heading: t.type.heading, body: t.type.body, caption: t.type.caption };
  const face = (r: keyof typeof faces) => ({ cssFamily: faces[r].cssFamily, weight: faces[r].weight, trackingEm: faces[r].trackingEm });
  await loadFaces([face('heading'), face('body'), face('caption')]);

  const urls: string[] = [];
  try {
    const logos = await loadLogos(project, byId, urls);
    const scene: KitScene = {
      name: vm.documentTitle,
      headline: brand.mockups.socialPost.headline.trim() || vm.documentTitle,
      caption: brand.mockups.socialPost.caption.trim(),
      subtitle: brand.cover.subtitle.trim(),
      website: brand.contacts.website,
      palette,
      social: {
        background: socialBackground,
        text: colorHex(socialColors.textColorId) ?? readableOn(socialBackground, palette),
        accent: colorHex(socialColors.accentColorId) ?? t.accent,
      },
      fonts: { heading: face('heading'), body: face('body'), caption: face('caption') },
      logos: logos.loaded,
    };

    const files: MediaKitFile[] = [];
    for (const f of [...SOCIAL_FORMATS, ...COVER_FORMATS]) files.push({ path: f.path, blob: await renderFormat(scene, f), width: f.width, height: f.height });

    const renders = new Map<LogoVariantKind, { width: number; height: number }>();
    for (const [kind, asset] of logos.assets) files.push({ path: logoOriginalPath(kind, ORIGINAL_EXT[asset.mimeType]!), blob: asset.blob, width: asset.width, height: asset.height });
    for (const logo of logos.loaded) {
      const png = await renderLogo(logo, LOGO_RENDER_PX);
      renders.set(logo.kind, png);
      files.push({ path: logoRenderPath(logo.kind), blob: png.blob, width: png.width, height: png.height });
    }
    files.push({ path: LOGO_ON_BRAND.path, blob: await renderFormat(scene, LOGO_ON_BRAND), width: LOGO_ON_BRAND.width, height: LOGO_ON_BRAND.height });
    for (const f of FAVICON_FORMATS) files.push({ path: f.path, blob: await renderFormat(scene, f), width: f.width, height: f.height });

    const colors: PaletteColor[] = brand.colors.map((c) => ({ name: c.name.trim() || labels.colorRoles[c.role], hex: c.hex }));
    files.push(
      { path: COLOR_FILES.css, blob: text(colorsCss(vm.documentTitle, colors, palette), 'text/css') },
      { path: COLOR_FILES.tokens, blob: text(buildTokens(project).json, 'application/json') },
      { path: COLOR_FILES.ase, blob: new Blob([asePalette(vm.documentTitle, colors)], { type: 'application/octet-stream' }) },
      { path: COLOR_FILES.gpl, blob: text(gplPalette(vm.documentTitle, colors), 'text/plain') },
    );

    // Email clients show signatures on white: the logo variant that reads there.
    const signatureLogo = pickReadable(logos.loaded.map((l) => ({ item: l, tone: l.tone })), '#FFFFFF');
    const render = signatureLogo ? renders.get(signatureLogo.kind) : undefined;
    const shown = render ? fitContain(render, { width: 160, height: 56 }) : null;
    const card = brand.mockups.businessCard;
    files.push({
      path: SIGNATURE_PATH,
      blob: text(
        emailSignature({
          lang: language,
          brandName: vm.documentTitle,
          personName: card.personName,
          personRole: card.personRole,
          organization: brand.contacts.organization,
          email: brand.contacts.email,
          website: brand.contacts.website,
          logo: signatureLogo && shown ? { src: logoRenderPath(signatureLogo.kind), width: Math.round(shown.width), height: Math.round(shown.height) } : null,
          colors: { text: t.text, muted: t.muted, primary: t.primary },
          fonts: {
            heading: fontStack(faces.heading.familyLabel, fontCategory(project, brand.typography.heading.familyId)),
            body: fontStack(faces.body.familyLabel, fontCategory(project, brand.typography.body.familyId)),
          },
          hostingComment: doc.readme.signatureComment,
        }),
        'text/html',
      ),
    });

    const notes = [
      ...(logos.loaded.length ? [] : [doc.readme.noLogo]),
      doc.readme.story,
      doc.readme.youtube,
      doc.readme.linkedin,
      doc.readme.favicon,
      doc.readme.signature,
      doc.readme.fonts(faces.heading.familyLabel, faces.body.familyLabel),
    ];
    const entries = [...files, { path: README_PATH }].map((f) => ({ ...f, label: fileLabel(f.path, doc.files, labels.logoVariants) }));
    const readme = readmeText(doc.readme.heading(vm.documentTitle), doc.readme.created(now.toISOString().slice(0, 10)), entries, doc.readme.notesHeading, notes);
    files.push({ path: README_PATH, blob: text(readme, 'text/plain') });

    const zippable: Zippable = {};
    for (const file of files) {
      const bytes = new Uint8Array(await file.blob.arrayBuffer());
      zippable[file.path] = [bytes, { level: /\.(png|jpg)$/.test(file.path) ? 0 : 6, mtime: now }];
    }
    return { files, zip: new Blob([zipSync(zippable)], { type: 'application/zip' }) };
  } finally {
    urls.forEach((url) => URL.revokeObjectURL(url));
  }
}
