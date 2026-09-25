import { Check, ChevronDown, ChevronUp, Copy, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, IconButton } from '@/components/ui/Button';
import { useNotify } from '@/components/ui/Announcer';
import { Dialog } from '@/components/ui/Dialog';
import { FieldShell, SelectField, TextField, controlClass } from '@/components/ui/Field';
import { checkContrast, formatHsl, formatRgb, hexToRgb, normalizeHex, rgbToHsl } from '@/domain/color';
import { PALETTE_LIMITS } from '@/domain/limits';
import { addColor, canAddColor, canRemoveColor, COLOR_ROLE_LABELS, colorUsages, moveColor, removeColor, updateColor } from '@/domain/operations';
import { COLOR_ROLES, type BrandColor, type ColorRole } from '@/domain/schema';
import { cn } from '@/lib/cn';
import { useEditorStore, useProject } from '../editorStore';
import { Group, Panel } from './fields';

async function copy(text: string, notify: (m: string, tone?: 'info' | 'error') => void) {
  try {
    await navigator.clipboard.writeText(text);
    notify(`Скопировано: ${text}`);
  } catch {
    notify('Браузер не разрешил доступ к буферу обмена', 'error');
  }
}

function HexInput({ color, onCommit }: { color: BrandColor; onCommit: (hex: string) => void }) {
  const [draft, setDraft] = useState(color.hex);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setDraft(color.hex);
    setError(null);
  }, [color.hex]);
  const commit = (value: string) => {
    const hex = normalizeHex(value);
    if (!hex) {
      setError('Формат #RGB или #RRGGBB, например #B65C3A');
      return;
    }
    setError(null);
    setDraft(hex);
    if (hex !== color.hex) onCommit(hex);
  };
  return (
    <FieldShell label="HEX" error={error}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          value={draft}
          spellCheck={false}
          autoCapitalize="characters"
          onChange={(e) => {
            setDraft(e.target.value);
            const hex = normalizeHex(e.target.value);
            // Commit full valid values while typing; short #RGB waits for blur.
            if (hex && e.target.value.replace('#', '').length === 6) {
              setError(null);
              if (hex !== color.hex) onCommit(hex);
            }
          }}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commit((e.target as HTMLInputElement).value)}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className={cn(controlClass, 'h-10 font-mono uppercase')}
        />
      )}
    </FieldShell>
  );
}

function ColorRow({ color, index, total, onDelete }: { color: BrandColor; index: number; total: number; onDelete: () => void }) {
  const apply = useEditorStore((s) => s.apply);
  const notify = useNotify();
  const rgb = formatRgb(hexToRgb(color.hex));
  const hsl = formatHsl(rgbToHsl(hexToRgb(color.hex)));
  const set = (patch: Partial<Omit<BrandColor, 'id'>>, key?: string) => apply((p) => updateColor(p, color.id, patch), key);
  return (
    <li className="flex flex-col gap-3 rounded-md border border-line p-3">
      <div className="flex items-center gap-3">
        <label className="relative size-12 shrink-0 cursor-pointer overflow-hidden rounded-md border border-line-strong" style={{ background: color.hex }}>
          <span className="sr-only">Выбрать цвет «{color.name || 'без названия'}» в палитре браузера</span>
          <input type="color" value={color.hex.toLowerCase()} onChange={(e) => set({ hex: e.target.value.toUpperCase() }, `color.${color.id}.picker`)} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
        <div className="min-w-0 flex-1">
          <TextField label="Название" value={color.name} maxLength={60} onChange={(e) => set({ name: e.target.value }, `color.${color.id}.name`)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <HexInput color={color} onCommit={(hex) => set({ hex })} />
        <SelectField label="Роль" value={color.role} onChange={(e) => set({ role: e.target.value as ColorRole })}>
          {COLOR_ROLES.map((role) => (
            <option key={role} value={role}>
              {COLOR_ROLE_LABELS[role]}
            </option>
          ))}
        </SelectField>
      </div>
      <dl className="grid gap-1 text-xs">
        {(
          [
            ['HEX', color.hex],
            ['RGB', rgb],
            ['HSL', hsl],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-2">
            <dt className="w-10 text-muted">{label}</dt>
            <dd className="flex-1 font-mono">{value}</dd>
            <IconButton label={`Копировать ${label} ${value}`} size="sm" className="size-7" onClick={() => void copy(value, notify)}>
              <Copy size={14} />
            </IconButton>
          </div>
        ))}
      </dl>
      <div className="flex gap-1">
        <IconButton label={`Выше: ${color.name || color.hex}`} size="sm" disabled={index === 0} onClick={() => apply((p) => moveColor(p, color.id, -1))}>
          <ChevronUp size={16} />
        </IconButton>
        <IconButton label={`Ниже: ${color.name || color.hex}`} size="sm" disabled={index === total - 1} onClick={() => apply((p) => moveColor(p, color.id, 1))}>
          <ChevronDown size={16} />
        </IconButton>
        <IconButton label={`Удалить цвет ${color.name || color.hex}`} size="sm" disabled={total <= PALETTE_LIMITS.min} onClick={onDelete} className="ml-auto">
          <Trash2 size={16} />
        </IconButton>
      </div>
    </li>
  );
}

function ContrastChecker() {
  const { brand } = useProject();
  // Default pair: the text colour on the background colour, when roles are set.
  const [a, setA] = useState(() => (brand.colors.find((c) => c.role === 'text') ?? brand.colors[0])?.id ?? '');
  const [b, setB] = useState(() => (brand.colors.find((c) => c.role === 'background' && c.id !== a) ?? brand.colors.find((c) => c.id !== a))?.id ?? '');
  const ca = brand.colors.find((c) => c.id === a) ?? brand.colors[0];
  const cb = brand.colors.find((c) => c.id === b) ?? brand.colors.find((c) => c.id !== ca?.id);
  if (!ca || !cb) return null;
  const result = checkContrast(ca.hex, cb.hex);
  const verdict = (pass: boolean) => (
    <span className={cn('inline-flex items-center gap-1 font-semibold', pass ? 'text-success' : 'text-danger')}>
      {pass ? <Check size={14} aria-hidden /> : <X size={14} aria-hidden />}
      {pass ? 'проходит AA' : 'не проходит AA'}
    </span>
  );
  return (
    <Group title="Проверка контраста" hint="Коэффициент по WCAG 2.1 для выбранной пары цветов. Это проверка одной пары, а не сертификация доступности всего бренда.">
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ['Цвет текста', ca, setA],
            ['Цвет фона', cb, setB],
          ] as const
        ).map(([label, value, set]) => (
          <SelectField key={label} label={label} value={value.id} onChange={(e) => set(e.target.value)}>
            {brand.colors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || 'Без названия'} · {c.hex}
              </option>
            ))}
          </SelectField>
        ))}
      </div>
      <div className="rounded-md border border-line p-4" style={{ background: cb.hex, color: ca.hex }}>
        <p className="text-2xl font-bold">Крупный текст</p>
        <p className="text-sm">Обычный текст для проверки читаемости.</p>
      </div>
      <div className="text-sm" aria-live="polite">
        <p>
          Коэффициент: <span className="font-mono text-base font-bold">{result.label}</span>
        </p>
        <p className="mt-1">Обычный текст (от 4.5:1): {verdict(result.normalText)}</p>
        <p>Крупный текст, от 18 pt или 14 pt жирный (от 3:1): {verdict(result.largeText)}</p>
      </div>
    </Group>
  );
}

