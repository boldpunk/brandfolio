import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { IconButton } from '@/components/ui/Button';
import { useNotify } from '@/components/ui/Announcer';
import { createId } from '@/domain/ids';
import { IMAGERY_MAX_IMAGES, LIST_LIMITS, TEXT_LIMITS } from '@/domain/limits';
import { LOGO_VARIANTS, type Asset, type LogoVariantKind, type Project } from '@/domain/schema';
import { useMessages } from '@/i18n/core';
import { brandMessages } from '@/i18n/messages/brand';
import { inspectorMessages } from '@/i18n/messages/inspector';
import { useEditorAssets } from '../editorAssets';
import { useBrandUpdater, useEditorStore, useProject } from '../editorStore';
import { Dropzone } from './Dropzone';
import { ColorRefSelect, Group, ListEditor, NumberInput, Panel, Text } from './fields';

const withAsset = (p: Project, asset: Asset): Project => ({ ...p, assetIds: p.assetIds.includes(asset.id) ? p.assetIds : [...p.assetIds, asset.id] });

export function LogoPanel() {
  const project = useProject();
  const apply = useEditorStore((s) => s.apply);
  const update = useBrandUpdater();
  const { urls, metas } = useEditorAssets();
  const notify = useNotify();
  const brandText = useMessages(brandMessages);
  const t = useMessages(inspectorMessages);
  const m = t.logo;
  const variantLabels = brandText.logoVariants;
  const logo = project.brand.logo;

  const setVariant = (kind: LogoVariantKind, asset: Asset | null) =>
    apply((p) => {
      const next = asset ? withAsset(p, asset) : p;
      return { ...next, brand: { ...next.brand, logo: { ...next.brand.logo, variants: { ...next.brand.logo.variants, [kind]: asset?.id ?? null } } } };
    });

  return (
    <Panel title={brandText.sections.logo} description={m.description}>
      {LOGO_VARIANTS.map((kind) => {
        const id = logo.variants[kind];
        const meta = id ? metas.get(id) : undefined;
        return (
          <Group key={kind} title={variantLabels[kind]} hint={m.hints[kind]}>
            {id ? (
              <div className="flex items-center gap-3">
                <div className={`flex size-20 shrink-0 items-center justify-center rounded-md border border-line p-2 ${kind === 'light' ? 'bg-ink' : 'bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:12px_12px]'}`}>
                  {urls.get(id) && <img src={urls.get(id)} alt={m.alt(variantLabels[kind])} className="max-h-full max-w-full object-contain" />}
                </div>
                <div className="min-w-0 flex-1 text-xs text-muted">
                  <p className="truncate font-semibold text-ink">{meta?.filename}</p>
                  {meta && (
                    <p className="font-mono">
                      {meta.width}×{meta.height} · {Math.ceil(meta.byteSize / 1024)} {t.common.kb}
                    </p>
                  )}
                  {meta?.mimeType === 'image/svg+xml' && <p>{m.svgNote}</p>}
                </div>
                <IconButton label={t.common.remove(variantLabels[kind])} size="sm" onClick={() => setVariant(kind, null)}>
                  <Trash2 size={16} />
                </IconButton>
              </div>
            ) : null}
            <Dropzone
              kind="logo"
              compact={Boolean(id)}
              label={id ? m.replaceFile : m.chooseFile}
              onAdded={(asset, notes) => {
                setVariant(kind, asset);
                notify(notes[0] ?? m.uploaded);
              }}
            />
          </Group>
        );
      })}
      <Group title={m.sizes}>
        <NumberInput
          label={m.clearSpace}
          unit={m.clearSpaceUnit}
          min={0}
          max={2}
          step={0.05}
          value={logo.clearSpace}
          onChange={(clearSpace) => update('logo', { clearSpace: clearSpace ?? 0 })}
          hint={m.clearSpaceHint}
        />
        <div className="grid grid-cols-2 gap-3">
          <NumberInput label={m.minSize} unit="px" min={0} max={2000} step={1} allowEmpty value={logo.minSizePx} onChange={(minSizePx) => update('logo', { minSizePx: minSizePx === null ? null : Math.round(minSizePx) })} />
          <NumberInput label={m.minSize} unit={m.mm} min={0} max={500} step={0.5} allowEmpty value={logo.minSizeMm} onChange={(minSizeMm) => update('logo', { minSizeMm })} />
        </div>
      </Group>
      <Group title={m.rules}>
        <Text label={m.usageRules} multiline maxLength={TEXT_LIMITS.longText} value={logo.usageRules} onChange={(usageRules) => update('logo', { usageRules }, 'logo.usageRules')} />
        <ListEditor label={m.allowed} itemLabel={m.item} items={logo.doRules} max={LIST_LIMITS.logoDoDont} onChange={(doRules) => update('logo', { doRules })} />
        <ListEditor label={m.forbidden} itemLabel={m.item} items={logo.dontRules} max={LIST_LIMITS.logoDoDont} onChange={(dontRules) => update('logo', { dontRules })} />
      </Group>
      <Group title={m.misuseTitle} hint={m.misuseHint}>
        {(['stretch', 'rotate', 'busyBackground'] as const).map((key) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-ink" checked={logo.misuse[key]} onChange={(e) => update('logo', { misuse: { ...logo.misuse, [key]: e.target.checked } })} />
            {m.misuse[key]}
          </label>
        ))}
      </Group>
      <Group title={m.previewTitle}>
        <ColorRefSelect label={m.previewColor} value={logo.previewColorId} onChange={(previewColorId) => update('logo', { previewColorId })} autoLabel={m.primaryColor} />
      </Group>
    </Panel>
  );
}

