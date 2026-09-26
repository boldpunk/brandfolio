import { LogIn } from 'lucide-react';
import { NavLink } from 'react-router';
import { useAccount } from '@/cloud/account';
import { useMessages } from '@/i18n/core';
import { accountMessages } from '@/i18n/messages/account';
import { cn } from '@/lib/cn';
import { initial } from './utils';

/**
 * Header entry: "Sign in" or the account. Icon-only below `sm`, where the
 * 360 px header has no room for another label. Hidden without the API.
 */
export function AccountEntry() {
  const account = useAccount();
  const m = useMessages(accountMessages).header;
  if (account.status === 'signedOut') {
    return (
      <NavLink
        to="/login"
        aria-label={m.signIn}
        title={m.signIn}
        className={({ isActive }) =>
          cn(
            'inline-flex size-9 items-center justify-center rounded-md text-sm font-semibold transition-colors sm:ml-1 sm:w-auto sm:gap-2 sm:border sm:border-line-strong sm:px-3',
            isActive ? 'bg-ink text-white sm:border-ink' : 'text-ink hover:bg-ink/5',
          )
        }
      >
        <LogIn size={16} aria-hidden />
        <span className="hidden sm:inline">{m.signIn}</span>
      </NavLink>
    );
  }
  if (account.status !== 'signedIn') return null;
  const { name } = account.me;
  return (
    <NavLink
      to="/account"
      aria-label={m.account(name)}
      title={m.account(name)}
      className={({ isActive }) =>
        cn(
          'inline-flex h-9 min-w-9 items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors sm:ml-1 sm:px-1.5 sm:pr-2.5',
          isActive ? 'bg-ink/10' : 'hover:bg-ink/5',
        )
      }
    >
      <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">
        {initial(name)}
      </span>
      <span className="hidden max-w-32 truncate sm:inline">{name}</span>
    </NavLink>
  );
}
