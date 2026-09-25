import { describe, expect, it } from 'vitest';
import { brandMessages } from '@/i18n/messages/brand';
import { mediakitMessages } from '@/i18n/messages/mediakit';
import { mediaKitFileName, groupOf } from './formats';
import { asePalette, colorSlugs, colorsCss, emailSignature, fileLabel, fontStack, gplPalette, readmeText, safeEmail, safeWebUrl, type SignatureInput } from './writers';

const colors = [
  { name: 'Слоновая кость', hex: '#F3EFE7' },
  { name: 'Терракота', hex: '#B65C3A' },
];
const roles = { background: '#F3EFE7', text: '#242424', primary: '#B65C3A', secondary: '#8C9A82', accent: '#B65C3A' };

describe('palettes', () => {
  it('writes ASCII CSS custom properties', () => {
    const css = colorsCss('FORMA */ x', colors, roles);
    expect(css).toContain('--brand-primary: #B65C3A;');
    expect(css).toContain('--color-slonovaya-kost: #F3EFE7; /* Слоновая кость */');
    expect(css).not.toContain('*/ x');
    expect(colorSlugs([{ name: 'A', hex: '#000000' }, { name: 'a', hex: '#111111' }, { name: '★', hex: '#222222' }])).toEqual(['a', 'a-2', 'color-3']);
  });

  it('writes a GIMP palette', () => {
    expect(gplPalette('FORMA', colors)).toBe('GIMP Palette\nName: FORMA\nColumns: 2\n#\n243 239 231\tСлоновая кость\n182  92  58\tТерракота\n');
  });

  it('writes Adobe Swatch Exchange bytes', () => {
    const bytes = asePalette('AB', [{ name: 'R', hex: '#FF0000' }]);
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(' ');
    expect(hex).toBe(
      [
        '41 53 45 46', // "ASEF"
        '00 01 00 00', // version 1.0
        '00 00 00 03', // 3 blocks
        'c0 01 00 00 00 08', // group start, 8 bytes
        '00 03 00 41 00 42 00 00', // name "AB\0" in UTF-16BE
        '00 01 00 00 00 18', // color entry, 24 bytes
        '00 02 00 52 00 00', // name "R\0"
        '52 47 42 20', // "RGB "
        '3f 80 00 00 00 00 00 00 00 00 00 00', // 1.0, 0.0, 0.0 float32 BE
        '00 02', // normal color
        'c0 02 00 00 00 00', // group end
      ].join(' '),
    );
    const view = new DataView(asePalette('FORMA', colors).buffer);
    expect(view.getUint32(8)).toBe(4);
    expect(bytes.byteLength).toBe(12 + 6 + 8 + 6 + 24 + 6);
  });

  it('encodes Cyrillic ASE names as UTF-16', () => {
    const bytes = asePalette('Б', []);
    expect([...bytes.slice(18, 24)]).toEqual([0x00, 0x02, 0x04, 0x11, 0x00, 0x00]);
  });
});

describe('email signature', () => {
  const base: SignatureInput = {
    lang: 'ru',
    brandName: 'FORMA',
    personName: 'Анна <Смирнова>',
    personRole: 'Архитектор',
    organization: 'FORMA',
    email: 'hello@example.com',
    website: 'example.com',
    logo: { src: 'logos/primary-1024.png', width: 160, height: 37 },
    colors: { text: '#242424', muted: '#7A7672', primary: '#B65C3A' },
    fonts: { heading: fontStack('Manrope', 'sans'), body: fontStack('Noto Serif', 'serif') },
    hostingComment: 'upload -- the logo',
  };

  it('is a table with inline styles, escaped text and safe links', () => {
    const html = emailSignature(base);
    expect(html).toContain('<table role="presentation"');
    expect(html).not.toContain('<style');
    expect(html).not.toContain('class=');
    expect(html).toContain('Анна &lt;Смирнова&gt;');
    expect(html).toContain('href="mailto:hello@example.com"');
    expect(html).toContain('href="https://example.com/"');
    expect(html).toContain('src="logos/primary-1024.png" width="160" height="37"');
    expect(html).toContain("font-family:'Noto Serif', Georgia");
    expect(html).toContain('<!-- upload — the logo -->');
  });

  it('drops links that are not web or email addresses and works without a logo', () => {
    const html = emailSignature({ ...base, email: 'nope', website: 'javascript:alert(1)', logo: null, personName: '' });
    expect(html).not.toContain('href=');
    expect(html).not.toContain('<img');
    expect(html).toContain('>FORMA<');
    expect(safeWebUrl('https://example.com/a')).toBe('https://example.com/a');
    expect(safeWebUrl('localhost')).toBeNull();
    expect(safeEmail('a@b.co')).toBe('a@b.co');
    expect(safeEmail('a@b')).toBeNull();
  });

  it('keeps link colors readable on white', () => {
    const html = emailSignature({ ...base, colors: { text: '#242424', muted: '#DDDDDD', primary: '#F5E050' } });
    expect(html).not.toContain('#F5E050;text-decoration');
    expect(html).not.toContain('color:#DDDDDD');
  });
});

describe('names and README', () => {
  it('names the ZIP in ASCII', () => {
    expect(mediaKitFileName({ title: 'FORMA — архитектурная студия' })).toBe('FORMA-arkhitekturnaya-studiya-media-kit.zip');
    expect(mediaKitFileName({ title: '★' })).toBe('brand-media-kit.zip');
  });

  it('labels files in the given language and groups them by folder', () => {
    const uz = mediakitMessages.uz.files;
    expect(fileLabel('social/avatar-1080.png', uz, brandMessages.uz.logoVariants)).toBe(uz.avatar);
    expect(fileLabel('logos/mark-1024.png', uz, brandMessages.uz.logoVariants)).toBe('«Belgi» logotip, shaffof fonda PNG');
    expect(fileLabel('logos/light.svg', mediakitMessages.en.files, brandMessages.en.logoVariants)).toContain('original file');
    expect(groupOf('favicon/icon-512.png')).toBe('favicons');
    expect(groupOf('README.txt')).toBe('other');
  });

  it('lists files with pixel sizes under their folders', () => {
    const text = readmeText('FORMA — медиакит', 'Создан: 2026-09-25', [
      { path: 'social/avatar-1080.png', width: 1080, height: 1080, label: 'Аватар' },
      { path: 'social/story-1080x1920.png', width: 1080, height: 1920, label: 'Сторис' },
      { path: 'README.txt', label: 'Этот файл' },
    ], 'Как использовать', ['Заметка']);
    expect(text).toBe(
      [
        'FORMA — медиакит',
        'Создан: 2026-09-25',
        '',
        'social/',
        '  avatar-1080.png      1080 × 1080  Аватар',
        '  story-1080x1920.png  1080 × 1920  Сторис',
        '',
        'README.txt                          Этот файл',
        '',
        'Как использовать',
        '- Заметка',
        '',
      ].join('\n'),
    );
  });
});
