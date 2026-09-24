/**
 * Download file names derived from the project title. Names are kept ASCII:
 * Chromium drops a non-ASCII `download` attribute and saves the file as
 * "download", so Cyrillic is transliterated and other symbols are removed.
 */
const RU: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
  р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  ў: 'o', ғ: 'g', қ: 'q', ҳ: 'h',
};

export function fileBaseName(title: string): string {
  const latin = [...title.normalize('NFC')]
    .map((ch) => {
      const lower = ch.toLowerCase();
      const mapped = RU[lower];
      if (mapped === undefined) return ch;
      return ch !== lower && mapped ? mapped[0]!.toUpperCase() + mapped.slice(1) : mapped;
    })
    .join('');
  return latin
    .normalize('NFKD')
    .replace(/[̀-ͯ‘’ʻʼ'`]/g, '')
    .replace(/[^A-Za-z0-9._ -]+/g, ' ')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

export function pdfFileName(title: string): string {
  return `${fileBaseName(title) || 'brandbook'}-brandbook.pdf`;
}

export function archiveFileName(title: string): string {
  return `${fileBaseName(title) || 'project'}.brandfolio.zip`;
}
