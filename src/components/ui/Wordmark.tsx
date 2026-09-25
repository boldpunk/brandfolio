/** Brandfolio wordmark: a folded-page mark and the name. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <rect x="1" y="1" width="20" height="20" rx="3" fill="#191919" />
        <path d="M6 6h7l3 3v7H6z" fill="#F4F2ED" />
        <path d="M13 6v3h3" fill="#B8F16C" />
      </svg>
      <span className="text-base font-bold tracking-tight">Brandfolio</span>
    </span>
  );
}
