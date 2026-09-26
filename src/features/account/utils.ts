import { ENTITLEMENTS, type Entitlements } from '@/cloud/contract';

/** First letter of the name for the avatar circle. */
export function initial(name: string): string {
  return [...name.trim()][0]?.toLocaleUpperCase() ?? '?';
}

/** Only same-app paths after sign-in: never an open redirect. */
export function safeNext(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : '/projects';
}

/** Entitlements where Pro gives more than Free, in contract order. */
export function proBenefits(): (keyof Entitlements)[] {
  return (Object.keys(ENTITLEMENTS.pro) as (keyof Entitlements)[]).filter((key) => ENTITLEMENTS.pro[key] !== ENTITLEMENTS.free[key]);
}
