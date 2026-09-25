import { describe, expect, it } from 'vitest';
import { softBreak } from './softBreak';

describe('softBreak', () => {
  it('leaves normal text alone', () => {
    const text = 'Брендбук фиксирует правила, по которым бренд узнают.';
    expect(softBreak(text)).toBe(text);
  });
  it('adds break opportunities to long URLs without changing visible text', () => {
    const url = 'https://example.com/brand/guidelines/very/long/path/that/should/not/overflow';
    const out = softBreak(url);
    expect(out).not.toBe(url);
    expect(out.replace(/​/g, '')).toBe(url);
    expect(out.split('​').every((part) => part.length <= 24)).toBe(true);
  });
  it('breaks long words with no punctuation into chunks', () => {
    const word = 'а'.repeat(60);
    expect(softBreak(word).split('​').every((p) => p.length <= 12)).toBe(true);
  });
});
