import { Plus, Trash2 } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Field';
import { createId } from '@/domain/ids';
import { LIST_LIMITS, TEXT_LIMITS } from '@/domain/limits';
import { LOGO_VARIANTS, type LogoVariantKind } from '@/domain/schema';
import { useMessages } from '@/i18n/core';
import { brandMessages } from '@/i18n/messages/brand';
import { inspectorMessages } from '@/i18n/messages/inspector';
import { useBrandUpdater, useProject } from '../editorStore';
import { ColorRefSelect, Group, ListEditor, Panel, Text, useFieldErrors, useMissingGlyphWarning } from './fields';

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
  const brandText = useMessages(brandMessages);
  const m = useMessages(inspectorMessages).cover;
  const c = brand.cover;
  const e = (k: string) => errors.get(`brand.cover.${k}`);
  return (
    <Panel title={brandText.sections.cover} description={m.description}>
      <Text label={m.title} value={c.title} maxLength={TEXT_LIMITS.title} error={e('title')} onChange={(title) => update('cover', { title }, 'cover.title')} />
      <Text label={m.subtitle} value={c.subtitle} maxLength={TEXT_LIMITS.subtitle} multiline rows={3} error={e('subtitle')} onChange={(subtitle) => update('cover', { subtitle }, 'cover.subtitle')} />
      <div className="grid grid-cols-2 gap-3">
        <Text label={m.version} value={c.version} maxLength={40} error={e('version')} onChange={(version) => update('cover', { version }, 'cover.version')} />
        <Text label={m.date} type="date" value={c.date} maxLength={10} error={e('date')} onChange={(date) => update('cover', { date })} />
      </div>
      <Text label={m.author} value={c.author} maxLength={TEXT_LIMITS.short} error={e('author')} onChange={(author) => update('cover', { author }, 'cover.author')} />
      <SelectField label={m.logo} value={c.logoVariant} onChange={(ev) => update('cover', { logoVariant: ev.target.value as LogoVariantKind })} hint={m.logoHint}>
        {LOGO_VARIANTS.map((v) => (
          <option key={v} value={v}>
            {brandText.logoVariants[v]}
            {brand.logo.variants[v] ? '' : m.notUploaded}
          </option>
        ))}
      </SelectField>
      <ColorRefSelect label={m.background} value={c.backgroundColorId} onChange={(backgroundColorId) => update('cover', { backgroundColorId })} autoLabel={m.byTemplate} />
      <GlyphWarning texts={[c.title, c.subtitle, c.author]} />
    </Panel>
  );
}

export function AboutPanel() {
  const { brand } = useProject();
  const update = useBrandUpdater();
  const errors = useFieldErrors();
  const sections = useMessages(brandMessages).sections;
  const m = useMessages(inspectorMessages).about;
  const a = brand.about;
  const e = (k: string) => errors.get(`brand.about.${k}`);
  return (
    <Panel title={sections.about} description={m.description}>
      <Text label={m.summary} multiline rows={5} maxLength={TEXT_LIMITS.longText} value={a.description} error={e('description')} onChange={(description) => update('about', { description }, 'about.description')} />
      <Text label={m.mission} multiline maxLength={TEXT_LIMITS.longText} value={a.mission} error={e('mission')} onChange={(mission) => update('about', { mission }, 'about.mission')} />
      <ListEditor label={m.values} itemLabel={m.value} items={a.values} max={LIST_LIMITS.values} onChange={(values) => update('about', { values })} />
      <Text label={m.audience} multiline maxLength={TEXT_LIMITS.longText} value={a.audience} error={e('audience')} onChange={(audience) => update('about', { audience }, 'about.audience')} />
      <Text label={m.positioning} multiline maxLength={TEXT_LIMITS.longText} value={a.positioning} error={e('positioning')} onChange={(positioning) => update('about', { positioning }, 'about.positioning')} />
      <GlyphWarning texts={[a.description, a.mission, a.audience, a.positioning, ...a.values]} />
    </Panel>
  );
}

