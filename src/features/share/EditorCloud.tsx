import { CloudAlert, CloudCheck, CloudOff, CloudSync, CloudUpload, Share2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { useAutosave } from '@/features/editor/useAutosave';
import { useMessages } from '@/i18n/core';
import { cloudMessages } from '@/i18n/messages/cloud';
import { shareMessages } from '@/i18n/messages/share';
import { cn } from '@/lib/cn';
import { CloudConflictDialog } from './CloudConflictDialog';
import { cloudTone, type CloudTone } from './cloudStatus';
import { ShareDialog } from './ShareDialog';

type Autosave = ReturnType<typeof useAutosave>;

const dotClass: Record<CloudTone, string> = {
  ok: 'bg-success',
  busy: 'bg-line-strong animate-pulse',
  wait: 'bg-line-strong',
  problem: 'bg-danger',
  local: 'bg-line',
};

function StatusIcon({ tone, size = 16 }: { tone: CloudTone; size?: number }) {
  if (tone === 'ok') return <CloudCheck size={size} aria-hidden />;
  if (tone === 'busy') return <CloudSync size={size} aria-hidden />;
  if (tone === 'wait') return <CloudOff size={size} aria-hidden />;
  if (tone === 'problem') return <CloudAlert size={size} aria-hidden />;
  return <CloudUpload size={size} aria-hidden />;
}

/**
 * Cloud status and the share entry in the editor top bar. Nothing renders
 * without an account (or without the API), so the editor looks as before.
 */
export function EditorCloudStatus({ autosave, onOpen }: { autosave: Autosave; onOpen: () => void }) {
  const state = autosave.cloud.state;
  const t = useMessages(cloudMessages).editor;
  if (state.kind !== 'linked') return null;
  const tone = cloudTone(state);
  const label = t.status[state.sync.status];
  return (
    <button
      type="button"
      onClick={onOpen}
      title={state.sync.error ?? label}
      className={cn(
        'hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors md:inline-flex',
        tone === 'problem' ? 'bg-danger-soft text-danger' : 'bg-paper text-muted hover:text-ink',
      )}
    >
      <StatusIcon tone={tone} size={14} />
      {label}
    </button>
  );
}

export function EditorShareButton({ autosave, open, onOpenChange }: { autosave: Autosave; open: boolean; onOpenChange: (open: boolean) => void }) {
  const state = autosave.cloud.state;
  const t = useMessages(cloudMessages).editor;
  const s = useMessages(shareMessages).dialog;
  const [conflictOpen, setConflictOpen] = useState(false);
  const status = state.kind === 'linked' ? state.sync.status : null;
  const shownFor = useRef<string | null>(null);

  // Open the conflict choice once each time a conflict appears; "decide later" closes it.
  useEffect(() => {
    if (status === 'conflict' && shownFor.current !== 'conflict') setConflictOpen(true);
    shownFor.current = status;
  }, [status]);

  if (state.kind === 'off') return null;
  const tone = cloudTone(state);
  const label = t.button(state.kind === 'linked' ? t.status[state.sync.status] : t.local);
  return (
    <>
      <Button
        onClick={() => (status === 'conflict' ? setConflictOpen(true) : onOpenChange(true))}
        aria-label={label}
        title={label}
        icon={
          <span className="relative inline-flex">
            <Share2 size={16} aria-hidden />
            <span aria-hidden className={cn('absolute -top-1 -right-1 size-2 rounded-full ring-2 ring-panel md:hidden', dotClass[tone])} />
          </span>
        }
        className="px-3 lg:px-4"
      >
        <span className="hidden lg:inline">{s.share}</span>
      </Button>
      <ShareDialog open={open} onOpenChange={onOpenChange} autosave={autosave} onResolve={() => setConflictOpen(true)} />
      <CloudConflictDialog open={conflictOpen} onOpenChange={setConflictOpen} autosave={autosave} />
    </>
  );
}
