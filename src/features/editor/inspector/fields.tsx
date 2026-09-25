import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, IconButton } from '@/components/ui/Button';
import { FieldShell, SelectField, TextAreaField, TextField, controlClass } from '@/components/ui/Field';
import { resolveFamily } from '@/domain/fonts';
import { TEXT_LIMITS } from '@/domain/limits';
import { projectSchema, type Project } from '@/domain/schema';
import { useMessages } from '@/i18n/core';
import { inspectorMessages } from '@/i18n/messages/inspector';
import { cn } from '@/lib/cn';
import { useProject } from '../editorStore';

/** Validation messages for the current document, keyed by dotted path. */
export function useFieldErrors(): ReadonlyMap<string, string> {
  const project = useProject();
  return useMemo(() => {
    const result = projectSchema.safeParse(project);
    const map = new Map<string, string>();
    if (!result.success) for (const issue of result.error.issues) map.set(issue.path.join('.'), issue.message);
    return map;
  }, [project]);
}

/** Characters the chosen fonts cannot render, found in the given texts. */
export function useMissingGlyphWarning(texts: string[]): string | null {
  const project = useProject();
  const m = useMessages(inspectorMessages).common;
  return useMemo(() => {
    const families = new Set(Object.values(project.brand.typography).map((t) => t.familyId));
    const missing = new Set<string>();
    for (const family of families) for (const ch of resolveFamily(family, project.brand.customFonts).missingGlyphs) if (texts.some((t) => t.includes(ch))) missing.add(ch);
    return missing.size
      ? m.missingGlyphs([...missing].map((c) => `«${c}» (U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')})`).join(', '))
      : null;
  }, [project.brand.typography, project.brand.customFonts, texts, m]);
}

export function Panel({ title, children, description }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-5 p-4">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function Group({ title, children, hint }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 border-t border-line pt-4">
      <legend className="float-left mb-1 w-full text-sm font-bold">{title}</legend>
      {hint && <p className="-mt-2 text-xs text-muted">{hint}</p>}
      {children}
    </fieldset>
  );
}

type TextProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  error?: string | null;
  hint?: ReactNode;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  type?: string;
  inputMode?: 'email' | 'url' | 'tel' | 'text';
};

export function Text({ label, value, onChange, maxLength = TEXT_LIMITS.short, error, hint, placeholder, multiline, rows, type, inputMode }: TextProps) {
  const common = { label, value, maxLength, error, hint, placeholder, onChange: (e: { target: { value: string } }) => onChange(e.target.value) };
  return multiline ? <TextAreaField {...common} rows={rows ?? 4} /> : <TextField {...common} type={type} inputMode={inputMode} />;
}

/** Number input that keeps the typed draft and commits only valid values. */
export function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  allowEmpty,
  hint,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
  allowEmpty?: boolean;
  hint?: ReactNode;
}) {
  const [draft, setDraft] = useState(value === null ? '' : String(value));
  const [error, setError] = useState<string | null>(null);
  const m = useMessages(inspectorMessages).common;
  useEffect(() => {
    setDraft(value === null ? '' : String(value));
    setError(null);
  }, [value]);
  const commit = (raw: string) => {
    setDraft(raw);
    const text = raw.trim().replace(',', '.');
    if (text === '') {
      if (allowEmpty) {
        setError(null);
        onChange(null);
      } else setError(m.enterNumber);
      return;
    }
    const n = Number(text);
    if (!Number.isFinite(n)) return setError(m.enterNumber);
    if (n < min || n > max) return setError(m.range(min, max));
    setError(null);
    if (n !== value) onChange(n);
  };
  return (
    <FieldShell label={unit ? `${label}, ${unit}` : label} error={error} hint={hint}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={draft}
          onChange={(e) => commit(e.target.value)}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className={cn(controlClass, 'h-10 font-mono')}
        />
      )}
    </FieldShell>
  );
}

export function ColorRefSelect({ label, value, onChange, autoLabel, hint }: { label: string; value: string | null; onChange: (id: string | null) => void; autoLabel?: string; hint?: ReactNode }) {
  const project = useProject();
  const m = useMessages(inspectorMessages).common;
  const current = project.brand.colors.find((c) => c.id === value);
  return (
    <div className="flex items-end gap-2">
      <SelectField label={label} hint={hint} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} className="flex-1">
        <option value="">{autoLabel ?? m.auto}</option>
        {project.brand.colors.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name || m.untitled} · {c.hex}
          </option>
        ))}
      </SelectField>
      <span aria-hidden className="mb-1 size-8 shrink-0 rounded-md border border-line-strong" style={{ background: current?.hex ?? 'repeating-linear-gradient(45deg,#fff 0 4px,#dcd8ce 4px 8px)' }} />
    </div>
  );
}

/** Editable list of short texts with add, remove and reorder buttons. */
export function ListEditor({ label, items, onChange, max, itemLabel, maxLength = TEXT_LIMITS.listItem, hint }: { label: string; items: string[]; onChange: (items: string[]) => void; max: number; itemLabel: string; maxLength?: number; hint?: ReactNode }) {
  const m = useMessages(inspectorMessages).common;
  const set = (index: number, value: string) => onChange(items.map((item, i) => (i === index ? value : item)));
  const move = (index: number, dir: -1 | 1) => {
    const next = [...items];
    [next[index], next[index + dir]] = [next[index + dir]!, next[index]!];
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">{label}</span>
        <span className="font-mono text-xs text-muted">
          {items.length}/{max}
        </span>
      </div>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      {items.length === 0 && <p className="rounded-md border border-dashed border-line-strong p-3 text-xs text-muted">{m.empty}</p>}
      <ol className="flex flex-col gap-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-1">
            <div className="flex-1">
              <TextField label={`${itemLabel} ${index + 1}`} value={item} maxLength={maxLength} onChange={(e) => set(index, e.target.value)} />
            </div>
            <div className="mt-7 flex">
              <IconButton label={m.moveUp(`${itemLabel.toLowerCase()} ${index + 1}`)} size="sm" disabled={index === 0} onClick={() => move(index, -1)}>
                <ChevronUp size={14} />
              </IconButton>
              <IconButton label={m.moveDown(`${itemLabel.toLowerCase()} ${index + 1}`)} size="sm" disabled={index === items.length - 1} onClick={() => move(index, 1)}>
                <ChevronDown size={14} />
              </IconButton>
              <IconButton label={m.remove(`${itemLabel.toLowerCase()} ${index + 1}`)} size="sm" onClick={() => onChange(items.filter((_, i) => i !== index))}>
                <Trash2 size={14} />
              </IconButton>
            </div>
          </li>
        ))}
      </ol>
      <Button size="sm" icon={<Plus size={14} />} disabled={items.length >= max} onClick={() => onChange([...items, ''])} className="self-start">
        {m.add}
      </Button>
    </div>
  );
}

export type BrandKey = keyof Project['brand'];
