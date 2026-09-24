import { Plus, Trash2 } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Field';
import { createId } from '@/domain/ids';
import { LIST_LIMITS, TEXT_LIMITS } from '@/domain/limits';
import { LOGO_VARIANTS, type LogoVariantKind } from '@/domain/schema';
import { useBrandUpdater, useProject } from '../editorStore';
import { ColorRefSelect, Group, ListEditor, Panel, Text, useFieldErrors, useMissingGlyphWarning } from './fields';

const LOGO_VARIANT_LABELS: Record<LogoVariantKind, string> = { primary: 'Основной', alternative: 'Альтернативный', mark: 'Знак', light: 'Светлая версия' };

function GlyphWarning({ texts }: { texts: string[] }) {
  const warning = useMissingGlyphWarning(texts);
  return warning ? (
    <p role="note" className="rounded-md border border-line-strong bg-paper p-3 text-xs">
      {warning}
    </p>
  ) : null;
}

export function CoverPanel() {
  const { brand } = useProject();
  const update = useBrandUpdater();
  const errors = useFieldErrors();
  const c = brand.cover;
  const e = (k: string) => errors.get(`brand.cover.${k}`);
  return (
    <Panel title="Обложка" description="Первая страница документа. Если название не заполнено, используется название проекта.">
      <Text label="Название" value={c.title} maxLength={TEXT_LIMITS.title} error={e('title')} onChange={(title) => update('cover', { title }, 'cover.title')} />
      <Text label="Подзаголовок" value={c.subtitle} maxLength={TEXT_LIMITS.subtitle} multiline rows={3} error={e('subtitle')} onChange={(subtitle) => update('cover', { subtitle }, 'cover.subtitle')} />
      <div className="grid grid-cols-2 gap-3">
        <Text label="Версия" value={c.version} maxLength={40} error={e('version')} onChange={(version) => update('cover', { version }, 'cover.version')} />
        <Text label="Дата" type="date" value={c.date} maxLength={10} error={e('date')} onChange={(date) => update('cover', { date })} />
      </div>
      <Text label="Автор" value={c.author} maxLength={TEXT_LIMITS.short} error={e('author')} onChange={(author) => update('cover', { author }, 'cover.author')} />
      <SelectField label="Логотип на обложке" value={c.logoVariant} onChange={(ev) => update('cover', { logoVariant: ev.target.value as LogoVariantKind })} hint="Если выбранный вариант не загружен, используется основной.">
        {LOGO_VARIANTS.map((v) => (
          <option key={v} value={v}>
            {LOGO_VARIANT_LABELS[v]}
            {brand.logo.variants[v] ? '' : ' (не загружен)'}
          </option>
        ))}
      </SelectField>
      <ColorRefSelect label="Фон обложки" value={c.backgroundColorId} onChange={(backgroundColorId) => update('cover', { backgroundColorId })} autoLabel="По оформлению" />
      <GlyphWarning texts={[c.title, c.subtitle, c.author]} />
    </Panel>
  );
}

export function AboutPanel() {
  const { brand } = useProject();
  const update = useBrandUpdater();
  const errors = useFieldErrors();
  const a = brand.about;
  const e = (k: string) => errors.get(`brand.about.${k}`);
  return (
    <Panel title="О бренде" description="Эти тексты пишете вы. Пустые поля не попадут в документ.">
      <Text label="Краткое описание" multiline rows={5} maxLength={TEXT_LIMITS.longText} value={a.description} error={e('description')} onChange={(description) => update('about', { description }, 'about.description')} />
      <Text label="Миссия" multiline maxLength={TEXT_LIMITS.longText} value={a.mission} error={e('mission')} onChange={(mission) => update('about', { mission }, 'about.mission')} />
      <ListEditor label="Ценности" itemLabel="Ценность" items={a.values} max={LIST_LIMITS.values} onChange={(values) => update('about', { values })} />
      <Text label="Аудитория" multiline maxLength={TEXT_LIMITS.longText} value={a.audience} error={e('audience')} onChange={(audience) => update('about', { audience }, 'about.audience')} />
      <Text label="Позиционирование" multiline maxLength={TEXT_LIMITS.longText} value={a.positioning} error={e('positioning')} onChange={(positioning) => update('about', { positioning }, 'about.positioning')} />
      <GlyphWarning texts={[a.description, a.mission, a.audience, a.positioning, ...a.values]} />
    </Panel>
  );
}

