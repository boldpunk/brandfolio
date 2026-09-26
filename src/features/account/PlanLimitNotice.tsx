import { Sparkles } from 'lucide-react';
import { Link } from 'react-router';
import type { Me } from '@/cloud/contract';
import { useMessages } from '@/i18n/core';
import { cloudMessages } from '@/i18n/messages/cloud';
import { cn } from '@/lib/cn';

/** Free plan is full: explain and point to Pro. `compact` is one line for use inside dialogs. */
export function PlanLimitNotice({ me, className, compact }: { me: Me | null; className?: string; compact?: boolean }) {
  const m = useMessages(cloudMessages).projects;
  const limit = me?.entitlements.cloudProjects ?? 1;
  if (compact) {
    return (
      <p className={cn('flex items-start gap-2 text-xs', className)}>
        <Sparkles size={14} className="mt-px shrink-0" aria-hidden />
        <span>
          <strong className="font-semibold">{m.limitTitle}.</strong>{' '}
          <Link to="/pricing" className="font-semibold underline underline-offset-2">
            {m.limitLink}
          </Link>
        </span>
      </p>
    );
  }
  return (
    <div role="alert" className={cn('flex items-start gap-3 rounded-lg border border-ink bg-ink p-4 text-sm text-white', className)}>
      <Sparkles size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
      <div>
        <p className="font-bold">{m.limitTitle}</p>
        <p className="mt-1 text-white/75">{m.limitText(limit)}</p>
        <Link to="/pricing" className="mt-3 inline-flex h-8 items-center rounded-md bg-accent px-3 text-sm font-semibold text-ink">
          {m.limitLink}
        </Link>
      </div>
    </div>
  );
}
