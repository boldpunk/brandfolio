import { useId, type ReactNode, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const control =
  'w-full rounded-md border border-line-strong bg-panel px-3 text-sm text-ink placeholder:text-muted/80 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-danger';

type FieldShellProps = {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  /** Current length and limit, shown as a visible counter. */
  count?: { value: number; max: number };
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
  className?: string;
};

/** Label, hint, counter and error wired to the control via aria attributes. */
export function FieldShell({ label, hint, error, count, children, className }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const countId = count ? `${id}-count` : undefined;
  const over = count ? count.value > count.max : false;
  const describedBy = [errorId, hintId, countId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        {count && (
          <span id={countId} className={cn('font-mono text-xs', over ? 'font-bold text-danger' : 'text-muted')}>
            {count.value}/{count.max}
            <span className="sr-only"> символов</span>
          </span>
        )}
      </div>
      {children({ id, describedBy, invalid: Boolean(error) || over })}
      {hint && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

type Common = { label: string; hint?: ReactNode; error?: string | null; maxLength?: number; className?: string };

export function TextField({ label, hint, error, maxLength, className, value, ...rest }: Common & Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> & { value: string }) {
  return (
    <FieldShell label={label} hint={hint} error={error} count={maxLength ? { value: value.length, max: maxLength } : undefined} className={className}>
      {({ id, describedBy, invalid }) => (
        // No maxLength attribute: over-long text stays visible and is flagged instead of silently cut.
        <input id={id} aria-describedby={describedBy} aria-invalid={invalid} className={cn(control, 'h-10')} value={value} {...rest} />
      )}
    </FieldShell>
  );
}

export function TextAreaField({ label, hint, error, maxLength, className, value, rows = 4, ...rest }: Common & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> & { value: string }) {
  return (
    <FieldShell label={label} hint={hint} error={error} count={maxLength ? { value: value.length, max: maxLength } : undefined} className={className}>
      {({ id, describedBy, invalid }) => (
        <textarea id={id} aria-describedby={describedBy} aria-invalid={invalid} rows={rows} className={cn(control, 'resize-y py-2 leading-relaxed')} value={value} {...rest} />
      )}
    </FieldShell>
  );
}

export function SelectField({ label, hint, error, className, children, ...rest }: Omit<Common, 'maxLength'> & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'>) {
  return (
    <FieldShell label={label} hint={hint} error={error} className={className}>
      {({ id, describedBy, invalid }) => (
        <select id={id} aria-describedby={describedBy} aria-invalid={invalid} className={cn(control, 'h-10')} {...rest}>
          {children}
        </select>
      )}
    </FieldShell>
  );
}

export const controlClass = control;
