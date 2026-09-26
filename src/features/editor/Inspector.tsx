import { SelectField } from '@/components/ui/Field';
import { LOCALE_NAMES, LOCALE_TAGS, LOCALES, useMessages, type Locale } from '@/i18n/core';
import { brandMessages } from '@/i18n/messages/brand';
import { editorMessages } from '@/i18n/messages/editor';
import { useTemplateInfo } from '@/templates/templateInfo';
import { ProBadge } from '@/components/ui/ProBadge';
import { useEditorStore, useProject } from './editorStore';
import { ImageryPanel, LogoPanel } from './inspector/AssetPanels';
import { ColorsPanel } from './inspector/ColorsPanel';
import { Panel } from './inspector/fields';
import { ApplicationsPanel, TypographyPanel } from './inspector/StylePanels';
import { AboutPanel, ContactsPanel, CoverPanel, VoicePanel } from './inspector/TextPanels';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/cn';

/** Right-hand settings for the selected section. */
export function Inspector() {
  const view = useEditorStore((s) => s.view);
  switch (view) {
    case 'all':
      return <DocumentPanel />;
    case 'cover':
      return <CoverPanel />;
    case 'about':
      return <AboutPanel />;
    case 'logo':
      return <LogoPanel />;
    case 'colors':
      return <ColorsPanel />;
    case 'typography':
      return <TypographyPanel />;
    case 'imagery':
      return <ImageryPanel />;
    case 'voice':
      return <VoicePanel />;
    case 'applications':
      return <ApplicationsPanel />;
    case 'contacts':
      return <ContactsPanel />;
  }
}

function DocumentPanel() {
  const project = useProject();
  const apply = useEditorStore((s) => s.apply);
  const setView = useEditorStore((s) => s.setView);
  const m = useMessages(editorMessages).document;
  const labels = useMessages(brandMessages).sections;
  const templates = useTemplateInfo();
  const hidden = project.sections.filter((s) => !s.visible);
  return (
    <Panel title={m.title} description={m.description}>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-bold">{m.template}</legend>
        {templates.map((t) => (
          <label key={t.id} className={cn('flex cursor-pointer items-start gap-3 rounded-md border p-3', project.templateId === t.id ? 'border-ink bg-paper' : 'border-line-strong')}>
            <input type="radio" name="doc-template" className="mt-1 accent-ink" checked={project.templateId === t.id} onChange={() => {
                apply((p) => ({ ...p, templateId: t.id }));
                track('template_changed', { template: t.id });
              }} />
            <span>
              <span className="flex items-center gap-2 text-sm font-bold">
                {t.name}
                {t.premium && <ProBadge />}
              </span>
              <span className="block text-xs text-muted">{t.description}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {/* Labels inside the document follow this language; the interface language is separate. */}
      <SelectField label={m.language} hint={m.languageHint} value={project.language} onChange={(e) => {
          const language = e.target.value as Locale;
          apply((p) => ({ ...p, language }));
          track('document_language_changed', { to: language });
        }}
      >
        {LOCALES.map((locale) => (
          <option key={locale} value={locale} lang={LOCALE_TAGS[locale]}>
            {LOCALE_NAMES[locale]}
          </option>
        ))}
      </SelectField>
      {hidden.length > 0 && <p className="text-sm text-muted">{m.hidden(hidden.map((s) => labels[s.kind]).join(', '))}</p>}
      <div className="flex flex-wrap gap-2">
        {project.sections.map((s) => (
          <button key={s.kind} type="button" onClick={() => setView(s.kind)} className="rounded-md border border-line-strong px-2.5 py-1 text-xs font-semibold hover:bg-paper">
            {labels[s.kind]}
          </button>
        ))}
      </div>
    </Panel>
  );
}
