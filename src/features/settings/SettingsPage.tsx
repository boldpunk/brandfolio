import { BackupSection } from './BackupSection';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Field';
import type { TemplateId } from '@/domain/schema';
import { LOCALE_NAMES, LOCALE_TAGS, LOCALES, setLocale, useLocale, useMessages } from '@/i18n/core';
import { settingsMessages } from '@/i18n/messages/settings';
import { cn } from '@/lib/cn';
import { setUiSettings, useUiSettings } from '@/lib/uiSettings';
import { TEMPLATE_INFO } from '@/templates/templateInfo';
import { track } from '@/lib/analytics';

type StorageInfo = { usage: number | null; quota: number | null; persisted: boolean | null; supported: boolean };

const formatBytes = (bytes: number, units: { gb: string; mb: string; kb: string }) =>
  bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toFixed(1)} ${units.gb}`
    : bytes >= 1024 ** 2
      ? `${(bytes / 1024 ** 2).toFixed(1)} ${units.mb}`
      : `${Math.ceil(bytes / 1024)} ${units.kb}`;

async function readStorageInfo(): Promise<StorageInfo> {
  const storage = navigator.storage;
  if (!storage?.estimate) return { usage: null, quota: null, persisted: null, supported: false };
  const [estimate, persisted] = await Promise.all([storage.estimate(), storage.persisted?.() ?? Promise.resolve(null)]);
  return { usage: estimate.usage ?? null, quota: estimate.quota ?? null, persisted, supported: true };
}

export default function SettingsPage() {
  const settings = useUiSettings();
  const locale = useLocale();
  const m = useMessages(settingsMessages);
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [persistResult, setPersistResult] = useState<'persistGranted' | 'persistDenied' | 'persistUnsupported' | null>(null);

  useEffect(() => {
    void readStorageInfo().then(setInfo);
  }, []);

  async function requestPersist() {
    try {
      const granted = await navigator.storage.persist();
      setPersistResult(granted ? 'persistGranted' : 'persistDenied');
      setInfo(await readStorageInfo());
    } catch {
      setPersistResult('persistUnsupported');
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{m.heading}</h1>

      <section aria-labelledby="lang-h" className="mt-8 rounded-lg border border-line bg-panel p-5 sm:p-6">
        <h2 id="lang-h" className="text-lg font-bold">
          {m.ui.language}
        </h2>
        <p id="lang-hint" className="mt-1 text-sm text-muted">
          {m.ui.languageHint}
        </p>
        {/* Names are written in their own language so anyone can find theirs. */}
        <div role="radiogroup" aria-labelledby="lang-h" aria-describedby="lang-hint" className="mt-4 grid gap-2 sm:grid-cols-3">
          {LOCALES.map((l) => (
            <label
              key={l}
              lang={LOCALE_TAGS[l]}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm font-semibold',
                locale === l ? 'border-ink bg-paper' : 'border-line-strong bg-panel',
              )}
            >
              <input type="radio" name="interface-language" value={l} checked={locale === l} onChange={() => {
                  setLocale(l);
                  track('interface_language_changed', { to: l });
                }} className="accent-ink" />
              {LOCALE_NAMES[l]}
            </label>
          ))}
        </div>
      </section>

      <section aria-labelledby="storage-h" className="mt-6 rounded-lg border border-line bg-panel p-5 sm:p-6">
        <h2 id="storage-h" className="text-lg font-bold">
          {m.storage.heading}
        </h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
          <p>{m.storage.p1}</p>
          <p>
            {m.storage.p2Before}
            <span className="font-mono text-ink">.brandfolio.zip</span>
            {m.storage.p2After}
          </p>
        </div>
        {info && (
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-md bg-paper p-3">
              <dt className="text-muted">{m.storage.usage}</dt>
              <dd className="font-mono text-base">{info.usage !== null ? formatBytes(info.usage, m.storage.units) : m.storage.unknown}</dd>
            </div>
            <div className="rounded-md bg-paper p-3">
              <dt className="text-muted">{m.storage.persistence}</dt>
              <dd className="text-base font-semibold">{info.persisted === null ? m.storage.notSupported : info.persisted ? m.storage.enabled : m.storage.notEnabled}</dd>
            </div>
          </dl>
        )}
        {info?.supported && !info.persisted && (
          <div className="mt-4">
            <Button onClick={requestPersist} className="h-auto! min-h-10 max-w-full py-2 text-left whitespace-normal!">{m.storage.requestPersist}</Button>
          </div>
        )}
        {persistResult && (
          <p role="status" className="mt-3 text-sm">
            {m.storage[persistResult]}
          </p>
        )}
      </section>

      <BackupSection />

      <section aria-labelledby="ui-h" className="mt-6 rounded-lg border border-line bg-panel p-5 sm:p-6">
        <h2 id="ui-h" className="text-lg font-bold">
          {m.ui.heading}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <SelectField
            label={m.ui.defaultTemplate}
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
            {m.ui.showNotice}
          </Button>
        )}
      </section>
    </div>
  );
}
