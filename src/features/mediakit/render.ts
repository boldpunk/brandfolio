/**
 * Canvas 2D compositions of the media kit. Canvas (not SVG in <img>) so text
 * is set in the brand's own fonts, which the page has registered; layout math
 * lives in layout.ts. Browser only.
 */
import { contrastRatio, readableTextOn } from '@/domain/color';
import type { LogoVariantKind } from '@/domain/schema';
import { readableOn } from '@/features/brandbook/viewModel';
import { msg } from '@/i18n/core';
import { assetsMessages } from '@/i18n/messages/assets';
import type { ImageFormat } from './formats';
import {
  alignRect,
  averageColor,
  displayUrl,
  fitInCircle,
  fitText,
  mixHex,
  monogram,
  onCircle,
  pickReadable,
  scaleToLongSide,
  shapeColors,
  type Align,
  type FittedText,
  type Measure,
  type Rect,
  type Size,
} from './layout';
import type { RoleColors } from './writers';

export type Face = { cssFamily: string; weight: number; trackingEm: number };

/** A decoded logo variant; `vector` (SVG) is drawn at target size, raster is stepped down. */
export type LoadedLogo = { kind: LogoVariantKind; image: HTMLImageElement; width: number; height: number; tone: string | null; vector: boolean };

/** Everything a composition needs, resolved once from the project. */
export type KitScene = {
  name: string;
  headline: string;
  caption: string;
  subtitle: string;
  website: string;
  palette: RoleColors;
  social: { background: string; text: string; accent: string };
  fonts: { heading: Face; body: Face; caption: Face };
  logos: readonly LoadedLogo[];
};

// ---------------------------------------------------------------- canvas basics

type Ctx = CanvasRenderingContext2D;

function createCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: Ctx } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(msg(assetsMessages).canvasUnavailable);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { canvas, ctx };
}

function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error(msg(assetsMessages).pngFailed))), 'image/png'),
  );
}

/** Waits for `load`: WebKit rejects `decode()` for SVG images that draw fine. */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(msg(assetsMessages).pngFailed));
    image.src = url;
  });
}

/** Overall tone of a logo: mean color of its opaque pixels at thumbnail size. */
export function logoTone(image: HTMLImageElement, size: Size): string | null {
  const s = scaleToLongSide(size, 64);
  const { ctx } = createCanvas(s.width, s.height);
  ctx.drawImage(image, 0, 0, s.width, s.height);
  try {
    return averageColor(ctx.getImageData(0, 0, s.width, s.height).data);
  } catch {
    return null; // tainted canvas: never for Blob URLs, but stay safe
  }
}

/** Waits for every face used so text never falls back silently mid-render. */
export async function loadFaces(faces: readonly Face[]): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all(faces.map((f) => document.fonts.load(`${f.weight} 64px "${f.cssFamily}"`).catch(() => [])));
}

