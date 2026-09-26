import { cn } from '@/lib/cn';

/** Small "Pro" marker next to a paid feature. The word is a plan name and is not translated. */
export function ProBadge({ className }: { className?: string }) {
  return <span className={cn('inline-flex h-5 shrink-0 items-center rounded-full bg-ink px-2 align-middle text-[11px] leading-none font-bold text-accent', className)}>Pro</span>;
}
