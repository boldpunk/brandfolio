/**
 * Original artwork for the fictional demo brand FORMA (architecture studio).
 * Drawn for this project; no stock material. Logos contain only shapes so the
 * SVG sanitizer keeps them intact.
 */

const GRAPHITE = '#242424';
const IVORY = '#F3EFE7';
const TERRACOTTA = '#B65C3A';
const SAGE = '#8C9A82';

function mark(bg: string) {
  return `<rect x="0" y="0" width="96" height="96" fill="${bg}"/>
  <path d="M20 76 V36 A40 40 0 0 1 60 76 Z" fill="${TERRACOTTA}"/>
  <rect x="66" y="20" width="10" height="56" fill="${SAGE}"/>`;
}

function word(color: string) {
  return `<g fill="none" stroke="${color}" stroke-width="12" stroke-linejoin="miter">
    <path d="M130 76 V26 H164 M130 50 H158"/>
    <circle cx="204" cy="48" r="26"/>
    <path d="M250 76 V26 H266 A13 13 0 0 1 266 52 H250 M262 52 L282 76"/>
    <path d="M300 76 V26 L322 58 L344 26 V76"/>
    <path d="M362 78 L384 22 L406 78 M371 58 H397"/>
  </g>`;
}

export const FORMA_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 416 96" width="416" height="96">${mark(GRAPHITE)}${word(GRAPHITE)}</svg>`;
export const FORMA_LOGO_LIGHT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 416 96" width="416" height="96">${mark('#3A3A3A')}${word(IVORY)}</svg>`;
export const FORMA_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">${mark(GRAPHITE)}</svg>`;

/** Three abstract compositions standing in for photography (rasterized to PNG). */
export const FORMA_COMPOSITIONS: { name: string; caption: string; focalX: number; focalY: number; svg: string }[] = [
  {
    name: 'svet-i-ten.png',
    caption: 'Свет и тень: мягкий боковой свет, длинные тени, тёплый тон',
    focalX: 62,
    focalY: 40,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="1600" height="1200">
      <rect width="800" height="600" fill="${IVORY}"/>
      <circle cx="560" cy="170" r="92" fill="${TERRACOTTA}"/>
      <polygon points="0,600 0,390 300,250 300,600" fill="#D9D1C3"/>
      <polygon points="300,250 520,330 520,600 300,600" fill="#C9BFAE"/>
      <polygon points="520,330 800,420 800,600 520,600" fill="${GRAPHITE}" opacity="0.88"/>
      <polygon points="300,250 520,330 800,420 800,440 520,350 300,270" fill="${GRAPHITE}" opacity="0.25"/>
      <rect x="120" y="120" width="8" height="300" fill="${GRAPHITE}" opacity="0.6"/>
    </svg>`,
  },
  {
    name: 'material.png',
    caption: 'Материал: ритм арок и фактура, без лишних деталей',
    focalX: 50,
    focalY: 55,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="1600" height="1200">
      <rect width="800" height="600" fill="${TERRACOTTA}"/>
      ${[0, 1, 2, 3, 4]
        .map((i) => `<path d="M${40 + i * 150} 600 V300 A60 60 0 0 1 ${160 + i * 150} 300 V600 Z" fill="${i % 2 ? '#9E4E30' : '#C8714F'}"/>`)
        .join('')}
      <rect x="0" y="0" width="800" height="120" fill="${IVORY}" opacity="0.18"/>
      <rect x="0" y="560" width="800" height="40" fill="${GRAPHITE}" opacity="0.5"/>
    </svg>`,
  },
  {
    name: 'prostranstvo.png',
    caption: 'Пространство: чистая перспектива, много воздуха, один акцент',
    focalX: 45,
    focalY: 60,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="1600" height="1200">
      <rect width="800" height="600" fill="${SAGE}"/>
      <polygon points="0,600 360,300 440,300 800,600" fill="#A7B39E"/>
      <polygon points="0,0 360,300 360,0" fill="#7E8C74"/>
      <polygon points="800,0 440,300 440,0" fill="#96A38C"/>
      <rect x="360" y="0" width="80" height="300" fill="${IVORY}" opacity="0.9"/>
      <rect x="386" y="190" width="28" height="110" fill="${GRAPHITE}"/>
      <circle cx="400" cy="176" r="12" fill="${TERRACOTTA}"/>
    </svg>`,
  },
];
