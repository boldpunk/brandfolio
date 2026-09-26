import { SelectField } from '@/components/ui/Field';
import { FONT_FAMILIES, FONT_FAMILY_IDS, nearestWeight, pxToPt, WEIGHT_LABELS, type FontFamilyId } from '@/domain/fonts';
import { TEXT_LIMITS } from '@/domain/limits';
import { TYPOGRAPHY_ROLES, type MockupColors, type Project, type TypographyRole, type TypographyStyle } from '@/domain/schema';
import { useMessages } from '@/i18n/core';
import { brandMessages } from '@/i18n/messages/brand';
import { inspectorMessages } from '@/i18n/messages/inspector';
import { useEditorStore, useProject } from '../editorStore';
import { ColorRefSelect, Group, NumberInput, Panel, Text } from './fields';

export function TypographyPanel() {
  const project = useProject();
  const apply = useEditorStore((s) => s.apply);
  const brandText = useMessages(brandMessages);
  const m = useMessages(inspectorMessages).typography;
  const set = (role: TypographyRole, patch: Partial<TypographyStyle>, key?: string) =>
    apply((p) => ({ ...p, brand: { ...p.brand, typography: { ...p.brand.typography, [role]: { ...p.brand.typography[role], ...patch } } } }), key);

  return (
    <Panel title={brandText.sections.typography} description={m.description}>
      {TYPOGRAPHY_ROLES.map((role) => {
        const style = project.brand.typography[role];
        const family = FONT_FAMILIES[style.familyId];
        return (
          <Group key={role} title={brandText.typeRoles[role]}>
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label={m.font}
                value={style.familyId}
                onChange={(e) => {
                  const familyId = e.target.value as FontFamilyId;
                  set(role, { familyId, weight: nearestWeight(familyId, style.weight) });
                }}
              >
                {FONT_FAMILY_IDS.map((id) => (
                  <option key={id} value={id}>
                    {FONT_FAMILIES[id].label}
                  </option>
                ))}
              </SelectField>
              <SelectField label={m.weight} value={style.weight} onChange={(e) => set(role, { weight: Number(e.target.value) })}>
                {family.weights.map((w) => (
                  <option key={w} value={w}>
                    {WEIGHT_LABELS[w]} {w}
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
