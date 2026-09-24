import { BackupSection } from './BackupSection';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Field';
import type { TemplateId } from '@/domain/schema';
import { setUiSettings, useUiSettings } from '@/lib/uiSettings';
import { TEMPLATE_INFO } from '@/templates/templateInfo';

type StorageInfo = { usage: number | null; quota: number | null; persisted: boolean | null; supported: boolean };

const formatBytes = (bytes: number) =>
  bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} ГБ` : bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(1)} МБ` : `${Math.ceil(bytes / 1024)} КБ`;

async function readStorageInfo(): Promise<StorageInfo> {
  const storage = navigator.storage;
  if (!storage?.estimate) return { usage: null, quota: null, persisted: null, supported: false };
  const [estimate, persisted] = await Promise.all([storage.estimate(), storage.persisted?.() ?? Promise.resolve(null)]);
  return { usage: estimate.usage ?? null, quota: estimate.quota ?? null, persisted, supported: true };
}

export default function SettingsPage() {
  const settings = useUiSettings();
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [persistResult, setPersistResult] = useState<string | null>(null);

  useEffect(() => {
    void readStorageInfo().then(setInfo);
  }, []);

  async function requestPersist() {
    try {
      const granted = await navigator.storage.persist();
      setPersistResult(
        granted
          ? 'Браузер отметил данные сайта как постоянные: он не будет удалять их сам при нехватке места. Очистка данных вручную всё равно их сотрёт.'
          : 'Браузер отклонил запрос. Это обычное решение браузера, а не ошибка. Данные сохраняются, но при нехватке места браузер может их удалить, поэтому держите резервные архивы.',
      );
      setInfo(await readStorageInfo());
    } catch {
      setPersistResult('Этот браузер не поддерживает запрос постоянного хранения.');
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Настройки</h1>

      <section aria-labelledby="storage-h" className="mt-8 rounded-lg border border-line bg-panel p-5 sm:p-6">
        <h2 id="storage-h" className="text-lg font-bold">
          Где хранятся проекты
        </h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
          <p>
            Brandfolio работает без учётной записи и сервера. Проекты, логотипы и изображения сохраняются в хранилище этого браузера (IndexedDB) на этом
            устройстве. В другом браузере, на другом устройстве или в приватном окне их не будет.
          </p>
          <p>
            Синхронизации нет, и сохранность не гарантирована: очистка данных сайта, удаление браузера или нехватка места могут стереть проекты. Надёжный
            способ сохранить работу — регулярно скачивать архив проекта <span className="font-mono text-ink">.brandfolio.zip</span>. Его можно импортировать
            обратно в любом браузере.
          </p>
        </div>
        {info && (
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-md bg-paper p-3">
              <dt className="text-muted">Занято данными сайта</dt>
              <dd className="font-mono text-base">{info.usage !== null ? formatBytes(info.usage) : 'неизвестно'}</dd>
            </div>
            <div className="rounded-md bg-paper p-3">
              <dt className="text-muted">Постоянное хранение</dt>
              <dd className="text-base font-semibold">{info.persisted === null ? 'не поддерживается' : info.persisted ? 'включено браузером' : 'не включено'}</dd>
            </div>
          </dl>
        )}
        {info?.supported && !info.persisted && (
          <div className="mt-4">
            <Button onClick={requestPersist}>Попросить браузер не удалять данные</Button>
          </div>
        )}
        {persistResult && (
          <p role="status" className="mt-3 text-sm">
            {persistResult}
          </p>
        )}
      </section>

      <BackupSection />

      <section aria-labelledby="ui-h" className="mt-6 rounded-lg border border-line bg-panel p-5 sm:p-6">
        <h2 id="ui-h" className="text-lg font-bold">
          Интерфейс
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Оформление для новых проектов"
            value={settings.defaultTemplate}
            onChange={(e) => setUiSettings({ defaultTemplate: e.target.value as TemplateId })}
          >
            {TEMPLATE_INFO.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </SelectField>
        </div>
        {settings.storageNoticeDismissed && (
          <Button className="mt-4" size="sm" onClick={() => setUiSettings({ storageNoticeDismissed: false })}>
            Снова показать подсказку о хранении
          </Button>
        )}
      </section>
    </div>
  );
}
