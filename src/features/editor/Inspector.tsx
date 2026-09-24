import { SECTION_LABELS } from '@/domain/project';
import { TEMPLATE_INFO } from '@/templates/templateInfo';
import { useEditorStore, useProject } from './editorStore';
import { ImageryPanel, LogoPanel } from './inspector/AssetPanels';
import { ColorsPanel } from './inspector/ColorsPanel';
import { Panel } from './inspector/fields';
import { ApplicationsPanel, TypographyPanel } from './inspector/StylePanels';
import { AboutPanel, ContactsPanel, CoverPanel, VoicePanel } from './inspector/TextPanels';
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
  const hidden = project.sections.filter((s) => !s.visible);
  return (
    <Panel title="Весь документ" description="Оформление меняет композицию страниц. Тексты, порядок разделов, файлы и настройки бренда сохраняются.">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-bold">Оформление</legend>
        {TEMPLATE_INFO.map((t) => (
          <label key={t.id} className={cn('flex cursor-pointer items-start gap-3 rounded-md border p-3', project.templateId === t.id ? 'border-ink bg-paper' : 'border-line-strong')}>
            <input type="radio" name="doc-template" className="mt-1 accent-ink" checked={project.templateId === t.id} onChange={() => apply((p) => ({ ...p, templateId: t.id }))} />
            <span>
              <span className="block text-sm font-bold">{t.name}</span>
              <span className="block text-xs text-muted">{t.description}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {hidden.length > 0 && (
        <p className="text-sm text-muted">
          Скрыты: {hidden.map((s) => SECTION_LABELS[s.kind]).join(', ')}. Их можно включить в списке разделов.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {project.sections.map((s) => (
          <button key={s.kind} type="button" onClick={() => setView(s.kind)} className="rounded-md border border-line-strong px-2.5 py-1 text-xs font-semibold hover:bg-paper">
            {SECTION_LABELS[s.kind]}
          </button>
        ))}
      </div>
    </Panel>
  );
}
