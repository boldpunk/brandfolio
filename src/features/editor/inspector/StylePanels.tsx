import { SelectField } from '@/components/ui/Field';
import { Trash2, X } from 'lucide-react';
import { IconButton } from '@/components/ui/Button';
import { ProBadge } from '@/components/ui/ProBadge';
import { useNotify } from '@/components/ui/Announcer';
import { customCssFamily, FONT_FAMILIES, FONT_FAMILY_IDS, pxToPt, resolveFamily, WEIGHT_LABELS } from '@/domain/fonts';
import { CUSTOM_FONT_LIMITS, TEXT_LIMITS } from '@/domain/limits';
import { CUSTOM_FONT_CATEGORIES, TYPOGRAPHY_ROLES, type Asset, type CustomFont, type MockupColors, type Project, type TypographyRole, type TypographyStyle } from '@/domain/schema';
import type { FontInfo } from '@/features/assets/fontInfo';
import { addFontFile, applyFontToRole, removeFont, removeFontFile, updateFont } from '@/features/fonts/fontOperations';
import { useMessages } from '@/i18n/core';
import { brandMessages } from '@/i18n/messages/brand';
import { inspectorMessages } from '@/i18n/messages/inspector';
import { useEditorStore, useProject } from '../editorStore';
import { Dropzone } from './Dropzone';
import { ColorRefSelect, Group, NumberInput, Panel, Text } from './fields';

