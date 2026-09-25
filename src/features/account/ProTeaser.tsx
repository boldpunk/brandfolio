import { Check, CreditCard, Sparkles } from 'lucide-react';
import type { Plan } from '@/cloud/contract';
import { useMessages } from '@/i18n/core';
import { accountMessages } from '@/i18n/messages/account';
import { cn } from '@/lib/cn';
import { proBenefits } from './utils';

/** What Pro adds. For a Pro user it lists what the plan includes, without the payment note. */
export function ProTeaser({ plan, className }: { plan: Plan; className?: string }) {
  const m = useMessages(accountMessages).page;
  const isPro = plan === 'pro';
  return (
    <section aria-labelledby="pro-h" className={cn('rounded-lg border border-ink bg-ink p-5 text-white shadow-sheet sm:p-6', className)}>
      <div className="flex items-center gap-2">
        <Sparkles size={18} className="text-accent" aria-hidden />
        <h2 id="pro-h" className="text-lg font-bold">
          {isPro ? m.proYours : m.proHeading}
        </h2>
      </div>
      {!isPro && <p className="mt-1 text-sm text-white/75">{m.proText}</p>}
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {proBenefits().map((key) => (
          <li key={key} className="flex items-start gap-2 text-sm">
            <Check size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
            {m.benefits[key]}
          </li>
        ))}
      </ul>
      {!isPro && (
        <div className="mt-5 flex items-start gap-3 rounded-md bg-white/10 p-3 text-sm">
          <CreditCard size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <p>
            <strong className="font-semibold">{m.soon}.</strong> <span className="text-white/75">{m.soonText}</span>
          </p>
        </div>
      )}
    </section>
  );
}
