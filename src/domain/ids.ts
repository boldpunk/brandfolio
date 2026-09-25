/** Stable, URL- and CSS-safe identifiers. */
export function createId(prefix = ''): string {
  const raw = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  return prefix ? `${prefix}_${raw}` : raw;
}
