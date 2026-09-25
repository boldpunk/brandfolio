/**
 * Cookieless, privacy-friendly usage statistics. Off unless the build sets
 *   VITE_ANALYTICS=umami     VITE_ANALYTICS_SRC=https://…/script.js  VITE_ANALYTICS_ID=<website id>
 *   VITE_ANALYTICS=plausible VITE_ANALYTICS_SRC=https://…/script.js  VITE_ANALYTICS_ID=<domain>
 * Page views are counted by the provider's script (it follows SPA navigation);
 * `track` adds product events. Events carry no project content: only the
 * names below and small enumerable properties.
 */
export type AnalyticsEvent =
  | 'project_created'
  | 'demo_opened'
  | 'pdf_exported'
  | 'archive_exported'
  | 'archive_imported'
  | 'template_changed'
  | 'document_language_changed'
  | 'interface_language_changed';

type Props = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: { track: (name: string, data?: Props) => void };
    plausible?: (name: string, options?: { props?: Props }) => void;
  }
}

const provider = import.meta.env.VITE_ANALYTICS as 'umami' | 'plausible' | undefined;
const src = import.meta.env.VITE_ANALYTICS_SRC as string | undefined;
const id = import.meta.env.VITE_ANALYTICS_ID as string | undefined;

export const analyticsEnabled = Boolean(provider && src && id);

/** Adds the provider script once; call at startup. */
export function initAnalytics() {
  if (!analyticsEnabled || typeof document === 'undefined') return;
  if (navigator.doNotTrack === '1') return;
  const script = document.createElement('script');
  script.defer = true;
  script.src = src!;
  if (provider === 'umami') script.dataset.websiteId = id;
  else script.dataset.domain = id;
  document.head.appendChild(script);
}

/** Records a product event; a no-op when analytics is off or blocked. */
export function track(event: AnalyticsEvent, props?: Props) {
  try {
    if (provider === 'umami') window.umami?.track(event, props);
    else if (provider === 'plausible') window.plausible?.(event, props ? { props } : undefined);
  } catch {
    // Statistics must never break the app.
  }
}
