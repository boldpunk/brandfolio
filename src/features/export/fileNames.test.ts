import { describe, expect, it } from 'vitest';
import { archiveFileName, fileBaseName, pdfFileName } from './fileNames';

describe('file names', () => {
  it('transliterates Cyrillic and drops symbols', () => {
    expect(pdfFileName('FORMA — архитектурная студия')).toBe('FORMA-arkhitekturnaya-studiya-brandbook.pdf');
    expect(archiveFileName('Щука & Ёж')).toBe('Shchuka-Ezh.brandfolio.zip');
  });
  it('keeps Uzbek Latin readable', () => {
    expect(fileBaseName('O‘zbekiston Gʻijduvon')).toBe('Ozbekiston-Gijduvon');
    // ‘ (U+2018) and ’ (U+2019) are what the app itself writes in Uzbek.
    expect(pdfFileName('G‘ijduvon ma’lumot markazi')).toBe('Gijduvon-malumot-markazi-brandbook.pdf');
  });
  it('falls back when nothing is left', () => {
    expect(pdfFileName('★★★')).toBe('brandbook-brandbook.pdf');
    expect(archiveFileName('/../')).toBe('project.brandfolio.zip');
  });
});
