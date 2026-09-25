import { useLayoutEffect, type RefObject } from 'react';

/**
 * Fades `[data-reveal]` elements inside `root` in as they scroll into view.
 * Only elements that start below the fold are hidden, and only when
 * IntersectionObserver exists and the user allows motion, so content is never
 * lost to a missing API or shown with a flash.
 */
export function useReveal(root: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const container = root.current;
    if (!container || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const fold = window.innerHeight;
    const targets = [...container.querySelectorAll<HTMLElement>('[data-reveal]')].filter((el) => el.getBoundingClientRect().top > fold);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute('data-reveal', 'shown');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    for (const el of targets) {
      el.setAttribute('data-reveal', 'hidden');
      observer.observe(el);
    }
    return () => {
      observer.disconnect();
      for (const el of targets) el.setAttribute('data-reveal', 'shown');
    };
  }, [root]);
}
