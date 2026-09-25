/**
 * PDF and archive export, archive import. The archive README is written in the
 * project's document language; everything else follows the interface.
 */
import { defineMessages, plural, type Locale } from '../core';

const forms = (locale: Locale) => (n: number, f: Parameters<typeof plural>[2]) => plural(locale, n, f);
const ru = forms('ru');
const en = forms('en');

export const exportMessages = defineMessages({
  ru: {
    dialog: {
      title: 'Экспорт',
      description: 'PDF собирается в браузере из текущего состояния проекта. Файлы никуда не отправляются.',
      pdfHeading: 'Брендбук PDF',
      preparing: 'Подготовка: загружаем шрифты и изображения…',
      generating: 'Генерация PDF…',
      ready: (pages: number | null, kb: number, time: string) => `Готово: ${pages ?? '?'} стр., ${kb} КБ. Снимок проекта от ${time}.`,
      failed: (message: string) => `Не удалось создать PDF: ${message}`,
      unsavedNote: 'PDF отражает то, что сейчас открыто в редакторе, включая ещё не сохранённые правки.',
      skipped: (list: string) => `Пустые разделы не попали в PDF: ${list}.`,
      stale: 'После создания PDF в проекте были изменения. Этот файл их не содержит — обновите PDF, если они нужны.',
      previewTitle: 'Предпросмотр PDF',
      downloadPdf: 'Скачать PDF',
      openPdf: 'Открыть PDF отдельно',
      retry: 'Повторить',
      refreshPdf: 'Обновить PDF',
      previewNote:
        'Предпросмотр выше — это тот же файл, что будет скачан. HTML-вид в редакторе близок к нему, но переносы строк и разбивка на страницы могут отличаться.',
      zipHeading: 'Архив проекта',
      zipTextBefore: 'Файл ',
      zipTextAfter: ' содержит проект, логотипы, изображения и токены (JSON и CSS). Его можно импортировать в другом браузере или хранить как резервную копию.',
      zipBusy: 'Собираем архив…',
      downloadZip: 'Скачать архив',
    },
    pdf: {
      missingFiles: (list: string) => `Не найдены файлы: ${list}. Загрузите их заново в редакторе.`,
      image: (n: number) => `изображение ${n}`,
    },
    readme: (title: string, date: string, schemaVersion: number) => `Brandfolio — архив проекта «${title}»
Создан: ${date}

Содержимое
  project.json  документ проекта и список файлов (schemaVersion ${schemaVersion})
  assets/       логотипы и изображения
  tokens.json   цвета и типографика в JSON
  tokens.css    те же токены как CSS custom properties

Как восстановить
  Откройте Brandfolio → «Проекты» → «Импорт архива» и выберите этот файл.
  Проект будет создан как новый; существующие проекты не изменятся.

Шрифты Manrope, Noto Sans и Noto Serif распространяются по SIL Open Font License 1.1.
`,
    import: {
      archiveTooBig: 'Архив больше 40 МиБ.',
      notZip: 'Файл не является ZIP-архивом.',
      tooManyFiles: (n: number) => `В архиве больше ${ru(n, { one: '# файла', few: '# файлов', many: '# файлов', other: '# файла' })}.`,
      badPath: (name: string) => `Недопустимый путь в архиве: ${name}`,
      unexpectedFile: (name: string) => `В архиве неожиданный файл: ${name}. Импортируются только архивы Brandfolio.`,
      duplicateFile: (name: string) => `Файл повторяется в архиве: ${name}`,
      fileTooBig: (name: string) => `Файл ${name} слишком большой.`,
      corrupted: (detail: string) => `Архив повреждён: ${detail}`,
      fileTooBigUnpacked: (name: string) => `Файл ${name} слишком большой после распаковки.`,
      unpackedTooBig: 'Распакованный архив больше 100 МиБ.',
      nestedArchive: (name: string) => `Вложенные архивы не поддерживаются: ${name}`,
      unsupportedCompression: (name: string) => `Неподдерживаемый способ сжатия: ${name}`,
      empty: 'Архив пустой.',
      noProjectJson: 'В архиве нет project.json.',
      projectJsonBroken: 'project.json повреждён или не в UTF-8.',
      newerSchema: (found: number, supported: number) =>
        `Архив создан более новой версией Brandfolio (схема ${found}, поддерживается до ${supported}). Обновите приложение.`,
      badStructure: (detail: string) => `Неверная структура project.json: ${detail}`.trim(),
      projectInvalid: (issue: string) => `Проект в архиве не прошёл проверку${issue ? `: ${issue}` : ''}.`,
      duplicateManifest: 'Список файлов в project.json содержит повторы.',
      noManifestEntry: (id: string) => `В описании архива нет файла для ассета ${id}.`,
      missingFile: (path: string) => `В архиве отсутствует файл ${path}.`,
      checksum: (path: string) => `Файл ${path} повреждён: контрольная сумма не совпадает.`,
      assetFile: (filename: string, error: string) => `Файл ${filename}: ${error}`,
      typeMismatch: (filename: string) => `Тип файла ${filename} не совпадает с описанием.`,
    },
  },
  uz: {
    dialog: {
      title: 'Eksport',
      description: 'PDF brauzerning o‘zida loyihaning joriy holatidan yig‘iladi. Fayllar hech qayerga yuborilmaydi.',
      pdfHeading: 'PDF brendbuk',
      preparing: 'Tayyorlanmoqda: shriftlar va tasvirlar yuklanmoqda…',
      generating: 'PDF yaratilmoqda…',
      ready: (pages: number | null, kb: number, time: string) => `Tayyor: ${pages ?? '?'} bet, ${kb} KB. Loyihaning ${time} dagi holati.`,
      failed: (message: string) => `PDF yaratib bo‘lmadi: ${message}`,
      unsavedNote: 'PDF’da hozir tahrirlovchida ochiq bo‘lgan holat, jumladan hali saqlanmagan o‘zgarishlar ham aks etadi.',
      skipped: (list: string) => `Bo‘sh bo‘limlar PDF’ga kirmadi: ${list}.`,
      stale: 'PDF yaratilgandan keyin loyihada o‘zgarishlar bo‘ldi. Bu fayl ularni o‘z ichiga olmaydi — kerak bo‘lsa, PDF’ni yangilang.',
      previewTitle: 'PDF’ni oldindan ko‘rish',
      downloadPdf: 'PDF’ni yuklab olish',
      openPdf: 'PDF’ni alohida ochish',
      retry: 'Qayta urinish',
      refreshPdf: 'PDF’ni yangilash',
      previewNote:
        'Yuqoridagi ko‘rinish — aynan yuklab olinadigan fayl. Tahrirlovchidagi HTML ko‘rinish unga yaqin, lekin qatorlar ko‘chishi va sahifalarga bo‘linishi farq qilishi mumkin.',
      zipHeading: 'Loyiha arxivi',
      zipTextBefore: '',
      zipTextAfter:
        ' faylida loyiha, logotiplar, tasvirlar va tokenlar (JSON va CSS) bor. Uni boshqa brauzerga import qilish yoki zaxira nusxa sifatida saqlab qo‘yish mumkin.',
      zipBusy: 'Arxiv yig‘ilmoqda…',
      downloadZip: 'Arxivni yuklab olish',
    },
    pdf: {
      missingFiles: (list: string) => `Fayllar topilmadi: ${list}. Ularni tahrirlovchida qayta yuklang.`,
      image: (n: number) => `${n}-tasvir`,
    },
    readme: (title: string, date: string, schemaVersion: number) => `Brandfolio — «${title}» loyihasi arxivi
Yaratilgan sana: ${date}

Tarkibi
  project.json  loyiha hujjati va fayllar ro‘yxati (schemaVersion ${schemaVersion})
  assets/       logotiplar va tasvirlar
  tokens.json   ranglar va tipografika JSON formatida
  tokens.css    o‘sha tokenlar CSS custom properties ko‘rinishida

Qanday tiklash mumkin
  Brandfolio’ni oching → «Loyihalar» → «Arxivni import qilish» va shu faylni tanlang.
  Loyiha yangi loyiha sifatida yaratiladi; mavjud loyihalar o‘zgarmaydi.

Manrope, Noto Sans va Noto Serif shriftlari SIL Open Font License 1.1 litsenziyasi asosida tarqatiladi.
`,
    import: {
      archiveTooBig: 'Arxiv 40 MiB dan katta.',
      notZip: 'Fayl ZIP arxiv emas.',
      tooManyFiles: (n: number) => `Arxivda ${n} tadan ortiq fayl bor.`,
      badPath: (name: string) => `Arxivda ruxsat etilmagan yo‘l: ${name}`,
      unexpectedFile: (name: string) => `Arxivda kutilmagan fayl bor: ${name}. Faqat Brandfolio arxivlarini import qilish mumkin.`,
      duplicateFile: (name: string) => `Arxivda fayl takrorlangan: ${name}`,
      fileTooBig: (name: string) => `${name} fayli juda katta.`,
      corrupted: (detail: string) => `Arxiv buzilgan: ${detail}`,
      fileTooBigUnpacked: (name: string) => `${name} fayli ochilgandan keyin juda katta.`,
      unpackedTooBig: 'Ochilgan arxiv 100 MiB dan katta.',
      nestedArchive: (name: string) => `Arxiv ichidagi arxivlar qo‘llab-quvvatlanmaydi: ${name}`,
      unsupportedCompression: (name: string) => `Siqish usuli qo‘llab-quvvatlanmaydi: ${name}`,
      empty: 'Arxiv bo‘sh.',
      noProjectJson: 'Arxivda project.json yo‘q.',
      projectJsonBroken: 'project.json buzilgan yoki UTF-8 kodlashida emas.',
      newerSchema: (found: number, supported: number) =>
        `Arxiv Brandfolio’ning yangiroq versiyasida yaratilgan (sxema ${found}, ${supported} gacha qo‘llab-quvvatlanadi). Ilovani yangilang.`,
      badStructure: (detail: string) => `project.json tuzilishi noto‘g‘ri: ${detail}`.trim(),
      projectInvalid: (issue: string) => `Arxivdagi loyiha tekshiruvdan o‘tmadi${issue ? `: ${issue}` : ''}.`,
      duplicateManifest: 'project.json’dagi fayllar ro‘yxatida takrorlar bor.',
      noManifestEntry: (id: string) => `Arxiv tavsifida ${id} asseti uchun fayl yo‘q.`,
      missingFile: (path: string) => `Arxivda ${path} fayli yo‘q.`,
      checksum: (path: string) => `${path} fayli buzilgan: nazorat summasi mos kelmadi.`,
      assetFile: (filename: string, error: string) => `${filename} fayli: ${error}`,
      typeMismatch: (filename: string) => `${filename} fayli turi tavsifdagiga mos emas.`,
    },
  },
  en: {
    dialog: {
      title: 'Export',
      description: 'The PDF is built in your browser from the current state of the project. No files are sent anywhere.',
      pdfHeading: 'PDF brand book',
      preparing: 'Preparing: loading fonts and images…',
      generating: 'Generating PDF…',
      ready: (pages: number | null, kb: number, time: string) =>
        `Ready: ${pages === null ? '? pages' : en(pages, { one: '# page', other: '# pages' })}, ${kb} KB. Project snapshot from ${time}.`,
      failed: (message: string) => `Could not create the PDF: ${message}`,
      unsavedNote: 'The PDF reflects what is open in the editor right now, including changes that are not saved yet.',
      skipped: (list: string) => `Empty sections were left out of the PDF: ${list}.`,
      stale: 'The project changed after the PDF was created. This file does not include those changes, so refresh the PDF if you need them.',
      previewTitle: 'PDF preview',
      downloadPdf: 'Download PDF',
      openPdf: 'Open PDF separately',
      retry: 'Try again',
      refreshPdf: 'Refresh PDF',
      previewNote:
        'The preview above is the same file that will be downloaded. The HTML view in the editor is close to it, but line breaks and page breaks may differ.',
      zipHeading: 'Project archive',
      zipTextBefore: 'The ',
      zipTextAfter: ' file contains the project, logos, images and tokens (JSON and CSS). You can import it in another browser or keep it as a backup.',
      zipBusy: 'Building archive…',
      downloadZip: 'Download archive',
    },
    pdf: {
      missingFiles: (list: string) => `Files not found: ${list}. Upload them again in the editor.`,
      image: (n: number) => `image ${n}`,
    },
    readme: (title: string, date: string, schemaVersion: number) => `Brandfolio — project archive “${title}”
Created: ${date}

Contents
  project.json  project document and file list (schemaVersion ${schemaVersion})
  assets/       logos and images
  tokens.json   colors and typography as JSON
  tokens.css    the same tokens as CSS custom properties

How to restore
  Open Brandfolio → “Projects” → “Import archive” and choose this file.
  The project is created as a new one; existing projects stay unchanged.

The Manrope, Noto Sans and Noto Serif fonts are distributed under the SIL Open Font License 1.1.
`,
    import: {
      archiveTooBig: 'The archive is larger than 40 MiB.',
      notZip: 'The file is not a ZIP archive.',
      tooManyFiles: (n: number) => `The archive has more than ${n} files.`,
      badPath: (name: string) => `Invalid path in the archive: ${name}`,
      unexpectedFile: (name: string) => `Unexpected file in the archive: ${name}. Only Brandfolio archives can be imported.`,
      duplicateFile: (name: string) => `A file appears twice in the archive: ${name}`,
      fileTooBig: (name: string) => `The file ${name} is too large.`,
      corrupted: (detail: string) => `The archive is damaged: ${detail}`,
      fileTooBigUnpacked: (name: string) => `The file ${name} is too large once unpacked.`,
      unpackedTooBig: 'The unpacked archive is larger than 100 MiB.',
      nestedArchive: (name: string) => `Nested archives are not supported: ${name}`,
      unsupportedCompression: (name: string) => `Unsupported compression method: ${name}`,
      empty: 'The archive is empty.',
      noProjectJson: 'The archive has no project.json.',
      projectJsonBroken: 'project.json is damaged or not UTF-8.',
      newerSchema: (found: number, supported: number) =>
        `The archive was made by a newer version of Brandfolio (schema ${found}, up to ${supported} is supported). Update the app.`,
      badStructure: (detail: string) => `Invalid project.json structure: ${detail}`.trim(),
      projectInvalid: (issue: string) => `The project in the archive failed validation${issue ? `: ${issue}` : ''}.`,
      duplicateManifest: 'The file list in project.json has duplicates.',
      noManifestEntry: (id: string) => `The archive description has no file for asset ${id}.`,
      missingFile: (path: string) => `The file ${path} is missing from the archive.`,
      checksum: (path: string) => `The file ${path} is damaged: the checksum does not match.`,
      assetFile: (filename: string, error: string) => `File ${filename}: ${error}`,
      typeMismatch: (filename: string) => `The type of ${filename} does not match the description.`,
    },
  },
});
