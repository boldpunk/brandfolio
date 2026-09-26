import { Cloud, LogOut } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { useNotify } from '@/components/ui/Announcer';
import { Button } from '@/components/ui/Button';
import { refreshAccount, signOut, useAccount } from '@/cloud/account';
import { cloudErrorText } from '@/cloud/errors';
import type { Me } from '@/cloud/contract';
import { LOCALE_TAGS, useLocale, useMessages } from '@/i18n/core';
import { accountMessages } from '@/i18n/messages/account';
import { cn } from '@/lib/cn';
import { initial } from './utils';
import { CloudUnavailable } from './CloudUnavailable';
import { ProTeaser } from './ProTeaser';

export default function AccountPage() {
  const account = useAccount();
  const m = useMessages(accountMessages);

  // Plan and usage may have changed on another device.
  useEffect(() => {
    void refreshAccount();
  }, []);

  if (account.status === 'signedOut') return <Navigate to="/login?next=/account" replace />;
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="animate-rise text-3xl font-bold tracking-tight sm:text-4xl">{m.page.title}</h1>
      {account.status === 'loading' && <p className="mt-8 text-muted">{m.auth.loading}</p>}
      {account.status === 'unavailable' && <CloudUnavailable />}
      {account.status === 'signedIn' && <AccountDetails me={account.me} />}
    </div>
  );
}

export function PlanBadge({ plan, className }: { plan: Me['plan']; className?: string }) {
  const m = useMessages(accountMessages).page;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide uppercase',
        plan === 'pro' ? 'bg-accent text-ink' : 'border border-line-strong bg-panel text-ink',
        className,
      )}
    >
      {m.plans[plan]}
    </span>
  );
}

function AccountDetails({ me }: { me: Me }) {
  const m = useMessages(accountMessages).page;
  const locale = useLocale();
  const notify = useNotify();
  const [busy, setBusy] = useState(false);
  const date = useMemo(() => new Intl.DateTimeFormat(LOCALE_TAGS[locale], { day: 'numeric', month: 'long', year: 'numeric' }), [locale]);
  const limit = me.entitlements.cloudProjects;
  const used = me.usage.cloudProjects;
  const until = me.planUntil ? date.format(new Date(me.planUntil)) : null;

  async function leave() {
    setBusy(true);
    try {
      await signOut();
      notify(m.signedOut);
    } catch (error) {
      notify(m.signOutFailed(cloudErrorText(error)), 'error');
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 flex flex-col gap-6">
      <section className="animate-rise rounded-lg border border-line bg-panel p-5 shadow-panel sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full bg-ink text-lg font-bold text-white">
              {initial(me.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">{me.name}</p>
              <p className="truncate text-sm text-muted">{me.email}</p>
            </div>
          </div>
          <Button icon={<LogOut size={16} />} onClick={() => void leave()} disabled={busy}>
            {busy ? m.signingOut : m.signOut}
          </Button>
        </div>
        <dl className="mt-6 grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold text-muted">{m.plan}</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              <PlanBadge plan={me.plan} />
              {me.plan !== 'free' && <span className="text-muted">{until ? m.planUntil(until) : m.planForever}</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-muted">
              <Cloud size={14} className="mr-1 inline align-[-2px]" aria-hidden />
              {m.usageLabel}
            </dt>
            <dd className="mt-1 text-sm font-semibold">{limit === null ? m.usageUnlimited(used) : m.usage(used, limit)}</dd>
            {limit !== null && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper" aria-hidden>
                <div className={cn('h-full rounded-full transition-[width] duration-500', used >= limit ? 'bg-danger' : 'bg-ink')} style={{ width: `${Math.min(100, (used / Math.max(1, limit)) * 100)}%` }} />
              </div>
            )}
          </div>
        </dl>
        <p className="mt-5 text-xs text-muted">{m.localNote}</p>
        <Link to="/projects" className="mt-4 inline-flex h-10 items-center rounded-md border border-line-strong px-4 text-sm font-semibold hover:bg-paper">
          {m.toProjects}
        </Link>
      </section>
      <ProTeaser plan={me.plan} className="animate-rise [animation-delay:120ms]" />
    </div>
  );
}