export function TypographyPanel() {
  const project = useProject();
  const apply = useEditorStore((s) => s.apply);
  const brandText = useMessages(brandMessages);
  const m = useMessages(inspectorMessages).typography;
  const customFonts = project.brand.customFonts;
  const set = (role: TypographyRole, patch: Partial<TypographyStyle>, key?: string) =>
    apply((p) => ({ ...p, brand: { ...p.brand, typography: { ...p.brand.typography, [role]: { ...p.brand.typography[role], ...patch } } } }), key);

  return (
    <Panel title={brandText.sections.typography} description={m.description}>
      <BrandFontsGroup />
      {TYPOGRAPHY_ROLES.map((role) => {
        const style = project.brand.typography[role];
        const family = resolveFamily(style.familyId, customFonts);
        return (
          <Group key={role} title={brandText.typeRoles[role]}>
            <div className="grid grid-cols-2 gap-3">
              <SelectField label={m.font} value={style.familyId} onChange={(e) => apply((p) => applyFontToRole(p, role, e.target.value))}>
                <optgroup label={m.builtIn}>
                  {FONT_FAMILY_IDS.map((id) => (
                    <option key={id} value={id}>
                      {FONT_FAMILIES[id].label}
                    </option>
                  ))}
                </optgroup>
                {customFonts.length > 0 && (
                  <optgroup label={m.brandGroup}>
                    {customFonts.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </SelectField>
              <SelectField label={m.weight} value={style.weight} onChange={(e) => set(role, { weight: Number(e.target.value) })}>
                {family.weights.map((w) => (
                  <option key={w} value={w}>
                    {WEIGHT_LABELS[w] ?? w} {w}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <NumberInput label={m.size} unit="px" min={8} max={96} step={1} value={style.sizePx} onChange={(v) => v !== null && set(role, { sizePx: v }, `type.${role}.size`)} hint={`${Math.round(pxToPt(style.sizePx) * 10) / 10} pt`} />
              <NumberInput label={m.lineHeight} min={0.9} max={2.4} step={0.05} value={style.lineHeight} onChange={(v) => v !== null && set(role, { lineHeight: v }, `type.${role}.lh`)} />
              <NumberInput label={m.tracking} unit="em" min={-0.1} max={0.4} step={0.01} value={style.trackingEm} onChange={(v) => v !== null && set(role, { trackingEm: v }, `type.${role}.tr`)} />
            </div>
            {/* Glyph sample in both scripts on purpose; not translated. */}
            <p
              className="overflow-hidden rounded-md bg-paper p-3 break-words"
              style={{ fontFamily: `'${family.cssFamily}'`, fontWeight: style.weight, fontSize: Math.min(style.sizePx, 40), lineHeight: style.lineHeight, letterSpacing: `${style.trackingEm}em` }}
            >
              Съешь ещё O‘zbekiston 0123
            </p>
          </Group>
        );
      })}
    </Panel>
  );
}

/** Upload and manage the brand's own font files (Pro). */
function BrandFontsGroup() {
  const project = useProject();
  const apply = useEditorStore((s) => s.apply);
  const notify = useNotify();
  const typeRoles = useMessages(brandMessages).typeRoles;
  const m = useMessages(inspectorMessages).typography.brandFonts;
  const fonts = project.brand.customFonts;

  const onAdded = (asset: Asset, notes: string[], info: FontInfo | undefined, intoFontId?: string) => {
    if (!info) return;
    const result = addFontFile(project, asset, info, intoFontId);
    if (!result.ok) {
      notify(result.reason === 'families' ? m.tooManyFamilies(CUSTOM_FONT_LIMITS.families) : m.tooManyFiles(CUSTOM_FONT_LIMITS.filesPerFamily));
      return;
    }
    // Re-run on the latest state: several files may be added one after another.
    apply((p) => {
      const next = addFontFile(p, asset, info, intoFontId ?? (p.brand.customFonts.some((f) => f.id === result.fontId) ? result.fontId : undefined));
      return next.ok ? next.project : p;
    });
    const name = result.project.brand.customFonts.find((f) => f.id === result.fontId)?.name ?? '';
    notify(notes[0] ?? (result.replaced ? m.replaced(name, info.weight) : m.added(name, info.weight)));
  };

  return (
    <Group
      title={m.title}
      hint={
        <>
          <ProBadge className="mr-1" />
          {m.hint} {m.proHint}
        </>
      }
    >
      {fonts.map((font) => {
        const family = customCssFamily(font);
        const usedBy = TYPOGRAPHY_ROLES.filter((r) => project.brand.typography[r].familyId === font.id);
        return (
          <div key={font.id} className="grid gap-3 rounded-md border border-line p-3">
            <div className="flex items-start gap-2">
              <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto] gap-3">
                <Text label={m.name} maxLength={60} value={font.name} onChange={(name) => apply((p) => updateFont(p, font.id, { name }), `font.${font.id}.name`)} />
                <SelectField label={m.category} value={font.category} onChange={(e) => apply((p) => updateFont(p, font.id, { category: e.target.value as CustomFont['category'] }))}>
                  {CUSTOM_FONT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {m.categories[c]}
                    </option>
                  ))}
                </SelectField>
              </div>
              <IconButton label={m.remove(font.name)} size="sm" className="mt-6" onClick={() => apply((p) => removeFont(p, font.id))}>
                <Trash2 size={16} />
              </IconButton>
            </div>
            <ul aria-label={m.weights} className="grid gap-1">
              {font.files.map((file) => (
                <li key={file.weight} className="flex items-center gap-2 rounded-md bg-paper px-3 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-lg" style={{ fontFamily: `'${family}'`, fontWeight: file.weight }}>
                    Aa Бб O‘o‘ {WEIGHT_LABELS[file.weight] ?? file.weight}
                  </span>
                  <span className="font-mono text-xs text-muted">{file.weight}</span>
                  <IconButton label={m.removeWeight(font.name, String(file.weight))} size="sm" onClick={() => apply((p) => removeFontFile(p, font.id, file.weight))}>
                    <X size={14} />
                  </IconButton>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted">{m.useFor}:</span>
              {TYPOGRAPHY_ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  aria-pressed={usedBy.includes(role)}
                  onClick={() => apply((p) => applyFontToRole(p, role, font.id))}
                  className="h-7 rounded-full border border-line-strong px-3 font-semibold aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-paper"
                >
                  {typeRoles[role]}
                </button>
              ))}
            </div>
            {font.files.length < CUSTOM_FONT_LIMITS.filesPerFamily && <Dropzone kind="font" compact label={m.addWeight} onAdded={(asset, notes, info) => onAdded(asset, notes, info, font.id)} />}
          </div>
        );
      })}
      {fonts.length > 0 && <p className="text-xs text-muted">{m.coverage}</p>}
      {fonts.length < CUSTOM_FONT_LIMITS.families && <Dropzone kind="font" label={m.upload} onAdded={(asset, notes, info) => onAdded(asset, notes, info)} />}
    </Group>
  );
}

type MockupKey = keyof Project['brand']['mockups'];

export function ApplicationsPanel() {
  const project = useProject();
  const apply = useEditorStore((s) => s.apply);
  const mockups = project.brand.mockups;
  const sections = useMessages(brandMessages).sections;
  const t = useMessages(inspectorMessages).applications;
  function set<K extends MockupKey>(key: K, patch: Partial<Project['brand']['mockups'][K]>, coalesce?: string) {
    apply((p) => ({ ...p, brand: { ...p.brand, mockups: { ...p.brand.mockups, [key]: { ...p.brand.mockups[key], ...patch } } } }), coalesce);
  }
  const colors = (key: MockupKey, value: MockupColors) => (
    <div className="grid gap-3">
      <ColorRefSelect label={t.background} value={value.backgroundColorId} onChange={(id) => set(key, { colors: { ...value, backgroundColorId: id } })} />
      <ColorRefSelect label={t.text} value={value.textColorId} onChange={(id) => set(key, { colors: { ...value, textColorId: id } })} autoLabel={t.autoReadable} />
      <ColorRefSelect label={t.accent} value={value.accentColorId} onChange={(id) => set(key, { colors: { ...value, accentColorId: id } })} />
    </div>
  );
  const enabled = (key: MockupKey) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" className="size-4 accent-ink" checked={mockups[key].enabled} onChange={(e) => set(key, { enabled: e.target.checked })} />
      {t.show}
    </label>
  );
  const L = TEXT_LIMITS.mockupText;
  return (
    <Panel title={sections.applications} description={t.description}>
      <Group title={t.titles.businessCard}>
        {enabled('businessCard')}
        <Text label={t.personName} maxLength={L} value={mockups.businessCard.personName} onChange={(personName) => set('businessCard', { personName }, 'm.bc.name')} />
        <Text label={t.personRole} maxLength={L} value={mockups.businessCard.personRole} onChange={(personRole) => set('businessCard', { personRole }, 'm.bc.role')} />
        <Text label={t.phone} type="tel" inputMode="tel" maxLength={40} value={mockups.businessCard.phone} onChange={(phone) => set('businessCard', { phone }, 'm.bc.phone')} hint={t.phoneHint} />
        {colors('businessCard', mockups.businessCard.colors)}
      </Group>
      <Group title={t.titles.socialPost}>
        {enabled('socialPost')}
        <Text label={t.headline} multiline rows={2} maxLength={L} value={mockups.socialPost.headline} onChange={(headline) => set('socialPost', { headline }, 'm.sp.h')} />
        <Text label={t.caption} multiline rows={2} maxLength={L} value={mockups.socialPost.caption} onChange={(caption) => set('socialPost', { caption }, 'm.sp.c')} />
        {colors('socialPost', mockups.socialPost.colors)}
      </Group>
      <Group title={t.titles.websiteHero}>
        {enabled('websiteHero')}
        <Text label={t.headline} multiline rows={2} maxLength={L} value={mockups.websiteHero.headline} onChange={(headline) => set('websiteHero', { headline }, 'm.wh.h')} />
        <Text label={t.subheadline} multiline rows={2} maxLength={L} value={mockups.websiteHero.subheadline} onChange={(subheadline) => set('websiteHero', { subheadline }, 'm.wh.s')} />
        <Text label={t.cta} maxLength={40} value={mockups.websiteHero.ctaLabel} onChange={(ctaLabel) => set('websiteHero', { ctaLabel }, 'm.wh.c')} />
        {colors('websiteHero', mockups.websiteHero.colors)}
      </Group>
      <Group title={t.titles.packagingLabel}>
        {enabled('packagingLabel')}
        <Text label={t.productName} maxLength={L} value={mockups.packagingLabel.productName} onChange={(productName) => set('packagingLabel', { productName }, 'm.pl.n')} />
        <Text label={t.descriptor} multiline rows={2} maxLength={L} value={mockups.packagingLabel.descriptor} onChange={(descriptor) => set('packagingLabel', { descriptor }, 'm.pl.d')} />
        <Text label={t.netContent} maxLength={40} value={mockups.packagingLabel.netContent} onChange={(netContent) => set('packagingLabel', { netContent }, 'm.pl.v')} />
        {colors('packagingLabel', mockups.packagingLabel.colors)}
      </Group>
    </Panel>
  );
}
