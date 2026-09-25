import { describe, expect, it } from 'vitest';
import { checkContrast, contrastRatio, formatRatio, hexToRgb, normalizeHex, rgbToHsl } from './color';

describe('normalizeHex', () => {
  it.each([
    ['#abc', '#AABBCC'],
    ['abc', '#AABBCC'],
    ['  #b65c3a ', '#B65C3A'],
    ['F3EFE7', '#F3EFE7'],
  ])('%s → %s', (input, expected) => expect(normalizeHex(input)).toBe(expected));

  it.each(['', '#12', '#12345', '#GGGGGG', '#1234567', 'red', '#abcd'])('rejects %j', (input) =>
    expect(normalizeHex(input)).toBeNull(),
  );
});

describe('conversions', () => {
  it('hex to rgb', () => expect(hexToRgb('#B65C3A')).toEqual({ r: 182, g: 92, b: 58 }));
  it('rgb to hsl', () => {
    const hsl = rgbToHsl({ r: 182, g: 92, b: 58 });
    expect(Math.round(hsl.h)).toBe(16);
    expect(Math.round(hsl.s)).toBe(52);
    expect(Math.round(hsl.l)).toBe(47);
  });
  it('gray has no hue', () => expect(rgbToHsl({ r: 128, g: 128, b: 128 }).s).toBe(0));
});

describe('contrast (A06)', () => {
  it('black on white is 21:1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 10);
    expect(checkContrast('#000000', '#FFFFFF').label).toBe('21:1');
  });
  it('identical colors are 1:1', () => {
    const r = checkContrast('#B65C3A', '#B65C3A');
    expect(r.ratio).toBe(1);
    expect(r.normalText).toBe(false);
    expect(r.largeText).toBe(false);
  });
  it('is symmetric', () => expect(contrastRatio('#242424', '#F3EFE7')).toBe(contrastRatio('#F3EFE7', '#242424')));

  it('decides on the exact ratio, not the rounded label', () => {
    // #777777 on white is 4.478…:1 — would display as 4.48 and must fail 4.5.
    const gray = checkContrast('#777777', '#FFFFFF');
    expect(gray.ratio).toBeGreaterThan(4.47);
    expect(gray.ratio).toBeLessThan(4.5);
    expect(gray.normalText).toBe(false);
    expect(gray.largeText).toBe(true);
    // #767676 on white is 4.54:1 and passes.
    expect(checkContrast('#767676', '#FFFFFF').normalText).toBe(true);
  });

  it('large text threshold is 3:1 exactly on the unrounded ratio', () => {
    // #959595 on white ≈ 2.998:1 → fails large text even though it rounds to 3.00.
    const r = checkContrast('#959595', '#FFFFFF');
    expect(r.ratio).toBeLessThan(3);
    expect(r.largeText).toBe(false);
    expect(checkContrast('#949494', '#FFFFFF').largeText).toBe(true);
  });

  it('display truncates instead of rounding up', () => {
    expect(formatRatio(4.4999)).toBe('4.49');
    expect(formatRatio(2.998)).toBe('2.99');
    expect(formatRatio(4.5)).toBe('4.5');
  });
});
