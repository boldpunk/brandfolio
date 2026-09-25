import { HardDrive, X } from 'lucide-react';
import { Link } from 'react-router';
import { IconButton } from '@/components/ui/Button';
import { setUiSettings, useUiSettings } from '@/lib/uiSettings';

/** Shown once: where data lives and what can erase it. */
export function StorageNotice() {
  const { storageNoticeDismissed } = useUiSettings();
  if (storageNoticeDismissed) return null;
  return (
    <aside aria-label="О хранении данных" className="mt-6 flex items-start gap-3 rounded-lg border border-line bg-panel p-4 text-sm">
      <HardDrive size={20} className="mt-0.5 shrink-0" aria-hidden />
      <p className="flex-1 text-muted">
        <strong className="text-ink">Проекты хранятся только в этом браузере на этом устройстве.</strong> Синхронизации нет. Очистка данных сайта,
        приватный режим или удаление браузера могут стереть проекты. Для резервной копии скачивайте архив проекта. Подробнее в{' '}
        <Link to="/settings" className="font-semibold text-ink underline underline-offset-2">
          настройках
        </Link>
        .
      </p>
      <IconButton label="Скрыть подсказку" size="sm" onClick={() => setUiSettings({ storageNoticeDismissed: true })}>
        <X size={16} />
      </IconButton>
    </aside>
  );
}
