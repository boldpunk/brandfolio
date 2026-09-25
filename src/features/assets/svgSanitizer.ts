/**
 * SVG security boundary.
 *
 * User SVG is parsed with DOMParser and rebuilt element by element into a new
 * document from an allowlist. Nothing from the original is copied wholesale,
 * the result is only ever shown through <img src="blob:"> and never through
 * innerHTML. Anything that could execute, fetch or embed external content is
 * refused; editor metadata (Inkscape, Illustrator) is dropped.
 *
 * When the file relies on features outside the supported set (text, filters,
 * embedded bitmaps, CSS) we refuse instead of silently changing the drawing and
 * suggest exporting a PNG.
 */
import { ASSET_LIMITS } from '@/domain/limits';
import { msg } from '@/i18n/core';
import { assetsMessages } from '@/i18n/messages/assets';

type SvgMessages = (typeof assetsMessages)['ru']['svg'];

/** Refusal texts in the interface language, read at call time. */
const text = (): SvgMessages => msg(assetsMessages).svg;

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

const ALLOWED_ELEMENTS = new Set([
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'defs',
  'linearGradient',
  'radialGradient',
  'stop',
  'clipPath',
  'mask',
  'use',
  'symbol',
  'title',
  'desc',
]);

/** Elements removed without changing how the logo looks. */
const DROPPED_ELEMENTS = new Set(['metadata', 'script', 'sodipodi:namedview', 'namedview']);

/** Elements that change the drawing but are outside the supported set. */
const UNSUPPORTED_EXPLANATIONS: Record<string, keyof SvgMessages['features']> = {
  text: 'text',
  tspan: 'text',
  textPath: 'text',
  image: 'image',
  foreignObject: 'foreignObject',
  style: 'style',
  filter: 'filter',
  pattern: 'pattern',
  marker: 'marker',
  animate: 'animation',
  animateTransform: 'animation',
  animateMotion: 'animation',
  set: 'animation',
  iframe: 'iframe',
  a: 'links',
};

const GEOMETRY_ATTRS = [
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'fx', 'fy', 'fr',
  'width', 'height', 'd', 'points', 'transform', 'pathLength',
];
const PAINT_ATTRS = [
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap',
  'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'opacity',
  'clip-path', 'clip-rule', 'mask', 'color', 'display', 'visibility', 'shape-rendering',
  'vector-effect', 'paint-order', 'mix-blend-mode', 'isolation',
];
const STRUCTURE_ATTRS = [
  'id', 'viewBox', 'preserveAspectRatio', 'version',
  'gradientUnits', 'gradientTransform', 'spreadMethod', 'offset', 'stop-color', 'stop-opacity',
  'clipPathUnits', 'maskUnits', 'maskContentUnits', 'href', 'xlink:href', 'style',
];
const ALLOWED_ATTRS = new Set([...GEOMETRY_ATTRS, ...PAINT_ATTRS, ...STRUCTURE_ATTRS]);

/** Presentation properties allowed inside a style="" attribute. */
const ALLOWED_STYLE_PROPS = new Set(PAINT_ATTRS.concat(['stop-color', 'stop-opacity']));

export type SanitizeResult =
  | { ok: true; svg: string; width: number; height: number; removed: string[] }
  | { ok: false; reason: string };

class Refusal extends Error {}

export function sanitizeSvg(source: string): SanitizeResult {
  try {
    return { ok: true, ...sanitizeOrThrow(source) };
  } catch (error) {
    if (error instanceof Refusal) return { ok: false, reason: error.message };
    return { ok: false, reason: text().unreadable };
  }
}

