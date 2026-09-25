import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { IconButton } from '@/components/ui/Button';
import { useNotify } from '@/components/ui/Announcer';
import { createId } from '@/domain/ids';
import { IMAGERY_MAX_IMAGES, LIST_LIMITS, TEXT_LIMITS } from '@/domain/limits';
import { LOGO_VARIANTS, type Asset, type LogoVariantKind, type Project } from '@/domain/schema';
import { useEditorAssets } from '../editorAssets';
import { useBrandUpdater, useEditorStore, useProject } from '../editorStore';
import { Dropzone } from './Dropzone';
import { ColorRefSelect, Group, ListEditor, NumberInput, Panel, Text } from './fields';

const VARIANT_INFO: Record<LogoVariantKind, { label: string; hint: string }> = {
  primary: { label: 'Основной', hint: 'Главная версия логотипа.' },
  alternative: { label: 'Альтернативный', hint: 'Например, горизонтальная или вертикальная компоновка.' },
  mark: { label: 'Знак', hint: 'Символ без надписи.' },
  light: { label: 'Светлая версия', hint: 'Для тёмных фонов. Загрузите отдельный файл: приложение не перекрашивает логотип.' },
};

const withAsset = (p: Project, asset: Asset): Project => ({ ...p, assetIds: p.assetIds.includes(asset.id) ? p.assetIds : [...p.assetIds, asset.id] });

export function LogoPanel() {
  const project = useProject();
  const apply = useEditorStore((s) => s.apply);
  const update = useBrandUpdater();
  const { urls, metas } = useEditorAssets();
  const notify = useNotify();
  const logo = project.brand.logo;

  const setVariant = (kind: LogoVariantKind, asset: Asset | null) =>
    apply((p) => {
      const next = asset ? withAsset(p, asset) : p;
      return { ...next, brand: { ...next.brand, logo: { ...next.brand.logo, variants: { ...next.brand.logo.variants, [kind]: asset?.id ?? null } } } };
    });

  return (
    <Panel title="Логотип" description="Загрузите файлы логотипа. Правила и размеры задаёте вы.">
      {LOGO_VARIANTS.map((kind) => {
        const id = logo.variants[kind];
        const meta = id ? metas.get(id) : undefined;
        return (
          <Group key={kind} title={VARIANT_INFO[kind].label} hint={VARIANT_INFO[kind].hint}>
            {id ? (
              <div className="flex items-center gap-3">
                <div className={`flex size-20 shrink-0 items-center justify-center rounded-md border border-line p-2 ${kind === 'light' ? 'bg-ink' : 'bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:12px_12px]'}`}>
                  {urls.get(id) && <img src={urls.get(id)} alt={`${VARIANT_INFO[kind].label} логотип`} className="max-h-full max-w-full object-contain" />}
                </div>
                <div className="min-w-0 flex-1 text-xs text-muted">
                  <p className="truncate font-semibold text-ink">{meta?.filename}</p>
                  {meta && (
                    <p className="font-mono">
                      {meta.width}×{meta.height} · {Math.ceil(meta.byteSize / 1024)} КБ
                    </p>
                  )}
                  {meta?.mimeType === 'image/svg+xml' && <p>SVG очищен; в PDF попадёт растровая копия высокого разрешения.</p>}
                </div>
                <IconButton label={`Удалить: ${VARIANT_INFO[kind].label}`} size="sm" onClick={() => setVariant(kind, null)}>
                  <Trash2 size={16} />
                </IconButton>
              </div>
            ) : null}
            <Dropzone
              kind="logo"
              compact={Boolean(id)}
              label={id ? 'Заменить файл' : 'Выбрать файл'}
              onAdded={(asset, notes) => {
                setVariant(kind, asset);
                notify(notes[0] ?? 'Логотип загружен');
              }}
            />
          </Group>
        );
      })}
      <Group title="Размеры">
        <NumberInput
          label="Охранное поле"
          unit="× высоты логотипа"
          min={0}
          max={2}
          step={0.05}
          value={logo.clearSpace}
          onChange={(clearSpace) => update('logo', { clearSpace: clearSpace ?? 0 })}
          hint="Например, 0.25 — отступ в четверть высоты логотипа с каждой стороны."
        />
        <div className="grid grid-cols-2 gap-3">
          <NumberInput label="Мин. размер" unit="px" min={0} max={2000} step={1} allowEmpty value={logo.minSizePx} onChange={(minSizePx) => update('logo', { minSizePx: minSizePx === null ? null : Math.round(minSizePx) })} />
          <NumberInput label="Мин. размер" unit="мм" min={0} max={500} step={0.5} allowEmpty value={logo.minSizeMm} onChange={(minSizeMm) => update('logo', { minSizeMm })} />
        </div>
      </Group>
      <Group title="Правила">
        <Text label="Правила использования" multiline maxLength={TEXT_LIMITS.longText} value={logo.usageRules} onChange={(usageRules) => update('logo', { usageRules }, 'logo.usageRules')} />
        <ListEditor label="Допустимо" itemLabel="Пункт" items={logo.doRules} max={LIST_LIMITS.logoDoDont} onChange={(doRules) => update('logo', { doRules })} />
        <ListEditor label="Недопустимо" itemLabel="Пункт" items={logo.dontRules} max={LIST_LIMITS.logoDoDont} onChange={(dontRules) => update('logo', { dontRules })} />
      </Group>
      <Group title="Иллюстрации ошибок" hint="Показываются с подписью «Недопустимо».">
        {(
          [
            ['stretch', 'Растяжение'],
            ['rotate', 'Наклон'],
            ['busyBackground', 'Пёстрый фон'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-ink" checked={logo.misuse[key]} onChange={(e) => update('logo', { misuse: { ...logo.misuse, [key]: e.target.checked } })} />
            {label}
          </label>
        ))}
      </Group>
      <Group title="Фон для примера">
        <ColorRefSelect label="Фирменный фон" value={logo.previewColorId} onChange={(previewColorId) => update('logo', { previewColorId })} autoLabel="Основной цвет" />
      </Group>
    </Panel>
  );
}

function FocalPicker({ url, x, y, onChange, label }: { url: string | undefined; x: number; y: number; onChange: (x: number, y: number) => void; label: string }) {
  const pick = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    onChange(Math.round(((event.clientX - rect.left) / rect.width) * 100), Math.round(((event.clientY - rect.top) / rect.height) * 100));
  };
  const onKey = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 10 : 2;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const m = moves[event.key];
    if (!m) return;
    event.preventDefault();
    onChange(Math.min(100, Math.max(0, x + m[0])), Math.min(100, Math.max(0, y + m[1])));
  };
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={`${label}: точка фокуса. Стрелки двигают точку`}
      aria-valuetext={`${x}% по горизонтали, ${y}% по вертикали`}
      aria-valuenow={x}
      onClick={pick}
      onKeyDown={onKey}
      className="relative cursor-crosshair overflow-hidden rounded-md border border-line"
    >
      {url && <img src={url} alt="" className="block w-full" draggable={false} />}
      <span className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_#191919]" style={{ left: `${x}%`, top: `${y}%` }} />
    </div>
  );
}