export function ColorsPanel() {
  const project = useProject();
  const apply = useEditorStore((s) => s.apply);
  const [removing, setRemoving] = useState<BrandColor | null>(null);
  const [replacement, setReplacement] = useState<string>('');
  const colors = project.brand.colors;
  const usages = removing ? colorUsages(project, removing.id) : [];

  const startRemove = (color: BrandColor) => {
    setRemoving(color);
    setReplacement(colors.find((c) => c.id !== color.id)?.id ?? '');
  };

  return (
    <Panel title="Цвета" description={`От ${PALETTE_LIMITS.min} до ${PALETTE_LIMITS.max} цветов. Ввод #RGB и #RRGGBB, значения приводятся к #RRGGBB.`}>
      <ol className="flex flex-col gap-3">
        {colors.map((color, index) => (
          <ColorRow key={color.id} color={color} index={index} total={colors.length} onDelete={() => startRemove(color)} />
        ))}
      </ol>
      <Button
        icon={<Plus size={16} />}
        disabled={!canAddColor(project)}
        onClick={() => apply((p) => addColor(p, { name: '', role: 'custom', hex: '#808080' }))}
        className="self-start"
      >
        Добавить цвет
      </Button>
      {!canAddColor(project) && <p className="text-xs text-muted">В палитре максимальное число цветов.</p>}
      <ContrastChecker />
      <Dialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Удалить цвет «${removing?.name || removing?.hex}»?`}
        description={usages.length ? `Цвет используется: ${usages.join(', ')}. Выберите замену, чтобы макеты не сломались.` : 'Цвет нигде не выбран вручную.'}
        footer={
          <>
            <Button onClick={() => setRemoving(null)}>Отмена</Button>
            <Button
              variant="danger"
              disabled={!removing || !canRemoveColor(project)}
              onClick={() => {
                if (removing) apply((p) => removeColor(p, removing.id, usages.length ? replacement || null : null));
                setRemoving(null);
              }}
            >
              Удалить
            </Button>
          </>
        }
      >
        {usages.length > 0 && (
          <SelectField label="Заменить на" value={replacement} onChange={(e) => setReplacement(e.target.value)}>
            {colors
              .filter((c) => c.id !== removing?.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || 'Без названия'} · {c.hex}
                </option>
              ))}
            <option value="">Автоматически по роли</option>
          </SelectField>
        )}
      </Dialog>
    </Panel>
  );
}
