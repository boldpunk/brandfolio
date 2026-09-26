/**
 * What the media kit contains: every generated image with its path and pixel
 * size, and the file name of the ZIP. Paths are ASCII (see export/fileNames).
 */
import type { LogoVariantKind, Project } from '@/domain/schema';
import { fileBaseName } from '@/features/export/fileNames';

export type ImageFormatId = 'avatar' | 'post' | 'story' | 'youtube' | 'linkedin' | 'og' | 'favicon32' | 'appleTouch' | 'icon192' | 'icon512' | 'logoOnBrand';

export type ImageFormat = { id: ImageFormatId; path: string; width: number; height: number };

const format = (id: ImageFormatId, path: string, width: number, height: number): ImageFormat => ({ id, path, width, height });

export const SOCIAL_FORMATS = [
  format('avatar', 'social/avatar-1080.png', 1080, 1080),
  format('post', 'social/post-1080.png', 1080, 1080),
  format('story', 'social/story-1080x1920.png', 1080, 1920),
] as const;

export const COVER_FORMATS = [
  format('youtube', 'covers/youtube-2560x1440.png', 2560, 1440),
  format('linkedin', 'covers/linkedin-1584x396.png', 1584, 396),
  format('og', 'covers/telegram-og-1200x630.png', 1200, 630),
] as const;

export const FAVICON_FORMATS = [
  format('favicon32', 'favicon/favicon-32.png', 32, 32),
  format('appleTouch', 'favicon/apple-touch-icon-180.png', 180, 180),
  format('icon192', 'favicon/icon-192.png', 192, 192),
  format('icon512', 'favicon/icon-512.png', 512, 512),
] as const;

export const LOGO_ON_BRAND = format('logoOnBrand', 'logos/primary-on-brand-color.png', 1600, 1000);

/** Long side of the transparent PNG render of each logo variant. */
export const LOGO_RENDER_PX = 1024;

export const LOGO_KINDS: readonly LogoVariantKind[] = ['primary', 'alternative', 'mark', 'light'];

export const logoOriginalPath = (kind: LogoVariantKind, ext: 'svg' | 'png' | 'jpg') => `logos/${kind}.${ext}`;
export const logoRenderPath = (kind: LogoVariantKind) => `logos/${kind}-${LOGO_RENDER_PX}.png`;

export const COLOR_FILES = { css: 'colors/colors.css', tokens: 'colors/tokens.json', ase: 'colors/palette.ase', gpl: 'colors/palette.gpl' } as const;
export const SIGNATURE_PATH = 'email-signature.html';
export const README_PATH = 'README.txt';

/** `<transliterated-title>-media-kit.zip`, ASCII only. */
export function mediaKitFileName(project: Pick<Project, 'title'>): string {
  return `${fileBaseName(project.title) || 'brand'}-media-kit.zip`;
}

/** Folder a kit path belongs to, used for grouping in the panel and README. */
export type KitGroup = 'social' | 'covers' | 'logos' | 'favicons' | 'colors' | 'other';

export function groupOf(path: string): KitGroup {
  const folder = path.split('/')[0];
  switch (folder) {
    case 'social':
    case 'covers':
    case 'logos':
    case 'colors':
      return folder;
    case 'favicon':
      return 'favicons';
    default:
      return 'other';
  }
}
