import { HardDrive, X } from 'lucide-react';
import { Link } from 'react-router';
import { IconButton } from '@/components/ui/Button';
import { useMessages } from '@/i18n/core';
import { projectsMessages } from '@/i18n/messages/projects';
import { setUiSettings, useUiSettings } from '@/lib/uiSettings';

/** Shown once: where data lives and what can erase it. */
export function StorageNotice() {
  const { storageNoticeDismissed } = useUiSettings();
  const m = useMessages(projectsMessages).notice;
  if (storageNoticeDismissed) return null;
  return (
    <aside aria-label={m.label} className="mt-6 flex items-start gap-3 rounded-lg border border-line bg-panel p-4 text-sm">
      <HardDrive size={20} className="mt-0.5 shrink-0" aria-hidden />
      <p className="flex-1 text-muted">
        <strong className="text-ink">{m.strong}</strong> {m.text} {m.moreBefore}{' '}
        <Link to="/settings" className="font-semibold text-ink underline underline-offset-2">
          {m.moreLink}
        </Link>
        {m.moreAfter}
      </p>
      <IconButton label={m.dismiss} size="sm" onClick={() => setUiSettings({ storageNoticeDismissed: true })}>
        <X size={16} />
      </IconButton>
    </aside>
  );
}
