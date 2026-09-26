import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router';
import { cn } from '@/lib/cn';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { Wordmark } from '@/components/ui/Wordmark';
import { AccountEntry } from '@/features/account/AccountEntry';
import { useAccount } from '@/cloud/account';
import { useMessages } from '@/i18n/core';
import { commonMessages } from '@/i18n/messages/common';

const navLink = ({ isActive }: { isActive: boolean }) =>
  cn('rounded-md px-2 py-2 text-sm font-semibold transition-colors sm:px-3', isActive ? 'bg-ink text-white' : 'text-ink hover:bg-ink/5');

/** Chrome for the non-editor pages. */
export function AppShell() {
  const m = useMessages(commonMessages);
  // With the account entry the 360 px header has no room for the full wordmark: below 400 px only the mark shows.
  const accountShown = ['signedIn', 'signedOut'].includes(useAccount().status);
  useEffect(() => {
    document.title = m.documentTitle;
  }, [m.documentTitle]);
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-panel focus:px-3 focus:py-2">
        {m.skipToContent}
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-1 px-4 sm:gap-4 sm:px-6">
          <NavLink to="/" className="rounded-md" aria-label={m.homeLink}>
            <Wordmark className={cn(accountShown && 'max-[399px]:[&>span]:sr-only')} />
          </NavLink>
          <nav aria-label={m.mainNav} className="flex items-center sm:gap-1">
            <NavLink to="/projects" className={navLink}>
              {m.projects}
            </NavLink>
            {/* Pricing is reachable from Pro prompts too; the header has no room for it on phones. */}
            <NavLink to="/pricing" className={(state) => `${navLink(state)} max-sm:hidden`}>
              {m.pricing}
            </NavLink>
            <NavLink to="/settings" className={navLink}>
              {m.settings}
            </NavLink>
            <LanguageSwitcher />
            <AccountEntry />
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
