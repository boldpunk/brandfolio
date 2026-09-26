/** Supported languages. Kept free of React so the domain layer can import it. */
export const LOCALES = ['ru', 'uz', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_NAMES: Record<Locale, string> = { ru: 'Русский', uz: 'O‘zbekcha', en: 'English' };
/** BCP 47 tags for Intl formatting and the `lang` attribute. */
export const LOCALE_TAGS: Record<Locale, string> = { ru: 'ru', uz: 'uz-Latn', en: 'en' };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}
