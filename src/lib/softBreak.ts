const ZWSP = '​';

/**
 * Adds invisible break opportunities inside very long unbroken tokens (URLs,
 * e-mails, pasted hashes) so PDF text wraps instead of running off the page.
 * Regular words are left untouched.
 */
export function softBreak(text: string, maxRun = 24, chunk = 12): string {
  return text.replace(new RegExp(`\\S{${maxRun + 1},}`, 'g'), (token) => {
    // Prefer breaking after URL punctuation, then fall back to fixed chunks.
    const withPunctuation = token.replace(/([/.?&=_-])/g, `$1${ZWSP}`);
    return withPunctuation
      .split(ZWSP)
      .map((part) => (part.length > maxRun ? part.replace(new RegExp(`(.{${chunk}})`, 'g'), `$1${ZWSP}`) : part))
      .join(ZWSP);
  });
}
