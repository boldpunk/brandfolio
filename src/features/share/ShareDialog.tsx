import { Check, Copy, Lock, RefreshCw } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useNotify } from '@/components/ui/Announcer';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { controlClass, FieldShell } from '@/components/ui/Field';
import { atProjectLimit, useAccount } from '@/cloud/account';
import { saveToCloud } from '@/cloud/actions';
import { cloudApi, isCloudError } from '@/cloud/api';
import type { Me, ShareSettings } from '@/cloud/contract';
import { cloudErrorText } from '@/cloud/errors';
import { useEditorStore } from '@/features/editor/editorStore';
import type { useAutosave } from '@/features/editor/useAutosave';
import { useMessages } from '@/i18n/core';
import { cloudMessages } from '@/i18n/messages/cloud';
import { shareMessages } from '@/i18n/messages/share';
import { cn } from '@/lib/cn';
import { shareUrl } from './cloudStatus';
import { PlanLimitNotice } from '@/features/account/PlanLimitNotice';

type Autosave = ReturnType<typeof useAutosave>;

/** Cloud state of the open project and its view-only link. */
export function ShareDialog({ open, onOpenChange, autosave, onResolve }: { open: boolean; onOpenChange: (open: boolean) => void; autosave: Autosave; onResolve: () => void }) {
  const m = useMessages(shareMessages).dialog;
  const account = useAccount();
  const state = autosave.cloud.state;
  const me = account.status === 'signedIn' ? account.me : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={m.title} description={m.description}>
      {state.kind === 'local' && me && <SaveToCloud autosave={autosave} me={me} />}
      {state.kind === 'linked' && me && (
        <div className="flex flex-col gap-6">
          <SyncSection autosave={autosave} onResolve={onResolve} onClose={() => onOpenChange(false)} />
          {state.sync.status !== 'gone' && <LinkSection me={me} pending={state.sync.status !== 'synced'} />}
        </div>
      )}
    </Dialog>
  );
}

function currentProjectId(): string {
  return useEditorStore.getState().history?.present.id ?? '';
}

function SaveToCloud({ autosave, me, again }: { autosave: Autosave; me: Me; again?: boolean }) {
  const m = useMessages(shareMessages).dialog;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const limited = !again && atProjectLimit(me);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      // Upload what the editor shows: write pending edits first.
      await autosave.flush();
      await saveToCloud(currentProjectId());
      await autosave.cloud.restart();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {!again && <p className="text-sm text-muted">{m.localText}</p>}
      {limited || isCloudError(error, 'plan_limit') ? (
        <PlanLimitNotice me={me} />
      ) : (
        <Button variant="primary" onClick={() => void save()} disabled={busy} className="self-start">
          {busy ? m.saving : m.saveToCloud}
        </Button>
      )}
      {error !== null && !isCloudError(error, 'plan_limit') && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {cloudErrorText(error)}
        </p>
      )}
    </div>
  );
}

function SyncSection({ autosave, onResolve, onClose }: { autosave: Autosave; onResolve: () => void; onClose: () => void }) {
  const m = useMessages(shareMessages).dialog;
  const t = useMessages(cloudMessages).editor;
  const account = useAccount();
  const state = autosave.cloud.state;
  if (state.kind !== 'linked') return null;
  const { status, error } = state.sync;
  const problem = status === 'conflict' || status === 'error' || status === 'signedOut' || status === 'gone';
  return (
    <section aria-labelledby="sync-h" className="flex flex-col gap-3">
      <h3 id="sync-h" className="flex items-center gap-2 font-bold">
        {m.syncHeading}
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', problem ? 'bg-danger-soft text-danger' : 'bg-paper text-muted')}>{t.status[status]}</span>
      </h3>
      <p role="status" className="text-sm text-muted">
        {m.syncText[status]}
      </p>
      {status === 'error' && error && <p className="text-xs text-muted">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {(status === 'offline' || status === 'error') && (
          <Button size="sm" icon={<RefreshCw size={14} />} onClick={() => void autosave.cloud.retry()}>
            {m.retry}
          </Button>
        )}
        {status === 'conflict' && (
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              onClose();
              onResolve();
            }}
          >
            {m.resolve}
          </Button>
        )}
        {status === 'signedOut' && (
          <Link to={`/login?next=${encodeURIComponent(`/editor/${currentProjectId()}`)}`} className="inline-flex h-8 items-center rounded-md bg-accent px-3 text-sm font-semibold">
            {m.signIn}
          </Link>
        )}
      </div>
      {status === 'gone' && account.status === 'signedIn' && <SaveToCloud autosave={autosave} me={account.me} again />}
    </section>
  );
}

type LinkState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; share: ShareSettings | null };

