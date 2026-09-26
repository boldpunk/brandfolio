import { Check, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAccount } from '@/cloud/account';
import { LOCALE_TAGS, useLocale, useMessages } from '@/i18n/core';
import { billingMessages } from '@/i18n/messages/billing';
import { cn } from '@/lib/cn';
import { CONTACT_URL, PRICES } from './pricing';

type Period = 'monthly' | 'yearly';

const primaryLink = 'inline-flex h-11 w-full items-center justify-center rounded-md px-4 text-sm font-bold transition-colors';

/** Free and Pro side by side, a comparison table and questions. */
export default function PricingPage() {
  const m = useMessages(billingMessages);
  const locale = useLocale();
  const account = useAccount();
  const [period, setPeriod] = useState<Period>('yearly');
  const number = new Intl.NumberFormat(LOCALE_TAGS[locale]);
  const me = account.status === 'signedIn' ? account.me : null;
  const isPro = me?.plan === 'pro';

  useEffect(() => {
    const previous = document.title;
    document.title = `${m.docTitle} · Brandfolio`;
    return () => {
      document.title = previous;
    };
  }, [m.docTitle]);

  const until = me?.planUntil ? new Intl.DateTimeFormat(LOCALE_TAGS[locale], { dateStyle: 'long' }).format(new Date(me.planUntil)) : null;
  const price = period === 'monthly' ? PRICES.monthly : PRICES.yearly;

  let proAction;
  if (isPro) proAction = <p className="flex h-11 items-center justify-center rounded-md bg-white/10 text-sm font-bold">{m.pro.yours(until)}</p>;
  else if (!me && account.status !== 'unavailable')
    proAction = (
      <Link to="/register?next=/pricing" className={cn(primaryLink, 'bg-accent text-ink hover:brightness-95')}>
        {m.pro.ctaSignUp}
      </Link>
    );
  else if (CONTACT_URL)
    proAction = (
      <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer" className={cn(primaryLink, 'bg-accent text-ink hover:brightness-95')}>
        {m.pro.ctaContact}
      </a>
    );
  else proAction = <p className="flex h-11 items-center justify-center rounded-md bg-white/10 text-sm font-bold">{m.pro.ctaUpgrade}</p>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
      <header className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-bold tracking-wide text-muted uppercase">{m.eyebrow}</p>
        <h1 className="mt-3 text-3xl font-bold text-balance sm:text-5xl">{m.title}</h1>
        <p className="mt-4 text-muted sm:text-lg">{m.lead}</p>
      </header>

      <div role="radiogroup" aria-label={m.eyebrow} className="mx-auto mt-8 flex w-fit rounded-full border border-line-strong bg-panel p-1">
        {(['monthly', 'yearly'] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={period === p}
            onClick={() => setPeriod(p)}
            className={cn('inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors', period === p ? 'bg-ink text-white' : 'hover:bg-ink/5')}
          >
            {p === 'monthly' ? m.monthly : m.yearly}
            {p === 'yearly' && <span className={cn('rounded-full px-1.5 text-xs', period === p ? 'bg-accent text-ink' : 'bg-accent/60')}>{m.yearlySave}</span>}
          </button>
        ))}
      </div>

      <div className="mx-auto mt-8 grid max-w-4xl gap-6 md:grid-cols-2">
        <section aria-labelledby="plan-free" className="flex flex-col rounded-lg border border-line-strong bg-panel p-6 sm:p-8">
          <h2 id="plan-free" className="text-xl font-bold">
            {m.free.name}
          </h2>
          <p className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl font-bold">{m.free.price}</span>
            <span className="text-muted">{m.currency}</span>
          </p>
          <p className="mt-1 text-sm text-muted">{m.free.note}</p>
          <ul className="mt-6 grid flex-1 gap-2.5 text-sm">
            {m.free.features.map((f) => (
              <li key={f} className="flex gap-2">
                <Check size={16} className="mt-0.5 shrink-0" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
          <Link to="/projects" className={cn(primaryLink, 'mt-8 border border-line-strong hover:bg-paper')}>
            {m.free.cta}
          </Link>
        </section>

        <section aria-labelledby="plan-pro" className="relative flex flex-col rounded-lg bg-ink p-6 text-white shadow-sheet sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <h2 id="plan-pro" className="flex items-center gap-2 text-xl font-bold">
              <Sparkles size={18} className="text-accent" aria-hidden />
              {m.pro.name}
            </h2>
            <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-ink">{m.pro.badge}</span>
          </div>
          <p className="mt-4 flex flex-wrap items-baseline gap-2">
            <span className="text-4xl font-bold tabular-nums">{number.format(price)}</span>
            <span className="text-white/70">
              {m.currency} {period === 'monthly' ? m.perMonth : m.perYear}
            </span>
          </p>
          <p className="mt-1 text-sm text-white/70">{period === 'yearly' ? m.yearlyEquivalent(number.format(Math.round(PRICES.yearly / 12 / 100) * 100)) : ' '}</p>
          <ul className="mt-6 grid flex-1 gap-2.5 text-sm">
            {m.pro.features.map((f) => (
              <li key={f} className="flex gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-8">{proAction}</div>
          {!isPro && <p className="mt-3 text-xs text-white/60">{CONTACT_URL ? m.payments : m.paymentsNoContact}</p>}
        </section>
      </div>

      <section aria-labelledby="compare-h" className="mx-auto mt-16 max-w-4xl">
        <h2 id="compare-h" className="text-2xl font-bold">
          {m.compareTitle}
        </h2>
        <div className="mt-6 overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
            <thead className="bg-paper">
              <tr>
                <th scope="col" className="p-3 font-bold">
                  {m.compare.feature}
                </th>
                <th scope="col" className="p-3 font-bold">
                  {m.free.name}
                </th>
                <th scope="col" className="p-3 font-bold">
                  {m.pro.name}
                </th>
              </tr>
            </thead>
            <tbody>
              {m.compare.rows.map(([feature, free, pro]) => (
                <tr key={feature} className="border-t border-line">
                  <th scope="row" className="p-3 font-semibold">
                    {feature}
                  </th>
                  <td className="p-3 text-muted">{free}</td>
                  <td className="p-3 font-semibold">{pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="pricing-faq" className="mx-auto mt-16 max-w-4xl">
        <h2 id="pricing-faq" className="text-2xl font-bold">
          {m.faqTitle}
        </h2>
        <div className="mt-6 divide-y divide-line border-y border-line">
          {m.faq.map((item) => (
            <details key={item.q} className="faq group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md py-4 font-bold [&::-webkit-details-marker]:hidden">
                {item.q}
                <span aria-hidden className="text-xl transition-[rotate] group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="pb-4 text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