function sanitizeOrThrow(source: string) {
  const byteSize = new TextEncoder().encode(source).length;
  if (byteSize > ASSET_LIMITS.svgMaxBytes) {
    throw new Refusal(text().tooBig);
  }
  // DOCTYPE can declare entities (billion laughs, external entities). Refuse before parsing.
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) {
    throw new Refusal(text().doctype);
  }

  const parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
  const root = parsed.documentElement;
  if (parsed.getElementsByTagName('parsererror').length > 0 || root.localName !== 'svg' || root.namespaceURI !== SVG_NS) {
    throw new Refusal(text().notSvg);
  }

  const t = text();
  const unsupported = new Set<string>();
  const removed = new Set<string>();
  const ids = new Set<string>();
  let elementCount = 0;

  const out = document.implementation.createDocument(SVG_NS, 'svg', null);
  const outRoot = out.documentElement;

  const copyElement = (src: Element, dst: Element, depth: number) => {
    if (depth > ASSET_LIMITS.svgMaxDepth) throw new Refusal(t.tooDeep);
    copyAttributes(src, dst);
    for (const child of Array.from(src.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        // Text content matters only inside <title>/<desc>; whitespace elsewhere is noise.
        if (dst.localName === 'title' || dst.localName === 'desc') dst.appendChild(out.createTextNode(child.textContent ?? ''));
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue; // comments, CDATA, processing instructions
      const el = child as Element;
      if (++elementCount > ASSET_LIMITS.svgMaxElements) {
        throw new Refusal(t.tooManyElements(ASSET_LIMITS.svgMaxElements));
      }
      const name = el.namespaceURI === SVG_NS ? el.localName : el.nodeName;
      if (el.namespaceURI !== SVG_NS || DROPPED_ELEMENTS.has(name)) {
        removed.add(name);
        continue;
      }
      if (!ALLOWED_ELEMENTS.has(name)) {
        const feature = UNSUPPORTED_EXPLANATIONS[name];
        unsupported.add(feature ? t.features[feature] : t.element(name));
        continue;
      }
      const copy = out.createElementNS(SVG_NS, name);
      dst.appendChild(copy);
      copyElement(el, copy, depth + 1);
    }
  };

  const copyAttributes = (src: Element, dst: Element) => {
    for (const attr of Array.from(src.attributes)) {
      const name = attr.name;
      const value = attr.value;
      if (/^on/i.test(attr.localName)) {
        removed.add(t.handler(attr.localName));
        continue;
      }
      if (name.startsWith('xmlns')) continue;
      if (!ALLOWED_ATTRS.has(name)) {
        removed.add(t.attribute(name));
        continue;
      }
      if (name === 'href' || name === 'xlink:href') {
        if (!/^#[A-Za-z_][\w.-]*$/.test(value)) throw new Refusal(t.externalRefs);
        dst.setAttributeNS(XLINK_NS, 'xlink:href', value);
        dst.setAttribute('href', value);
        continue;
      }
      if (name === 'style') {
        const style = sanitizeStyle(value);
        if (style) dst.setAttribute('style', style);
        continue;
      }
      checkUrlReferences(value);
      if (name === 'id') {
        if (!/^[A-Za-z_][\w.-]{0,127}$/.test(value)) continue;
        ids.add(value);
      }
      dst.setAttribute(name, value);
    }
  };

  const sanitizeStyle = (style: string): string => {
    const kept: string[] = [];
    for (const declaration of style.split(';')) {
      const index = declaration.indexOf(':');
      if (index < 0) continue;
      const prop = declaration.slice(0, index).trim().toLowerCase();
      const value = declaration.slice(index + 1).trim();
      if (!prop || !value) continue;
      if (/[\\@<>]|expression\s*\(|image-set|-moz-binding/i.test(value)) {
        throw new Refusal(t.unsafeCss);
      }
      checkUrlReferences(value);
      if (!ALLOWED_STYLE_PROPS.has(prop)) {
        if (prop.startsWith('font') || prop === 'filter') unsupported.add(prop === 'filter' ? t.features.filter : t.features.textStyles);
        continue;
      }
      kept.push(`${prop}:${value}`);
    }
    return kept.join(';');
  };

  copyElement(root, outRoot, 0);

  if (unsupported.size > 0) {
    throw new Refusal(t.unsupported([...unsupported].join(', ')));
  }

  // Internal url(#id) references must point to elements that survived.
  const serialized = new XMLSerializer().serializeToString(out);
  for (const match of serialized.matchAll(/url\(\s*['"]?#([^)'"\s]+)['"]?\s*\)|href="#([^"]+)"/g)) {
    const id = match[1] ?? match[2];
    if (id && !ids.has(id)) throw new Refusal(t.missingRefs);
  }

  const { width, height } = intrinsicSize(outRoot);
  if (!outRoot.hasAttribute('viewBox')) outRoot.setAttribute('viewBox', `0 0 ${width} ${height}`);
  outRoot.setAttribute('width', String(width));
  outRoot.setAttribute('height', String(height));

  return { svg: new XMLSerializer().serializeToString(out), width, height, removed: [...removed] };
}

/** Only fragment references like url(#gradient) are allowed; anything else can fetch. */
function checkUrlReferences(value: string) {
  const urls = value.match(/url\s*\(([^)]*)\)/gi) ?? [];
  for (const url of urls) {
    if (!/^url\(\s*['"]?#[A-Za-z_][\w.-]*['"]?\s*\)$/i.test(url)) {
      throw new Refusal(text().externalUrl);
    }
  }
}

function intrinsicSize(svg: Element): { width: number; height: number } {
  const viewBox = svg.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
  const vbWidth = viewBox?.length === 4 ? viewBox[2] : undefined;
  const vbHeight = viewBox?.length === 4 ? viewBox[3] : undefined;
  const width = parseLength(svg.getAttribute('width')) ?? vbWidth;
  const height = parseLength(svg.getAttribute('height')) ?? vbHeight;
  if (!width || !height || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Refusal(text().noSize);
  }
  if (width * height > ASSET_LIMITS.maxPixels) throw new Refusal(text().tooManyPixels);
  return { width: Math.round(width * 100) / 100, height: Math.round(height * 100) / 100 };
}

function parseLength(value: string | null): number | undefined {
  if (!value) return undefined;
  const match = /^\s*([\d.]+)\s*(px)?\s*$/.exec(value);
  return match ? Number(match[1]) : undefined;
}
