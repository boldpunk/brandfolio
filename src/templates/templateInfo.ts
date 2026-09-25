import type { TemplateId } from '@/domain/schema';
import { msg, useMessages, type Locale } from '@/i18n/core';
import { templateMessages } from '@/i18n/messages/templates';

export type TemplateInfo = { id: TemplateId; name: string; description: string };

/** Ids and names; names are proper names and are not translated. */
export const TEMPLATE_INFO: readonly { id: TemplateId; name: string }[] = [
  { id: 'editorial', name: 'Editorial' },
  { id: 'studio', name: 'Studio' },
  { id: 'contrast', name: 'Contrast' },
];

/** Description of a template in the given locale (default: the interface language). */
export function templateDescription(id: TemplateId, locale?: Locale): string {
  return msg(templateMessages, locale).descriptions[id];
}

/** Descriptions by template id in the interface language; re-renders on language change. */
export function useTemplateDescriptions(): Record<TemplateId, string> {
  return useMessages(templateMessages).descriptions;
}

/** All templates with descriptions in the interface language; re-renders on language change. */
export function useTemplateInfo(): TemplateInfo[] {
  const m = useMessages(templateMessages);
  return TEMPLATE_INFO.map((t) => ({ ...t, description: m.descriptions[t.id] }));
}