function setFace(ctx: Ctx, face: Face, size: number) {
  ctx.font = `${face.weight} ${size}px "${face.cssFamily}", sans-serif`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${(face.trackingEm * size).toFixed(2)}px`;
}

function measurer(ctx: Ctx, face: Face): Measure {
  return (text, size) => {
    setFace(ctx, face, size);
    return ctx.measureText(text).width;
  };
}

function capHeight(ctx: Ctx, face: Face, size: number): number {
  setFace(ctx, face, size);
  return ctx.measureText('H').actualBoundingBoxAscent || size * 0.72;
}

type TextBlock = FittedText & { face: Face; lineHeight: number; cap: number };

function block(ctx: Ctx, face: Face, fitted: FittedText, leading: number): TextBlock {
  return { ...fitted, face, lineHeight: fitted.size * leading, cap: capHeight(ctx, face, fitted.size) };
}

/** From the cap line of the first line to the baseline of the last. */
const blockHeight = (b: TextBlock) => (b.lines.length ? b.cap + (b.lines.length - 1) * b.lineHeight : 0);

/** Draws a block whose first cap line sits at `top`; returns the last baseline. */
function drawBlock(ctx: Ctx, b: TextBlock, x: number, top: number, color: string, align: Align = 'left'): number {
  setFace(ctx, b.face, b.size);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  let baseline = top + b.cap;
  b.lines.forEach((line, i) => {
    if (i) baseline += b.lineHeight;
    ctx.fillText(line, x, baseline);
  });
  return baseline;
}

function disc(ctx: Ctx, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Raster sources are halved step by step so small icons stay crisp; SVG draws directly. */
function drawImageHQ(ctx: Ctx, logo: LoadedLogo, rect: Rect) {
  let source: CanvasImageSource = logo.image;
  let w = logo.width;
  let h = logo.height;
  if (!logo.vector) {
    while (w / 2 >= rect.width && h / 2 >= rect.height) {
      const next = createCanvas(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
      next.ctx.drawImage(source, 0, 0, next.canvas.width, next.canvas.height);
      source = next.canvas;
      w = next.canvas.width;
      h = next.canvas.height;
    }
  }
  ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height);
}

// ---------------------------------------------------------------- brand helpers

type Slot = 'full' | 'mark';

const SLOT_ORDER: Record<Slot, LogoVariantKind[]> = {
  full: ['primary', 'alternative', 'light', 'mark'],
  mark: ['mark', 'primary', 'alternative', 'light'],
};

/** The variant that reads on `surface`, in brand order (the light one only when needed). */
function logoFor(scene: KitScene, slot: Slot, surface: string, filter: (l: LoadedLogo) => boolean = () => true): LoadedLogo | null {
  const candidates = SLOT_ORDER[slot]
    .map((kind) => scene.logos.find((l) => l.kind === kind))
    .filter((l): l is LoadedLogo => l !== undefined && filter(l))
    .map((l) => ({ item: l, tone: l.tone }));
  return pickReadable(candidates, surface);
}

/** Brand text or background color on the surface, black or white if neither reads. */
function textOn(surface: string, palette: RoleColors): string {
  const brand = readableOn(surface, palette);
  return contrastRatio(brand, surface) >= 4.5 ? brand : readableTextOn(surface);
}

/** Secondary text: toned toward the surface while keeping large-text contrast. */
function softText(text: string, surface: string): string {
  const soft = mixHex(text, surface, 0.22);
  return contrastRatio(soft, surface) >= 3 ? soft : text;
}

/**
 * Draws the logo for `slot` in `rect`, or, without a readable logo, the brand
 * name set in the heading font in the same place. Returns the drawn bounds.
 */
function drawBrand(ctx: Ctx, scene: KitScene, slot: Slot, surface: string, rect: Rect, align: Align, textColor: string): Rect {
  const logo = logoFor(scene, slot, surface);
  if (logo) {
    const r = alignRect(logo, rect, align);
    drawImageHQ(ctx, logo, r);
    return r;
  }
  const face = scene.fonts.heading;
  const fitted = fitText(scene.name, { maxWidth: rect.width, maxLines: 1, maxSize: rect.height / 0.72, minSize: Math.max(10, rect.height * 0.45) }, measurer(ctx, face));
  const b = block(ctx, face, fitted, 1.1);
  const top = rect.y + (rect.height - b.cap) / 2;
  const x = align === 'left' ? rect.x : align === 'right' ? rect.x + rect.width : rect.x + rect.width / 2;
  drawBlock(ctx, b, x, top, textColor, align);
  const width = Math.min(rect.width, measurer(ctx, face)(b.lines[0] ?? '', b.size));
  return { x: align === 'left' ? rect.x : align === 'right' ? rect.x + rect.width - width : x - width / 2, y: top, width, height: b.cap };
}

// ---------------------------------------------------------------- compositions

/** Circle-safe avatar: mark (or logo, or monogram) centred on the primary color. */
function avatar(ctx: Ctx, scene: KitScene, f: ImageFormat) {
  const { width: W, height: H } = f;
  let surface = scene.palette.primary;
  let logo = logoFor(scene, 'mark', surface);
  if (!logo && scene.logos.length) {
    surface = scene.palette.background;
    logo = logoFor(scene, 'mark', surface);
  }
  ctx.fillStyle = surface;
  ctx.fillRect(0, 0, W, H);
  if (logo) {
    const s = fitInCircle(logo, W * 0.3);
    drawImageHQ(ctx, logo, { x: (W - s.width) / 2, y: (H - s.height) / 2, ...s });
    return;
  }
  const color = textOn(surface, scene.palette);
  const face = scene.fonts.heading;
  const measure = measurer(ctx, face);
  const byName = fitText(scene.name, { maxWidth: W * 0.58, maxLines: 1, maxSize: W * 0.2, minSize: W * 0.1 }, measure);
  const useName = !byName.lines[0]?.endsWith('…') && byName.size >= W * 0.1;
  const fitted = useName ? byName : fitText(monogram(scene.name), { maxWidth: W * 0.5, maxLines: 1, maxSize: W * 0.34, minSize: W * 0.12 }, measure);
  const b = block(ctx, face, fitted, 1);
  drawBlock(ctx, b, W / 2, (H - b.cap) / 2, color, 'center');
}

/** Shared square/vertical social layout: logo top-left, headline low, discs top-right. */
function social(ctx: Ctx, scene: KitScene, f: ImageFormat, story: boolean) {
  const { width: W, height: H } = f;
  const { background: S, accent } = scene.social;
  const T = contrastRatio(scene.social.text, S) >= 3 ? scene.social.text : textOn(S, scene.palette);
  const [d1, d2] = shapeColors(S, scene.palette);
  const m = Math.round(W * 0.09);
  const top = story ? Math.round(H * 0.13) : m;
  const bottom = story ? H - Math.round(H * 0.13) : H - m;

  ctx.fillStyle = S;
  ctx.fillRect(0, 0, W, H);
  const big = story ? { x: W * 0.93, y: H * 0.3, r: W * 0.36 } : { x: W * 0.86, y: H * 0.14, r: W * 0.3 };
  disc(ctx, big.x, big.y, big.r, d1);
  // The small disc sits on the big one's left edge, above where the headline can reach.
  const small = onCircle(big.x, big.y, big.r, 165);
  disc(ctx, small.x, small.y, W * (story ? 0.06 : 0.05), d2);

  const headline = scene.headline;
  const hasLogo = scene.logos.length > 0;
  if (hasLogo || headline !== scene.name) drawBrand(ctx, scene, 'full', S, { x: m, y: top, width: W * 0.36, height: W * 0.075 }, 'left', T);

  let floor = bottom;
  const website = displayUrl(scene.website);
  if (website) {
    const fitted = fitText(website, { maxWidth: W - 2 * m, maxLines: 1, maxSize: W * 0.026, minSize: W * 0.018 }, measurer(ctx, scene.fonts.caption));
    const b = block(ctx, scene.fonts.caption, fitted, 1.2);
    drawBlock(ctx, b, m, bottom - b.cap, softText(T, S));
    floor = bottom - b.cap - W * 0.07;
  }

  const captionBlock = scene.caption
    ? block(ctx, scene.fonts.body, fitText(scene.caption, { maxWidth: W * 0.78, maxLines: story ? 3 : 2, maxSize: W * (story ? 0.036 : 0.03), minSize: W * 0.024 }, measurer(ctx, scene.fonts.body)), 1.4)
    : null;
  const head = block(
    ctx,
    scene.fonts.heading,
    fitText(headline, { maxWidth: W - 2 * m, maxLines: story ? 5 : 4, maxSize: W * (story ? 0.12 : 0.1), minSize: W * 0.05 }, measurer(ctx, scene.fonts.heading)),
    1.08,
  );
  const gap = W * 0.045;
  const captionTop = captionBlock ? floor - blockHeight(captionBlock) : floor;
  const headTop = (captionBlock ? captionTop - gap : floor) - blockHeight(head);
  const barColor = contrastRatio(accent, S) >= 1.5 ? accent : d2;
  ctx.fillStyle = barColor;
  ctx.fillRect(m, headTop - W * 0.065, W * 0.09, Math.max(4, W * 0.011));
  drawBlock(ctx, head, m, headTop, T);
  if (captionBlock) drawBlock(ctx, captionBlock, m, captionTop, softText(T, S));
}

/** YouTube: everything inside the 1546 × 423 area every device shows; shapes outside it. */
function youtube(ctx: Ctx, scene: KitScene, f: ImageFormat) {
  const { width: W, height: H } = f;
  const S = scene.palette.background;
  const T = textOn(S, scene.palette);
  const [d1, d2] = shapeColors(S, scene.palette);
  const primary = contrastRatio(scene.palette.primary, S) >= 1.2 ? scene.palette.primary : d2;
  ctx.fillStyle = S;
  ctx.fillRect(0, 0, W, H);
  disc(ctx, 0, H, H * 0.42, primary);
  disc(ctx, W, 0, H * 0.42, d1);
  const dot = onCircle(W, 0, H * 0.42, 135);
  disc(ctx, dot.x, dot.y, H * 0.05, primary);

  const safe = { x: (W - 1546) / 2, y: (H - 423) / 2, width: 1546, height: 423 };
  if (!scene.subtitle) {
    drawBrand(ctx, scene, 'full', S, { x: safe.x + safe.width * 0.15, y: safe.y + safe.height * 0.2, width: safe.width * 0.7, height: safe.height * 0.6 }, 'center', T);
    return;
  }
  drawBrand(ctx, scene, 'full', S, { x: safe.x, y: safe.y + safe.height * 0.22, width: safe.width * 0.42, height: safe.height * 0.56 }, 'left', T);
  const ruleX = safe.x + safe.width * 0.5;
  ctx.fillStyle = contrastRatio(scene.palette.primary, S) >= 1.5 ? scene.palette.primary : T;
  ctx.fillRect(ruleX - 3, safe.y + safe.height * 0.14, 6, safe.height * 0.72);

  const textX = ruleX + safe.width * 0.05;
  const width = safe.x + safe.width - textX;
  const sub = block(ctx, scene.fonts.heading, fitText(scene.subtitle, { maxWidth: width, maxLines: 3, maxSize: 64, minSize: 38 }, measurer(ctx, scene.fonts.heading)), 1.15);
  const website = displayUrl(scene.website);
  const site = website ? block(ctx, scene.fonts.caption, fitText(website, { maxWidth: width, maxLines: 1, maxSize: 34, minSize: 26 }, measurer(ctx, scene.fonts.caption)), 1.2) : null;
  const gap = 44;
  const total = blockHeight(sub) + (site ? gap + site.cap : 0);
  const top = safe.y + (safe.height - total) / 2;
  const last = drawBlock(ctx, sub, textX, top, T);
  if (site) drawBlock(ctx, site, textX, last + gap, softText(T, S));
}

/** LinkedIn: the profile photo covers the lower left, so the brand sits right. */
function linkedin(ctx: Ctx, scene: KitScene, f: ImageFormat) {
  const { width: W, height: H } = f;
  const S = scene.palette.primary;
  const T = textOn(S, scene.palette);
  const [d1, d2] = shapeColors(S, scene.palette);
  ctx.fillStyle = S;
  ctx.fillRect(0, 0, W, H);
  const big = { x: W * 0.4, y: H * 1.02, r: H * 0.62 };
  disc(ctx, big.x, big.y, big.r, d1);
  const dot = onCircle(big.x, big.y, big.r, -45);
  disc(ctx, dot.x, dot.y, H * 0.075, d2);

  const m = W * 0.06;
  const right = W - m;
  const width = W * 0.36;
  const subtitle = scene.subtitle
    ? block(ctx, scene.fonts.body, fitText(scene.subtitle, { maxWidth: width, maxLines: 2, maxSize: 28, minSize: 20 }, measurer(ctx, scene.fonts.body)), 1.35)
    : null;
  const logoH = H * 0.24;
  const gap = H * 0.1;
  const total = logoH + (subtitle ? gap + blockHeight(subtitle) : 0);
  const top = (H - total) / 2;
  drawBrand(ctx, scene, 'full', S, { x: right - width, y: top, width, height: logoH }, 'right', T);
  if (subtitle) drawBlock(ctx, subtitle, right, top + logoH + gap, softText(T, S), 'right');
}

/** Telegram / Open Graph: text on the left, a brand-colored panel with the mark on the right. */
function openGraph(ctx: Ctx, scene: KitScene, f: ImageFormat) {
  const { width: W, height: H } = f;
  const S = scene.palette.background;
  const T = textOn(S, scene.palette);
  const P = contrastRatio(scene.palette.primary, S) >= 1.2 ? scene.palette.primary : mixHex(S, T, 0.12);
  ctx.fillStyle = S;
  ctx.fillRect(0, 0, W, H);
  const panelX = W * 0.66;
  ctx.fillStyle = P;
  ctx.fillRect(panelX, 0, W - panelX, H);
  const [d1] = shapeColors(P, scene.palette);
  disc(ctx, panelX, H * 0.76, H * 0.19, contrastRatio(d1, S) >= 1.2 ? d1 : mixHex(P, T, 0.3));
  const mark = logoFor(scene, 'mark', P, (l) => l.kind === 'mark');
  if (mark) {
    const r = alignRect(mark, { x: panelX + (W - panelX) * 0.3, y: H * 0.18, width: (W - panelX) * 0.4, height: H * 0.3 }, 'center');
    drawImageHQ(ctx, mark, r);
  }

  const m = 72;
  const hasLogo = scene.logos.length > 0;
  const statement = scene.subtitle || scene.headline;
  const showBrand = hasLogo || statement !== scene.name;
  const brand = showBrand ? drawBrand(ctx, scene, 'full', S, { x: m, y: m, width: W * 0.3, height: H * 0.085 }, 'left', T) : null;
  let floor = H - m;
  const website = displayUrl(scene.website);
  if (website) {
    const b = block(ctx, scene.fonts.caption, fitText(website, { maxWidth: W * 0.5, maxLines: 1, maxSize: 24, minSize: 18 }, measurer(ctx, scene.fonts.caption)), 1.2);
    drawBlock(ctx, b, m, H - m - b.cap, softText(T, S));
    floor = H - m - b.cap - 40;
  }
  const ceiling = brand ? brand.y + brand.height + 40 : m;
  const head = block(ctx, scene.fonts.heading, fitText(statement, { maxWidth: W * 0.48, maxLines: 4, maxSize: 60, minSize: 30 }, measurer(ctx, scene.fonts.heading)), 1.12);
  const top = Math.max(ceiling, ceiling + (floor - ceiling - blockHeight(head)) / 2);
  drawBlock(ctx, head, m, top, T);
}

const FAVICON_PADDING: Record<number, number> = { 32: 0.06, 180: 0.14, 192: 0.18, 512: 0.18 };

/** Mark (or a compact logo) padded on the background color; monogram otherwise. */
function favicon(ctx: Ctx, scene: KitScene, f: ImageFormat) {
  const N = f.width;
  const pad = Math.round(N * (FAVICON_PADDING[N] ?? 0.16));
  const compact = (l: LoadedLogo) => l.kind === 'mark' || l.width / l.height <= 2;
  let surface = scene.palette.background;
  let logo = logoFor(scene, 'mark', surface, compact);
  if (!logo) {
    surface = scene.palette.primary;
    logo = logoFor(scene, 'mark', surface, compact);
  }
  ctx.fillStyle = surface;
  ctx.fillRect(0, 0, N, N);
  if (logo) {
    const r = alignRect(logo, { x: pad, y: pad, width: N - 2 * pad, height: N - 2 * pad }, 'center');
    drawImageHQ(ctx, logo, r);
    return;
  }
  const face = scene.fonts.heading;
  const b = block(ctx, face, fitText(monogram(scene.name), { maxWidth: N - 2 * pad, maxLines: 1, maxSize: (N - 2 * pad) * 0.8, minSize: 8 }, measurer(ctx, face)), 1);
  drawBlock(ctx, b, N / 2, (N - b.cap) / 2, textOn(surface, scene.palette), 'center');
}

/** Primary logo presented on the primary color with generous space around it. */
function logoOnBrand(ctx: Ctx, scene: KitScene, f: ImageFormat) {
  const { width: W, height: H } = f;
  const S = scene.palette.primary;
  ctx.fillStyle = S;
  ctx.fillRect(0, 0, W, H);
  drawBrand(ctx, scene, 'full', S, { x: W * 0.2, y: H * 0.3, width: W * 0.6, height: H * 0.4 }, 'center', textOn(S, scene.palette));
}

const COMPOSITIONS: Record<ImageFormat['id'], (ctx: Ctx, scene: KitScene, f: ImageFormat) => void> = {
  avatar,
  post: (ctx, scene, f) => social(ctx, scene, f, false),
  story: (ctx, scene, f) => social(ctx, scene, f, true),
  youtube,
  linkedin,
  og: openGraph,
  favicon32: favicon,
  appleTouch: favicon,
  icon192: favicon,
  icon512: favicon,
  logoOnBrand,
};

export async function renderFormat(scene: KitScene, f: ImageFormat): Promise<Blob> {
  const { canvas, ctx } = createCanvas(f.width, f.height);
  COMPOSITIONS[f.id](ctx, scene, f);
  return toPng(canvas);
}

/** Transparent PNG of one logo variant with its long side at `longSide`. */
export async function renderLogo(logo: LoadedLogo, longSide: number): Promise<{ blob: Blob; width: number; height: number }> {
  const s = scaleToLongSide(logo, longSide);
  const { canvas, ctx } = createCanvas(s.width, s.height);
  drawImageHQ(ctx, logo, { x: 0, y: 0, ...s });
  return { blob: await toPng(canvas), ...s };
}
