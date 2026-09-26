import { CloudOff } from 'lucide-react';
import { useMessages } from '@/i18n/core';
import { accountMessages } from '@/i18n/messages/account';

/** Shown on account pages when this deployment has no API behind it. */
export function CloudUnavailable() {
  const m = useMessages(accountMessages).auth;
  return (
    <div className="mt-8 flex items-start gap-3 rounded-lg border border-line bg-panel p-5 text-sm">
      <CloudOff size={20} className="mt-0.5 shrink-0" aria-hidden />
      <div>
        <p className="font-bold">{m.unavailableTitle}</p>
        <p className="mt-1 text-muted">{m.unavailableText}</p>
      </div>
    </div>
  );
}
