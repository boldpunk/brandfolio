// Renders the social preview image and app icons into public/ with the
// preinstalled Chromium: node scripts/build-social.mjs
// (PW_CHROMIUM=/path/to/chromium when Playwright's own browser is not installed).
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const pub = new URL('../public/', import.meta.url);
const dataUrl = (file, type) => `data:${type};base64,${readFileSync(new URL(file, pub)).toString('base64')}`;
const font = dataUrl('fonts/Manrope-700.ttf', 'font/ttf');
const cover = dataUrl('examples/editorial-p1.jpg', 'image/jpeg');
const colors = dataUrl('examples/editorial-p5.jpg', 'image/jpeg');
const studio = dataUrl('examples/studio-p1.jpg', 'image/jpeg');

const mark = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 22 22"><rect x="1" y="1" width="20" height="20" rx="3" fill="#191919"/><path d="M6 6h7l3 3v7H6z" fill="#F4F2ED"/><path d="M13 6v3h3" fill="#B8F16C"/></svg>`;

const og = `<!doctype html><html><head><style>
@font-face { font-family: M; src: url(${font}); font-weight: 700; }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; background: #f4f2ed; font-family: M; color: #191919; display: flex; overflow: hidden; }
.text { width: 560px; padding: 72px 0 72px 72px; display: flex; flex-direction: column; }
.brand { display: flex; align-items: center; gap: 14px; font-size: 30px; letter-spacing: -0.02em; }
h1 { margin-top: auto; font-size: 64px; line-height: 1.04; letter-spacing: -0.035em; }
.chips { margin-top: 32px; display: flex; gap: 10px; }
.chips span { background: #b8f16c; border-radius: 8px; padding: 10px 16px; font-size: 22px; }
.desk { position: relative; flex: 1; background: #e7e4dc; margin: 40px 40px 40px 0; border-radius: 16px; overflow: hidden; }
.desk img { position: absolute; width: 230px; border-radius: 3px; box-shadow: 0 2px 4px rgb(0 0 0 / .08), 0 18px 40px rgb(0 0 0 / .16); }
</style></head><body>
<div class="text"><div class="brand">${mark(44)}Brandfolio</div>
<h1>Брендбук за вечер. В PDF.</h1>
<div class="chips"><span>RU</span><span>O‘Z</span><span>EN</span></div></div>
<div class="desk">
<img src="${studio}" style="left: 36px; top: 70px; transform: rotate(-6deg)">
<img src="${cover}" style="left: 200px; top: 40px; transform: rotate(-1deg)">
<img src="${colors}" style="left: 360px; top: 90px; transform: rotate(5deg)">
</div></body></html>`;

const icon = (size, pad) => `<!doctype html><html><body style="margin:0;width:${size}px;height:${size}px;background:#f4f2ed;display:grid;place-items:center">${mark(size - pad * 2)}</body></html>`;

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const shot = async (html, width, height, file) => {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: new URL(file, pub).pathname, type: file.endsWith('.jpg') ? 'jpeg' : 'png', quality: file.endsWith('.jpg') ? 88 : undefined });
  await page.close();
};
await shot(og, 1200, 630, 'og-image.jpg');
await shot(icon(180, 18), 180, 180, 'apple-touch-icon.png');
await shot(icon(192, 20), 192, 192, 'icon-192.png');
await shot(icon(512, 52), 512, 512, 'icon-512.png');
await browser.close();
console.log('public/og-image.jpg, apple-touch-icon.png, icon-192.png, icon-512.png');
