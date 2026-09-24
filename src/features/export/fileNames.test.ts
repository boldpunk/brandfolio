import { describe, expect, it } from 'vitest';
import { archiveFileName, fileBaseName, pdfFileName } from './fileNames';

describe('file names', () => {
  it('transliterates Cyrillic and drops symbols', () => {
    expect(pdfFileName('FORMA — архитектурная студия')).toBe('FORMA-arkhitekturnaya-studiya-brandbook.pdf');
    expect(archiveFileName('Щука & Ёж')).toBe('Shchuka-Ezh.brandfolio.zip');
  });
  it('keeps Uzbek Latin readable', () => {
    expect(fileBaseName('O‘zbekiston Gʻijduvon')).toBe('Ozbekiston-Gijduvon');
  });
  it('falls back when nothing is left', () => {
    expect(pdfFileName('★★★')).toBe('brandbook-brandbook.pdf');
    expect(archiveFileName('/../')).toBe('project.brandfolio.zip');
  });
});