export function VoicePanel() {
  const { brand } = useProject();
  const update = useBrandUpdater();
  const sections = useMessages(brandMessages).sections;
  const m = useMessages(inspectorMessages).voice;
  const v = brand.voice;
  return (
    <Panel title={sections.voice} description={m.description}>
      {v.qualities.map((q, i) => (
        <Group key={q.id} title={m.quality(i + 1)}>
          <Text label={m.name} maxLength={60} value={q.title} onChange={(title) => update('voice', { qualities: v.qualities.map((x) => (x.id === q.id ? { ...x, title } : x)) }, `voice.q.${q.id}.title`)} />
          <Text
            label={m.qualityDescription}
            multiline
            rows={3}
            maxLength={TEXT_LIMITS.listItem}
            value={q.description}
            onChange={(description) => update('voice', { qualities: v.qualities.map((x) => (x.id === q.id ? { ...x, description } : x)) }, `voice.q.${q.id}.description`)}
          />
        </Group>
      ))}
      <Group title={m.rules}>
        <ListEditor label={m.rules} itemLabel={m.rule} items={v.rules} max={LIST_LIMITS.rules} onChange={(rules) => update('voice', { rules })} />
      </Group>
      <Group title={m.pairs}>
        {v.pairs.map((p, i) => (
          <div key={p.id} className="flex flex-col gap-3 rounded-md border border-line p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{m.example(i + 1)}</span>
              <IconButton label={m.removeExample(i + 1)} size="sm" onClick={() => update('voice', { pairs: v.pairs.filter((x) => x.id !== p.id) })}>
                <Trash2 size={14} />
              </IconButton>
            </div>
            <Text label={m.say} multiline rows={2} maxLength={TEXT_LIMITS.listItem} value={p.say} onChange={(say) => update('voice', { pairs: v.pairs.map((x) => (x.id === p.id ? { ...x, say } : x)) }, `voice.p.${p.id}.say`)} />
            <Text label={m.avoid} multiline rows={2} maxLength={TEXT_LIMITS.listItem} value={p.avoid} onChange={(avoid) => update('voice', { pairs: v.pairs.map((x) => (x.id === p.id ? { ...x, avoid } : x)) }, `voice.p.${p.id}.avoid`)} />
          </div>
        ))}
        <Button size="sm" icon={<Plus size={14} />} className="self-start" disabled={v.pairs.length >= LIST_LIMITS.voicePairs} onClick={() => update('voice', { pairs: [...v.pairs, { id: createId('v'), say: '', avoid: '' }] })}>
          {m.addExample}
        </Button>
      </Group>
    </Panel>
  );
}

export function ContactsPanel() {
  const { brand } = useProject();
  const update = useBrandUpdater();
  const errors = useFieldErrors();
  const sections = useMessages(brandMessages).sections;
  const m = useMessages(inspectorMessages).contacts;
  const c = brand.contacts;
  const e = (k: string) => errors.get(`brand.contacts.${k}`);
  return (
    <Panel title={sections.contacts} description={m.description}>
      <Text label={m.organization} value={c.organization} maxLength={TEXT_LIMITS.short} error={e('organization')} onChange={(organization) => update('contacts', { organization }, 'contacts.organization')} />
      <Text label={m.email} type="email" inputMode="email" value={c.email} maxLength={254} error={e('email')} onChange={(email) => update('contacts', { email: email.trim() }, 'contacts.email')} />
      <Text label={m.website} type="url" inputMode="url" value={c.website} maxLength={300} error={e('website')} hint={m.websiteHint} placeholder="https://" onChange={(website) => update('contacts', { website: website.trim() }, 'contacts.website')} />
      <Text label={m.usageNote} multiline maxLength={TEXT_LIMITS.longText} value={c.usageNote} error={e('usageNote')} onChange={(usageNote) => update('contacts', { usageNote }, 'contacts.usageNote')} />
    </Panel>
  );
}
