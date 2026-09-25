import { getLocale, msg, type Locale } from '@/i18n/core';
import { cloudMessages } from '@/i18n/messages/cloud';
import { isCloudError } from './api';
import { PASSWORD_MIN } from './contract';

/** A translated, user-facing message for any error a cloud call can throw. */
export function cloudErrorText(error: unknown, locale: Locale = getLocale()): string {
  const m = msg(cloudMessages, locale).errors;
  if (isCloudError(error)) {
    if (error.code === 'weak_password') return m.weak_password(PASSWORD_MIN);
    return m[error.code];
  }
  return error instanceof Error ? error.message : String(error);
}
