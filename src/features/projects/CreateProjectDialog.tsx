import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { SelectField, TextField } from '@/components/ui/Field';
import { TEXT_LIMITS } from '@/domain/limits';
import { createEmptyProject } from '@/domain/project';
import type { TemplateId } from '@/domain/schema';
import { LOCALE_NAMES, LOCALE_TAGS, LOCALES, isLocale, useLocale, useMessages, type Locale } from '@/i18n/core';
import { projectsMessages } from '@/i18n/messages/projects';
import { validationMessages } from '@/i18n/messages/validation';
import { cn } from '@/lib/cn';
import { useUiSettings } from '@/lib/uiSettings';
import { createProject } from '@/storage/projectRepository';
import { useTemplateInfo } from '@/templates/templateInfo';
import { track } from '@/lib/analytics';

export function CreateProjectDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: (id: string) => void }) {
  const { defaultTemplate } = useUiSettings();
  const [title, setTitle] = useState('');
  const [template, setTemplate] = useState<TemplateId>(defaultTemplate);
  const interfaceLocale = useLocale();
  // null follows the interface language until the user picks one.
  const [pickedLanguage, setPickedLanguage] = useState<Locale | null>(null);
  const language = pickedLanguage ?? interfaceLocale;
  const texts = useMessages(projectsMessages);
  const m = texts.createDialog;
  const templates = useTemplateInfo();
  const v = useMessages(validationMessages);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const name = title.trim();
    if (!name) return setError(v.titleRequired);
    if (name.length > TEXT_LIMITS.title) return setError(v.maxChars(TEXT_LIMITS.title));
    setBusy(true);
    try {
      const project = createEmptyProject(name, template, new Date(), language);
      track('project_created', { template, language });
      project.brand.cover.title = name;
      await createProject(project);
      onOpenChange(false);
      setTitle('');
      setPickedLanguage(null);
      onCreated(project.id);
    } catch (e) {
      setError(m.saveFailed(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={m.title}
      description={m.description}
    >
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <TextField
          label={m.name}
          value={title}
          maxLength={TEXT_LIMITS.title}
          error={error}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(null);
          }}
          autoFocus
          autoComplete="off"
        />
        <SelectField
          label={m.language}
          hint={m.languageHint}
          value={language}
          onChange={(e) => isLocale(e.target.value) && setPickedLanguage(e.target.value)}
        >
          {LOCALES.map((l) => (
            <option key={l} value={l} lang={LOCALE_TAGS[l]}>
              {LOCALE_NAMES[l]}
            </option>
          ))}
        </SelectField>
        <fieldset>
          <legend className="text-sm font-semibold">{m.template}</legend>
          <p className="mt-1 text-xs text-muted">{m.templateHint}</p>
          <div className="mt-2 grid gap-2">
            {templates.map((info) => (
              <label
                key={info.id}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-md border p-3',
                  template === info.id ? 'border-ink bg-paper' : 'border-line-strong bg-panel',
                )}
              >
                <input type="radio" name="template" value={info.id} checked={template === info.id} onChange={() => setTemplate(info.id)} className="mt-1 accent-ink" />
                <span>
                  <span className="block text-sm font-bold">{info.name}</span>
                  <span className="block text-xs text-muted">{info.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex justify-end gap-2">
          <Button onClick={() => onOpenChange(false)}>{texts.cancel}</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? m.creating : m.create}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
