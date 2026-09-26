/** Pro prices in Uzbek sum, chosen on 2026-09-25 (subscription). */
export const PRICES = { monthly: 79_000, yearly: 690_000 } as const;

/**
 * Where people ask for Pro until card payments exist (a Telegram or mailto
 * link), set at build time as VITE_CONTACT_URL; without it the page says that
 * payments are coming.
 */
export const CONTACT_URL = (import.meta.env.VITE_CONTACT_URL as string | undefined)?.trim() || null;
