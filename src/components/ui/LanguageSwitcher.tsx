import { Globe } from 'lucide-react';
import { useId } from 'react';
import { LOCALE_NAMES, LOCALE_TAGS, LOCALES, isLocale, setLocale, useLocale, useMessages } from '@/i18n/core';
import { commonMessages } from '@/i18n/messages/common';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/cn';

const SHORT: Record<(typeof LOCALES)[number], string> = { ru: 'RU', uz: 'UZ', en: 'EN' };

/**
 * Compact interface language picker for the header. The native select sits
 * invisibly on top of the short code, so it stays keyboard- and
 * screen-reader-friendly everywhere while the header shows only "RU".
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const m = useMessages(commonMessages);
  const id = useId();
  return (
    <div
      className={cn(
        'relative inline-flex h-9 items-center gap-1.5 rounded-md px-1.5 text-sm sm:px-2.5 font-semibold text-ink transition-colors hover:bg-ink/5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink',
        className,
      )}
    >
      <Globe size={16} aria-hidden className="hidden text-muted min-[400px]:block" />
      <span aria-hidden>{SHORT[locale]}</span>
      <label htmlFor={id} className="sr-only">
        {m.language}
      </label>
      <select
        id={id}
        value={locale}
        onChange={(e) => {
          if (!isLocale(e.target.value)) return;
          setLocale(e.target.value);
          track('interface_language_changed', { to: e.target.value });
        }}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0 focus-visible:outline-none"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={LOCALE_TAGS[l]}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </div>
  );
}
