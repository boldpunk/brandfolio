import { Eye, EyeOff, LogIn, UserPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useNotify } from '@/components/ui/Announcer';
import { Button } from '@/components/ui/Button';
import { controlClass, FieldShell, TextField } from '@/components/ui/Field';
import { setSignedIn, useAccount } from '@/cloud/account';
import { cloudApi } from '@/cloud/api';
import { PASSWORD_MIN } from '@/cloud/contract';
import { cloudErrorText } from '@/cloud/errors';
import { getLocale, useMessages } from '@/i18n/core';
import { accountMessages } from '@/i18n/messages/account';
import { cn } from '@/lib/cn';
import { CloudUnavailable } from './CloudUnavailable';
import { safeNext } from './utils';

type Mode = 'login' | 'register';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Sign-in and registration on one page; the switch keeps what was typed. */
export default function AuthPage() {
  const mode: Mode = useLocation().pathname.endsWith('/register') ? 'register' : 'login';
  const account = useAccount();
  const m = useMessages(accountMessages).auth;
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const query = params.toString() ? `?${params.toString()}` : '';

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:py-16">
      <div className="animate-rise">
        <h1 className="text-3xl font-bold tracking-tight">{mode === 'login' ? m.loginTitle : m.registerTitle}</h1>
        <p className="mt-2 text-sm text-muted">{mode === 'login' ? m.loginSubtitle : m.registerSubtitle}</p>
      </div>
      {account.status === 'loading' && <p className="mt-8 text-muted">{m.loading}</p>}
      {account.status === 'unavailable' && <CloudUnavailable />}
      {account.status === 'signedIn' && (
        <div className="mt-8 rounded-lg border border-line bg-panel p-5 shadow-panel">
          <p className="font-semibold">{m.signedInAs(account.me.name)}</p>
          <Link to="/account" className="mt-4 inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold">
            {m.toAccount}
          </Link>
        </div>
      )}
      {account.status === 'signedOut' && (
        <>
          <nav aria-label={m.modes} className="mt-8 grid grid-cols-2 rounded-md border border-line-strong bg-panel p-1">
            {(['login', 'register'] as const).map((id) => (
              <Link
                key={id}
                to={`/${id}${query}`}
                replace
                aria-current={mode === id ? 'page' : undefined}
                className={cn(
                  'flex h-9 items-center justify-center rounded-sm text-sm font-semibold transition-colors',
                  mode === id ? 'bg-ink text-white' : 'text-ink hover:bg-ink/5',
                )}
              >
                {id === 'login' ? m.loginTitle : m.registerTitle}
              </Link>
            ))}
          </nav>
          <AuthForm mode={mode} next={next} />
          <p className="mt-6 text-xs text-muted">{m.localNote}</p>
        </>
      )}
    </div>
  );
}

function AuthForm({ mode, next }: { mode: Mode; next: string }) {
  const m = useMessages(accountMessages).auth;
  const navigate = useNavigate();
  const notify = useNotify();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; form?: string }>({});

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found: typeof errors = {};
    if (mode === 'register' && !name.trim()) found.name = m.nameRequired;
    if (!EMAIL.test(email.trim())) found.email = m.emailInvalid;
    if (mode === 'register' && password.length < PASSWORD_MIN) found.password = m.passwordShort(PASSWORD_MIN);
    if (mode === 'login' && !password) found.password = m.passwordRequired;
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const me =
        mode === 'register'
          ? await cloudApi.register({ name: name.trim(), email: email.trim(), password, locale: getLocale() })
          : await cloudApi.login({ email: email.trim(), password });
      setSignedIn(me);
      notify(m.welcome(me.name));
      navigate(next, { replace: true });
    } catch (error) {
      setErrors({ form: cloudErrorText(error) });
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="mt-6 flex flex-col gap-4">
      {mode === 'register' && (
        <TextField label={m.name} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" error={errors.name} maxLength={80} />
      )}
      <TextField
        label={m.email}
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
      />
      <FieldShell label={m.password} hint={mode === 'register' ? m.passwordHint(PASSWORD_MIN) : undefined} error={errors.password}>
        {({ id, describedBy, invalid }) => (
          <div className="relative">
            <input
              id={id}
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              className={cn(controlClass, 'h-10 pr-11')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? m.hidePassword : m.showPassword}
              aria-pressed={showPassword}
              title={showPassword ? m.hidePassword : m.showPassword}
              className="absolute top-1/2 right-1 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-sm text-muted hover:bg-ink/5 hover:text-ink"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        )}
      </FieldShell>
      {errors.form && (
        <p role="alert" className="rounded-md border border-danger bg-danger-soft p-3 text-sm text-danger">
          {errors.form}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={busy} icon={mode === 'login' ? <LogIn size={16} /> : <UserPlus size={16} />} className="mt-1">
        {busy ? m.busy : mode === 'login' ? m.submitLogin : m.submitRegister}
      </Button>
    </form>
  );
}