function FocalPicker({ url, x, y, onChange, label }: { url: string | undefined; x: number; y: number; onChange: (x: number, y: number) => void; label: string }) {
  const m = useMessages(inspectorMessages).imagery;
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
      aria-label={m.focalLabel(label)}
      aria-valuetext={m.focalValue(x, y)}
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
  const sections = useMessages(brandMessages).sections;
  const t = useMessages(inspectorMessages);
  const m = t.imagery;
  const im = project.brand.imagery;
  const setImages = (images: typeof im.images, key?: string) => update('imagery', { images }, key);

  return (
    <Panel title={sections.imagery} description={m.description(IMAGERY_MAX_IMAGES)}>
      {im.images.map((img, index) => (
        <Group key={img.id} title={m.image(index + 1)}>
          <FocalPicker url={urls.get(img.assetId)} x={img.focalX} y={img.focalY} label={m.image(index + 1)} onChange={(focalX, focalY) => setImages(im.images.map((x) => (x.id === img.id ? { ...x, focalX, focalY } : x)), `imagery.focal.${img.id}`)} />
          <Text label={m.caption} maxLength={TEXT_LIMITS.caption} value={img.caption} onChange={(caption) => setImages(im.images.map((x) => (x.id === img.id ? { ...x, caption } : x)), `imagery.caption.${img.id}`)} />
          <div className="flex gap-1">
            <IconButton label={t.common.moveUp(m.imageLower(index + 1))} size="sm" disabled={index === 0} onClick={() => setImages(swap(im.images, index, -1))}>
              <ChevronUp size={16} />
            </IconButton>
            <IconButton label={t.common.moveDown(m.imageLower(index + 1))} size="sm" disabled={index === im.images.length - 1} onClick={() => setImages(swap(im.images, index, 1))}>
              <ChevronDown size={16} />
            </IconButton>
            <IconButton label={m.removeImage(index + 1)} size="sm" onClick={() => setImages(im.images.filter((x) => x.id !== img.id))}>
              <Trash2 size={16} />
            </IconButton>
          </div>
        </Group>
      ))}
      {im.images.length < IMAGERY_MAX_IMAGES ? (
        <Dropzone
          kind="image"
          label={m.add}
          onAdded={(asset) =>
            apply((p) => {
              const next = withAsset(p, asset);
              const images = [...next.brand.imagery.images, { id: createId('i'), assetId: asset.id, caption: '', focalX: 50, focalY: 50 }];
              return { ...next, brand: { ...next.brand, imagery: { ...next.brand.imagery, images } } };
            })
          }
        />
      ) : (
        <p className="text-xs text-muted">{m.full(IMAGERY_MAX_IMAGES)}</p>
      )}
      <Group title={m.rules}>
        <Text label={m.lighting} multiline rows={3} maxLength={TEXT_LIMITS.longText} value={im.lighting} onChange={(lighting) => update('imagery', { lighting }, 'imagery.lighting')} />
        <Text label={m.composition} multiline rows={3} maxLength={TEXT_LIMITS.longText} value={im.composition} onChange={(composition) => update('imagery', { composition }, 'imagery.composition')} />
        <Text label={m.processing} multiline rows={3} maxLength={TEXT_LIMITS.longText} value={im.processing} onChange={(processing) => update('imagery', { processing }, 'imagery.processing')} />
        <Text label={m.avoid} multiline rows={3} maxLength={TEXT_LIMITS.longText} value={im.avoid} onChange={(avoid) => update('imagery', { avoid }, 'imagery.avoid')} />
      </Group>
    </Panel>
  );
}

function swap<T>(items: T[], index: number, dir: -1 | 1): T[] {
  const next = [...items];
  [next[index], next[index + dir]] = [next[index + dir]!, next[index]!];
  return next;
}
