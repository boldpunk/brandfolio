import { ChevronDown, ChevronUp, Eye, EyeOff, Files, GripVertical } from 'lucide-react';
import { useState, type DragEvent } from 'react';
import { IconButton } from '@/components/ui/Button';
import { useNotify } from '@/components/ui/Announcer';
import { canHideSection, moveSection, placeSection, setSectionVisible } from '@/domain/operations';
import { SECTION_LABELS } from '@/domain/project';
import type { SectionKind } from '@/domain/schema';
import { cn } from '@/lib/cn';
import { useEditorStore, useProject } from './editorStore';

/**
 * Section list: select, hide, and reorder with drag-and-drop or with the
 * "up"/"down" buttons (keyboard and touch alternative). The cover stays first.
 */
export function SectionNav({ onPicked }: { onPicked?: () => void }) {
  const project = useProject();
  const view = useEditorStore((s) => s.view);
  const setView = useEditorStore((s) => s.setView);
  const apply = useEditorStore((s) => s.apply);
  const notify = useNotify();
  const [dragging, setDragging] = useState<SectionKind | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const pick = (next: typeof view) => {
    setView(next);
    onPicked?.();
  };

  const move = (kind: SectionKind, dir: -1 | 1) => {
    apply((p) => moveSection(p, kind, dir));
    const index = project.sections.findIndex((s) => s.kind === kind) + dir;
    notify(`«${SECTION_LABELS[kind]}» теперь на позиции ${index + 1}`);
  };

  const onDrop = (event: DragEvent, index: number) => {
    event.preventDefault();
    if (dragging) apply((p) => placeSection(p, dragging, index));
    setDragging(null);
    setDropIndex(null);
  };

  return (
    <nav aria-label="Разделы брендбука" className="flex flex-col gap-1 p-3">
      <button
        type="button"
        onClick={() => pick('all')}
        aria-current={view === 'all' ? 'page' : undefined}
        className={cn('flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold', view === 'all' ? 'bg-ink text-white' : 'hover:bg-ink/5')}
      >
        <Files size={16} /> Весь документ
      </button>
      <p className="mt-3 mb-1 px-3 text-xs font-semibold tracking-wide text-muted uppercase">Разделы</p>
      <ol className="flex flex-col gap-0.5">
        {project.sections.map((section, index) => {
          const isCover = section.kind === 'cover';
          const active = view === section.kind;
          const hideBlocked = section.visible && !canHideSection(project, section.kind);
          return (
            <li
              key={section.kind}
              draggable={!isCover}
              onDragStart={(e) => {
                setDragging(section.kind);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', section.kind);
              }}
              onDragEnd={() => {
                setDragging(null);
                setDropIndex(null);
              }}
              onDragOver={(e) => {
                if (!dragging || isCover) return;
                e.preventDefault();
                setDropIndex(index);
              }}
              onDrop={(e) => onDrop(e, index)}
              className={cn(
                'group flex items-center gap-1 rounded-md pr-1',
                active ? 'bg-paper ring-1 ring-ink' : 'hover:bg-ink/5',
                dropIndex === index && dragging !== section.kind && 'outline-2 outline-dashed outline-ink',
                dragging === section.kind && 'opacity-50',
              )}
            >
              <span className={cn('flex w-5 justify-center text-muted', isCover ? 'invisible' : 'cursor-grab')} aria-hidden>
                <GripVertical size={14} />
              </span>
              <button
                type="button"
                onClick={() => pick(section.kind)}
                aria-current={active ? 'page' : undefined}
                className={cn('min-w-0 flex-1 truncate py-2 text-left text-sm', active && 'font-bold', !section.visible && 'text-muted line-through')}
              >
                {SECTION_LABELS[section.kind]}
                {!section.visible && <span className="sr-only"> (скрыт)</span>}
              </button>
              {!isCover && (
                <span className="hidden group-focus-within:flex group-hover:flex [@media(hover:none)]:flex">
                  <IconButton label={`Выше: ${SECTION_LABELS[section.kind]}`} size="sm" className="size-6" disabled={index <= 1} onClick={() => move(section.kind, -1)}>
                    <ChevronUp size={14} />
                  </IconButton>
                  <IconButton label={`Ниже: ${SECTION_LABELS[section.kind]}`} size="sm" className="size-6" disabled={index === project.sections.length - 1} onClick={() => move(section.kind, 1)}>
                    <ChevronDown size={14} />
                  </IconButton>
                </span>
              )}
              <IconButton
                label={
                  hideBlocked
                    ? 'Нельзя скрыть последний видимый раздел'
                    : section.visible
                      ? `Скрыть раздел «${SECTION_LABELS[section.kind]}»`
                      : `Показать раздел «${SECTION_LABELS[section.kind]}»`
                }
                aria-pressed={!section.visible}
                size="sm"
                className="size-7"
                disabled={hideBlocked}
                onClick={() => apply((p) => setSectionVisible(p, section.kind, !section.visible))}
              >
                {section.visible ? <Eye size={14} /> : <EyeOff size={14} />}
              </IconButton>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 px-3 text-xs text-muted">Перетащите раздел или используйте стрелки. Обложка всегда первая.</p>
    </nav>
  );
}
