/**
 * Interface and document languages.
 *
 * Messages live in `messages/<namespace>.ts`, one object per language. Russian
 * is the source: `defineMessages` infers the shape from it and requires Uzbek
 * and English to provide the same keys with the same signatures, so a missing
 * translation is a type error, not a blank label. A value is a string or a
 * function of parameters (for numbers, names and plurals).
 *
 * Uzbek is written in Latin script with ‘ (U+2018) for o‘ and g‘ and ’
 * (U+2019) for the tutuq belgisi: Manrope has no ʻ (U+02BB) or ʼ (U+02BC).
 */
import { useSyncExternalStore } from 'react';
import { isLocale, LOCALE_TAGS, type Locale } from './locales';

export { isLocale, LOCALE_NAMES, LOCALE_TAGS, LOCALES, type Locale } from './locales';

export type Messages<T> = { ru: T; uz: NoInfer<T>; en: NoInfer<T> };

export function defineMessages<T extends Record<string, unknown>>(messages: Messages<T>): Messages<T> {
  return messages;
}

// ------------------------------------------------------------ interface locale

const KEY = 'brandfolio:locale';

/** Saved choice first, then the browser's languages, then Russian. */
export function detectLocale(): Locale {
  try {
    const saved = globalThis.localStorage?.getItem(KEY);
    if (isLocale(saved)) return saved;
  } catch {
    // Storage blocked: fall through to the browser languages.
  }
  const languages = globalThis.navigator?.languages ?? [];
  for (const tag of languages) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLocale(base)) return base;
  }
  return 'ru';
}

let current: Locale = detectLocale();
const listeners = new Set<() => void>();

function applyToDocument(locale: Locale) {
  if (typeof document !== 'undefined') document.documentElement.lang = LOCALE_TAGS[locale];
}
applyToDocument(current);

export function getLocale(): Locale {
  return current;
}

export function setLocale(locale: Locale) {
  if (locale === current) return;
  current = locale;
  try {
    globalThis.localStorage?.setItem(KEY, locale);
  } catch {
    // Private mode: the choice lasts for this session only.
  }
  applyToDocument(locale);
  listeners.forEach((l) => l());
}

export function useLocale(): Locale {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}

/** Messages of one namespace in the interface language; re-renders on change. */
export function useMessages<T>(messages: Messages<T>): T {
  return messages[useLocale()];
}

/** Same for code outside React (validation, storage errors): read at call time. */
export function msg<T>(messages: Messages<T>, locale: Locale = current): T {
  return messages[locale];
}

// ------------------------------------------------------------------ plurals

export type PluralForms = { one: string; few?: string; many?: string; other: string };

const pluralRules = new Map<Locale, Intl.PluralRules>();

/** Picks the plural form for `n`; `#` in the form is replaced with the number. */
export function plural(locale: Locale, n: number, forms: PluralForms): string {
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(LOCALE_TAGS[locale]);
    pluralRules.set(locale, rules);
  }
  const category = rules.select(n) as keyof PluralForms;
  const form = forms[category] ?? forms.other;
  return form.replace('#', String(n));
}
