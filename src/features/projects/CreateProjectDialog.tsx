import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { TextField } from '@/components/ui/Field';
import { TEXT_LIMITS } from '@/domain/limits';
import { createEmptyProject } from '@/domain/project';
import type { TemplateId } from '@/domain/schema';
import { TEMPLATE_INFO } from '@/templates/templateInfo';
import { cn } from '@/lib/cn';
import { useUiSettings } from '@/lib/uiSettings';
import { createProject } from '@/storage/projectRepository';

export function CreateProjectDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: (id: string) => void }) {
  const { defaultTemplate } = useUiSettings();
  const [title, setTitle] = useState('');
  const [template, setTemplate] = useState<TemplateId>(defaultTemplate);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const name = title.trim();
    if (!name) return setError('Введите название проекта');
    if (name.length > TEXT_LIMITS.title) return setError(`Не длиннее ${TEXT_LIMITS.title} символов`);
    setBusy(true);
    try {
      const project = createEmptyProject(name, template);
      project.brand.cover.title = name;
      await createProject(project);
      onOpenChange(false);
      setTitle('');
      onCreated(project.id);
    } catch (e) {
      setError(`Не удалось сохранить проект: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Новый брендбук"
      description="Проект создаётся пустым. Все тексты, цвета и файлы вы добавите сами в редакторе."
    >
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <TextField
          label="Название бренда"
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
        <fieldset>
          <legend className="text-sm font-semibold">Оформление</legend>
          <p className="mt-1 text-xs text-muted">Его можно сменить в любой момент, данные при этом сохраняются.</p>
          <div className="mt-2 grid gap-2">
            {TEMPLATE_INFO.map((info) => (
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
          <Button onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Создаём…' : 'Создать'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
