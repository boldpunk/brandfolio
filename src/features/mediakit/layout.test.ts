import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@/domain/color';
import { alignRect, averageColor, displayUrl, fitContain, fitInCircle, fitText, monogram, pickReadable, scaleToLongSide, shapeColors, wrapText, type Measure } from './layout';

/** Monospace stand-in: every character is half the font size wide. */
const mono: Measure = (text, size) => [...text].length * size * 0.5;

describe('boxes', () => {
  it('contains without distortion', () => {
    expect(fitContain({ width: 416, height: 96 }, { width: 200, height: 200 })).toEqual({ width: 200, height: 200 / (416 / 96) });
    expect(fitContain({ width: 100, height: 400 }, { width: 200, height: 200 })).toEqual({ width: 50, height: 200 });
  });
  it('keeps every corner inside the crop circle', () => {
    for (const item of [{ width: 416, height: 96 }, { width: 96, height: 96 }, { width: 50, height: 300 }]) {
      const s = fitInCircle(item, 300);
      expect(Math.hypot(s.width / 2, s.height / 2)).toBeCloseTo(300, 6);
      expect(s.width / s.height).toBeCloseTo(item.width / item.height, 6);
    }
  });
  it('aligns inside a rect', () => {
    const rect = { x: 10, y: 20, width: 300, height: 100 };
    expect(alignRect({ width: 100, height: 100 }, rect, 'left')).toEqual({ x: 10, y: 20, width: 100, height: 100 });
    expect(alignRect({ width: 100, height: 100 }, rect, 'right').x).toBe(210);
    expect(alignRect({ width: 200, height: 50 }, rect, 'center')).toEqual({ x: 10, y: 32.5, width: 300, height: 75 });
  });
  it('scales the long side', () => {
    expect(scaleToLongSide({ width: 416, height: 96 }, 1024)).toEqual({ width: 1024, height: 236 });
    expect(scaleToLongSide({ width: 96, height: 192 }, 1024)).toEqual({ width: 512, height: 1024 });
  });
});

describe('text', () => {
  it('wraps words and keeps explicit breaks', () => {
    expect(wrapText('one two three four', 40, 10, mono)).toEqual(['one two', 'three', 'four']);
    expect(wrapText('a\nb', 1000, 10, mono)).toEqual(['a', 'b']);
  });
  it('splits a word longer than the line', () => {
    expect(wrapText('abcdefghij', 25, 10, mono)).toEqual(['abcde', 'fghij']);
  });
  it('picks the largest size that fits the line limit', () => {
    const fitted = fitText('Архитектура тишины', { maxWidth: 500, maxLines: 2, maxSize: 120, minSize: 40 }, mono);
    expect(fitted.lines.length).toBeLessThanOrEqual(2);
    expect(fitted.lines.every((l) => mono(l, fitted.size) <= 500)).toBe(true);
    // One size up would not fit.
    expect(wrapText('Архитектура тишины', 500, fitted.size + 3, mono).length).toBeGreaterThan(2);
  });
  it('truncates with an ellipsis at the minimum size', () => {
    const fitted = fitText('word '.repeat(50), { maxWidth: 100, maxLines: 2, maxSize: 20, minSize: 20 }, mono);
    expect(fitted.lines).toHaveLength(2);
    expect(fitted.lines[1]!.endsWith('…')).toBe(true);
    expect(mono(fitted.lines[1]!, 20)).toBeLessThanOrEqual(100);
  });
  it('makes monograms and readable URLs', () => {
    expect(monogram('Forma studio')).toBe('FS');
    expect(monogram('  forma ')).toBe('F');
    expect(monogram('«Ёлка» — дизайн')).toBe('ЁД');
    expect(monogram('')).toBe('·');
    expect(displayUrl('https://www.example.com/')).toBe('example.com');
    expect(displayUrl('example.com/uz')).toBe('example.com/uz');
  });
});

describe('color', () => {
  it('averages opaque pixels only', () => {
    const data = [255, 0, 0, 255, 0, 0, 255, 255, 0, 255, 0, 0];
    expect(averageColor(data)).toBe('#800080');
    expect(averageColor([0, 0, 0, 0])).toBeNull();
  });
  it('picks the first readable logo in brand order, else the best, else none', () => {
    const dark = { item: 'dark', tone: '#242424' };
    const light = { item: 'light', tone: '#F3EFE7' };
    expect(pickReadable([dark, light], '#FFFFFF')).toBe('dark');
    expect(pickReadable([dark, light], '#111111')).toBe('light');
    expect(pickReadable([{ item: 'same', tone: '#B65C3A' }], '#B65C3A')).toBeNull();
    expect(pickReadable([{ item: 'unknown', tone: null }], '#000000')).toBe('unknown');
  });
  it('gives two shape colors that stand apart from the surface', () => {
    const palette = { secondary: '#8C9A82', accent: '#B65C3A', primary: '#B65C3A', background: '#F3EFE7', text: '#242424' };
    expect(shapeColors('#F3EFE7', palette)).toEqual(['#8C9A82', '#B65C3A']);
    const mono2 = { secondary: '#FFFFFF', accent: '#FFFFFF', primary: '#FFFFFF', background: '#FFFFFF', text: '#1A1A1A' };
    const [a, b] = shapeColors('#FFFFFF', mono2);
    expect(contrastRatio(a, '#FFFFFF')).toBeGreaterThan(1.1);
    expect(a).not.toBe(b);
  });
});