function LinkSection({ me, pending }: { me: Me; pending: boolean }) {
  const m = useMessages(shareMessages).dialog;
  const notify = useNotify();
  const [link, setLink] = useState<LinkState>({ status: 'loading' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const projectId = currentProjectId();

  async function load() {
    setLink({ status: 'loading' });
    try {
      const list = await cloudApi.listProjects();
      setLink({ status: 'ready', share: list.find((p) => p.id === projectId)?.share ?? null });
    } catch (e) {
      setLink({ status: 'error', message: cloudErrorText(e) });
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per opening
  }, [projectId]);

  async function update(body: { enabled: boolean; password?: string }, done: string) {
    setBusy(true);
    setError(null);
    try {
      const share = await cloudApi.putShare(projectId, body);
      setLink({ status: 'ready', share });
      notify(done);
      return true;
    } catch (e) {
      setError(m.updateFailed(cloudErrorText(e)));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const enabled = link.status === 'ready' && Boolean(link.share?.enabled);
  const share = link.status === 'ready' ? link.share : null;

  return (
    <section aria-labelledby="link-h" className="flex flex-col gap-3 border-t border-line pt-5">
      <h3 id="link-h" className="font-bold">
        {m.linkHeading}
      </h3>
      {link.status === 'loading' && <p className="text-sm text-muted">{m.loading}</p>}
      {link.status === 'error' && (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-sm text-danger">
            {m.loadFailed(link.message)}
          </p>
          <Button size="sm" onClick={() => void load()}>
            {m.retryLoad}
          </Button>
        </div>
      )}
      {link.status === 'ready' && (
        <>
          <Switch
            checked={enabled}
            disabled={busy}
            label={m.linkToggle}
            hint={m.linkHint}
            onChange={(on) => void update({ enabled: on }, on ? m.enabled : m.disabled)}
          />
          {enabled && share && (
            <div className="flex flex-col gap-4 [animation:pop-in_200ms_cubic-bezier(0.2,0.7,0.2,1)]">
              <CopyField url={shareUrl(share.slug)} />
              {pending && <p className="text-xs text-muted">{m.pendingNote}</p>}
              {me.entitlements.sharePassword ? (
                <PasswordForm hasPassword={share.hasPassword} busy={busy} onSave={(password) => update({ enabled: true, password }, password ? m.passwordSaved : m.passwordRemoved)} />
              ) : (
                <div className="flex items-start gap-3 rounded-md border border-line bg-paper p-3 text-sm">
                  <Lock size={16} className="mt-0.5 shrink-0" aria-hidden />
                  <p>
                    {m.proOnly}{' '}
                    <Link to="/pricing" className="font-semibold underline underline-offset-2">
                      {m.proLink}
                    </Link>
                  </p>
                </div>
              )}
              {me.entitlements.shareBadge && <p className="text-xs text-muted">{m.badgeNote}</p>}
            </div>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </section>
  );
}

function Switch({ checked, disabled, label, hint, onChange }: { checked: boolean; disabled: boolean; label: string; hint: string; onChange: (on: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        <p id={`${id}-hint`} className="mt-0.5 text-xs text-muted">
          {hint}
        </p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={`${id}-hint`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200 disabled:opacity-50',
          checked ? 'border-ink bg-ink' : 'border-line-strong bg-paper',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'inline-block size-4 rounded-full shadow-panel transition-transform duration-200 ease-[cubic-bezier(0.2,0.7,0.2,1)]',
            checked ? 'translate-x-[22px] bg-accent' : 'translate-x-[3px] bg-panel ring-1 ring-line-strong',
          )}
        />
      </button>
    </div>
  );
}

function CopyField({ url }: { url: string }) {
  const m = useMessages(shareMessages).dialog;
  const notify = useNotify();
  const input = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      notify(m.copied);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      input.current?.select();
      notify(m.copyFailed, 'error');
    }
  }

  return (
    <FieldShell label={m.url}>
      {({ id, describedBy }) => (
        <div className="flex min-w-0 gap-2">
          <input
            id={id}
            ref={input}
            readOnly
            value={url}
            onFocus={(e) => e.target.select()}
            aria-describedby={describedBy}
            className={cn(controlClass, 'h-10 min-w-0 flex-1 font-mono text-xs')}
          />
          <Button onClick={() => void copy()} icon={copied ? <Check size={16} /> : <Copy size={16} />} aria-label={m.copy} title={m.copy} className="px-3 sm:px-4">
            <span className="hidden sm:inline">{m.copy}</span>
          </Button>
        </div>
      )}
    </FieldShell>
  );
}

function PasswordForm({ hasPassword, busy, onSave }: { hasPassword: boolean; busy: boolean; onSave: (password: string) => Promise<boolean> }) {
  const m = useMessages(shareMessages).dialog;
  const [password, setPassword] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password && (await onSave(password))) setPassword('');
  };
  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-2">
      <FieldShell label={m.passwordLabel} hint={hasPassword ? m.passwordIsSet : m.passwordHint}>
        {({ id, describedBy }) => (
          <input
            id={id}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby={describedBy}
            className={cn(controlClass, 'h-10')}
          />
        )}
      </FieldShell>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={busy || !password}>
          {m.savePassword}
        </Button>
        {hasPassword && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void onSave('')}>
            {m.removePassword}
          </Button>
        )}
      </div>
    </form>
  );
}