export function ImageryPanel() {
  const project = useProject();
  const apply = useEditorStore((s) => s.apply);
  const update = useBrandUpdater();
  const { urls } = useEditorAssets();
  const im = project.brand.imagery;
  const setImages = (images: typeof im.images, key?: string) => update('imagery', { images }, key);

  return (
    <Panel title="Стиль изображений" description={`До ${IMAGERY_MAX_IMAGES} изображений с подписями. Кадрирование задаётся точкой фокуса, исходный файл не меняется.`}>
      {im.images.map((img, index) => (
        <Group key={img.id} title={`Изображение ${index + 1}`}>
          <FocalPicker url={urls.get(img.assetId)} x={img.focalX} y={img.focalY} label={`Изображение ${index + 1}`} onChange={(focalX, focalY) => setImages(im.images.map((x) => (x.id === img.id ? { ...x, focalX, focalY } : x)), `imagery.focal.${img.id}`)} />
          <Text label="Подпись" maxLength={TEXT_LIMITS.caption} value={img.caption} onChange={(caption) => setImages(im.images.map((x) => (x.id === img.id ? { ...x, caption } : x)), `imagery.caption.${img.id}`)} />
          <div className="flex gap-1">
            <IconButton label={`Выше: изображение ${index + 1}`} size="sm" disabled={index === 0} onClick={() => setImages(swap(im.images, index, -1))}>
              <ChevronUp size={16} />
            </IconButton>
            <IconButton label={`Ниже: изображение ${index + 1}`} size="sm" disabled={index === im.images.length - 1} onClick={() => setImages(swap(im.images, index, 1))}>
              <ChevronDown size={16} />
            </IconButton>
            <IconButton label={`Удалить изображение ${index + 1}`} size="sm" onClick={() => setImages(im.images.filter((x) => x.id !== img.id))}>
              <Trash2 size={16} />
            </IconButton>
          </div>
        </Group>
      ))}
      {im.images.length < IMAGERY_MAX_IMAGES ? (
        <Dropzone
          kind="image"
          label="Добавить изображение"
          onAdded={(asset) =>
            apply((p) => {
              const next = withAsset(p, asset);
              const images = [...next.brand.imagery.images, { id: createId('i'), assetId: asset.id, caption: '', focalX: 50, focalY: 50 }];
              return { ...next, brand: { ...next.brand, imagery: { ...next.brand.imagery, images } } };
            })
          }
        />
      ) : (
        <p className="text-xs text-muted">Добавлено максимальное число изображений ({IMAGERY_MAX_IMAGES}).</p>
      )}
      <Group title="Правила">
        <Text label="Свет" multiline rows={3} maxLength={TEXT_LIMITS.longText} value={im.lighting} onChange={(lighting) => update('imagery', { lighting }, 'imagery.lighting')} />
        <Text label="Композиция" multiline rows={3} maxLength={TEXT_LIMITS.longText} value={im.composition} onChange={(composition) => update('imagery', { composition }, 'imagery.composition')} />
        <Text label="Обработка" multiline rows={3} maxLength={TEXT_LIMITS.longText} value={im.processing} onChange={(processing) => update('imagery', { processing }, 'imagery.processing')} />
        <Text label="Нежелательные приёмы" multiline rows={3} maxLength={TEXT_LIMITS.longText} value={im.avoid} onChange={(avoid) => update('imagery', { avoid }, 'imagery.avoid')} />
      </Group>
    </Panel>
  );
}

function swap<T>(items: T[], index: number, dir: -1 | 1): T[] {
  const next = [...items];
  [next[index], next[index + dir]] = [next[index + dir]!, next[index]!];
  return next;
}