export function VoicePanel() {
  const { brand } = useProject();
  const update = useBrandUpdater();
  const v = brand.voice;
  return (
    <Panel title="Тон общения" description="Три качества голоса бренда, правила и примеры фраз.">
      {v.qualities.map((q, i) => (
        <Group key={q.id} title={`Качество ${i + 1}`}>
          <Text label="Название" maxLength={60} value={q.title} onChange={(title) => update('voice', { qualities: v.qualities.map((x) => (x.id === q.id ? { ...x, title } : x)) }, `voice.q.${q.id}.title`)} />
          <Text
            label="Описание"
            multiline
            rows={3}
            maxLength={TEXT_LIMITS.listItem}
            value={q.description}
            onChange={(description) => update('voice', { qualities: v.qualities.map((x) => (x.id === q.id ? { ...x, description } : x)) }, `voice.q.${q.id}.description`)}
          />
        </Group>
      ))}
      <Group title="Правила">
        <ListEditor label="Правила" itemLabel="Правило" items={v.rules} max={LIST_LIMITS.rules} onChange={(rules) => update('voice', { rules })} />
      </Group>
      <Group title="Так говорим / Так не говорим">
        {v.pairs.map((p, i) => (
          <div key={p.id} className="flex flex-col gap-3 rounded-md border border-line p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Пример {i + 1}</span>
              <IconButton label={`Удалить пример ${i + 1}`} size="sm" onClick={() => update('voice', { pairs: v.pairs.filter((x) => x.id !== p.id) })}>
                <Trash2 size={14} />
              </IconButton>
            </div>
            <Text label="Так говорим" multiline rows={2} maxLength={TEXT_LIMITS.listItem} value={p.say} onChange={(say) => update('voice', { pairs: v.pairs.map((x) => (x.id === p.id ? { ...x, say } : x)) }, `voice.p.${p.id}.say`)} />
            <Text label="Так не говорим" multiline rows={2} maxLength={TEXT_LIMITS.listItem} value={p.avoid} onChange={(avoid) => update('voice', { pairs: v.pairs.map((x) => (x.id === p.id ? { ...x, avoid } : x)) }, `voice.p.${p.id}.avoid`)} />
          </div>
        ))}
        <Button size="sm" icon={<Plus size={14} />} className="self-start" disabled={v.pairs.length >= LIST_LIMITS.voicePairs} onClick={() => update('voice', { pairs: [...v.pairs, { id: createId('v'), say: '', avoid: '' }] })}>
          Добавить пример
        </Button>
      </Group>
    </Panel>
  );
}

export function ContactsPanel() {
  const { brand } = useProject();
  const update = useBrandUpdater();
  const errors = useFieldErrors();
  const c = brand.contacts;
  const e = (k: string) => errors.get(`brand.contacts.${k}`);
  return (
    <Panel title="Контакты" description="Раздел можно скрыть в списке разделов. Email и сайт также используются в макетах.">
      <Text label="Автор / организация" value={c.organization} maxLength={TEXT_LIMITS.short} error={e('organization')} onChange={(organization) => update('contacts', { organization }, 'contacts.organization')} />
      <Text label="Email" type="email" inputMode="email" value={c.email} maxLength={254} error={e('email')} onChange={(email) => update('contacts', { email: email.trim() }, 'contacts.email')} />
      <Text label="Сайт" type="url" inputMode="url" value={c.website} maxLength={300} error={e('website')} hint="Полный адрес с https://" placeholder="https://" onChange={(website) => update('contacts', { website: website.trim() }, 'contacts.website')} />
      <Text label="Примечание об использовании материалов" multiline maxLength={TEXT_LIMITS.longText} value={c.usageNote} error={e('usageNote')} onChange={(usageNote) => update('contacts', { usageNote }, 'contacts.usageNote')} />
    </Panel>
  );
}
