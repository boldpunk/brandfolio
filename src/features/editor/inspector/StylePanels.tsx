import { SelectField } from '@/components/ui/Field';
import { FONT_FAMILIES, FONT_FAMILY_IDS, nearestWeight, pxToPt, WEIGHT_LABELS, type FontFamilyId } from '@/domain/fonts';
import { TEXT_LIMITS } from '@/domain/limits';
import type { MockupColors, Project, TypographyRole, TypographyStyle } from '@/domain/schema';
import { useEditorStore, useProject } from '../editorStore';
import { ColorRefSelect, Group, NumberInput, Panel, Text } from './fields';

const ROLE_LABELS: Record<TypographyRole, string> = { heading: 'Заголовки', body: 'Основной текст', caption: 'Подписи' };

export function TypographyPanel() {
  const project = useProject();
  const apply = useEditorStore((s) => s.apply);
  const set = (role: TypographyRole, patch: Partial<TypographyStyle>, key?: string) =>
    apply((p) => ({ ...p, brand: { ...p.brand, typography: { ...p.brand.typography, [role]: { ...p.brand.typography[role], ...patch } } } }), key);

  return (
    <Panel title="Типографика" description="Шрифты из встроенного набора с кириллицей и узбекской латиницей. В PDF размеры переводятся в pt: 1 px = 0.75 pt.">
      {(Object.keys(ROLE_LABELS) as TypographyRole[]).map((role) => {
        const style = project.brand.typography[role];
        const family = FONT_FAMILIES[style.familyId];
        return (
          <Group key={role} title={ROLE_LABELS[role]}>
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Шрифт"
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
              <SelectField label="Начертание" value={style.weight} onChange={(e) => set(role, { weight: Number(e.target.value) })}>
                {family.weights.map((w) => (
                  <option key={w} value={w}>
                    {WEIGHT_LABELS[w]} {w}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <NumberInput label="Размер" unit="px" min={8} max={96} step={1} value={style.sizePx} onChange={(v) => v !== null && set(role, { sizePx: v }, `type.${role}.size`)} hint={`${Math.round(pxToPt(style.sizePx) * 10) / 10} pt`} />
              <NumberInput label="Интерлиньяж" min={0.9} max={2.4} step={0.05} value={style.lineHeight} onChange={(v) => v !== null && set(role, { lineHeight: v }, `type.${role}.lh`)} />
              <NumberInput label="Трекинг" unit="em" min={-0.1} max={0.4} step={0.01} value={style.trackingEm} onChange={(v) => v !== null && set(role, { trackingEm: v }, `type.${role}.tr`)} />
            </div>
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

const MOCKUP_TITLES: Record<MockupKey, string> = {
  businessCard: 'Визитка',
  socialPost: 'Публикация для соцсетей',
  websiteHero: 'Первый экран сайта',
  packagingLabel: 'Этикетка упаковки',
};

export function ApplicationsPanel() {
  const project = useProject();
  const apply = useEditorStore((s) => s.apply);
  const m = project.brand.mockups;
  function set<K extends MockupKey>(key: K, patch: Partial<Project['brand']['mockups'][K]>, coalesce?: string) {
    apply((p) => ({ ...p, brand: { ...p.brand, mockups: { ...p.brand.mockups, [key]: { ...p.brand.mockups[key], ...patch } } } }), coalesce);
  }
  const colors = (key: MockupKey, value: MockupColors) => (
    <div className="grid gap-3">
      <ColorRefSelect label="Фон" value={value.backgroundColorId} onChange={(id) => set(key, { colors: { ...value, backgroundColorId: id } })} />
      <ColorRefSelect label="Текст" value={value.textColorId} onChange={(id) => set(key, { colors: { ...value, textColorId: id } })} autoLabel="Автоматически (читаемый)" />
      <ColorRefSelect label="Акцент" value={value.accentColorId} onChange={(id) => set(key, { colors: { ...value, accentColorId: id } })} />
    </div>
  );
  const enabled = (key: MockupKey) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" className="size-4 accent-ink" checked={m[key].enabled} onChange={(e) => set(key, { enabled: e.target.checked })} />
      Показывать в документе
    </label>
  );
  const L = TEXT_LIMITS.mockupText;
  return (
    <Panel title="Примеры применения" description="Логотип, палитра, шрифты и контакты берутся из проекта. Пустые тексты в макете не показываются.">
      <Group title={MOCKUP_TITLES.businessCard}>
        {enabled('businessCard')}
        <Text label="Имя" maxLength={L} value={m.businessCard.personName} onChange={(personName) => set('businessCard', { personName }, 'm.bc.name')} />
        <Text label="Должность" maxLength={L} value={m.businessCard.personRole} onChange={(personRole) => set('businessCard', { personRole }, 'm.bc.role')} />
        <Text label="Телефон" type="tel" inputMode="tel" maxLength={40} value={m.businessCard.phone} onChange={(phone) => set('businessCard', { phone }, 'm.bc.phone')} hint="Email и сайт берутся из раздела «Контакты»." />
        {colors('businessCard', m.businessCard.colors)}
      </Group>
      <Group title={MOCKUP_TITLES.socialPost}>
        {enabled('socialPost')}
        <Text label="Заголовок" multiline rows={2} maxLength={L} value={m.socialPost.headline} onChange={(headline) => set('socialPost', { headline }, 'm.sp.h')} />
        <Text label="Подпись" multiline rows={2} maxLength={L} value={m.socialPost.caption} onChange={(caption) => set('socialPost', { caption }, 'm.sp.c')} />
        {colors('socialPost', m.socialPost.colors)}
      </Group>
      <Group title={MOCKUP_TITLES.websiteHero}>
        {enabled('websiteHero')}
        <Text label="Заголовок" multiline rows={2} maxLength={L} value={m.websiteHero.headline} onChange={(headline) => set('websiteHero', { headline }, 'm.wh.h')} />
        <Text label="Подзаголовок" multiline rows={2} maxLength={L} value={m.websiteHero.subheadline} onChange={(subheadline) => set('websiteHero', { subheadline }, 'm.wh.s')} />
        <Text label="Текст кнопки" maxLength={40} value={m.websiteHero.ctaLabel} onChange={(ctaLabel) => set('websiteHero', { ctaLabel }, 'm.wh.c')} />
        {colors('websiteHero', m.websiteHero.colors)}
      </Group>
      <Group title={MOCKUP_TITLES.packagingLabel}>
        {enabled('packagingLabel')}
        <Text label="Название продукта" maxLength={L} value={m.packagingLabel.productName} onChange={(productName) => set('packagingLabel', { productName }, 'm.pl.n')} />
        <Text label="Описание" multiline rows={2} maxLength={L} value={m.packagingLabel.descriptor} onChange={(descriptor) => set('packagingLabel', { descriptor }, 'm.pl.d')} />
        <Text label="Объём / вес" maxLength={40} value={m.packagingLabel.netContent} onChange={(netContent) => set('packagingLabel', { netContent }, 'm.pl.v')} />
        {colors('packagingLabel', m.packagingLabel.colors)}
      </Group>
    </Panel>
  );
}
