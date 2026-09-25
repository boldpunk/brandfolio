import type { TemplateId } from '@/domain/schema';

export type TemplateInfo = { id: TemplateId; name: string; description: string };

export const TEMPLATE_INFO: TemplateInfo[] = [
  { id: 'editorial', name: 'Editorial', description: 'Светлый, крупная типографика, асимметричные развороты.' },
  { id: 'studio', name: 'Studio', description: 'Строгая модульная сетка, колонтитулы и номера разделов.' },
  { id: 'contrast', name: 'Contrast', description: 'Контрастные обложки разделов и крупные цветовые поля.' },
];
