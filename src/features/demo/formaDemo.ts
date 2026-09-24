/**
 * The demonstration project "FORMA — архитектурная студия". Fictional brand,
 * marked as demo. Its palette is an authored direction for the demo; not every
 * combination passes WCAG and the document does not claim so.
 */
import { createId } from '@/domain/ids';
import { createEmptyProject } from '@/domain/project';
import type { Asset, Project } from '@/domain/schema';
import { rasterizeSvg } from '@/features/assets/rasterize';
import { ingestFile } from '@/features/assets/ingest';
import { createProject, listProjects } from '@/storage/projectRepository';
import { FORMA_COMPOSITIONS, FORMA_LOGO_LIGHT_SVG, FORMA_LOGO_SVG, FORMA_MARK_SVG } from './formaAssets';

async function asAsset(data: BlobPart, name: string, kind: Asset['kind'], projectId: string): Promise<Asset> {
  const result = await ingestFile(new File([data], name), { kind, projectId });
  if (!result.ok) throw new Error(`Демо-файл ${name}: ${result.error}`);
  return result.asset;
}

export async function buildFormaDemo(now = new Date()): Promise<{ project: Project; assets: Asset[] }> {
  const project = createEmptyProject('FORMA — архитектурная студия', 'editorial', now);
  project.isDemo = true;
  const id = project.id;

  const logo = await asAsset(FORMA_LOGO_SVG, 'forma-logo.svg', 'logo', id);
  const light = await asAsset(FORMA_LOGO_LIGHT_SVG, 'forma-logo-light.svg', 'logo', id);
  const markAsset = await asAsset(FORMA_MARK_SVG, 'forma-mark.svg', 'logo', id);
  const images: Asset[] = [];
  for (const composition of FORMA_COMPOSITIONS) {
    images.push(await asAsset(await rasterizeSvg(composition.svg, 1600), composition.name, 'image', id));
  }

  const ivory = createId('c');
  const graphite = createId('c');
  const terracotta = createId('c');
  const sage = createId('c');
  const b = project.brand;

  b.colors = [
    { id: ivory, name: 'Слоновая кость', role: 'background', hex: '#F3EFE7' },
    { id: graphite, name: 'Графит', role: 'text', hex: '#242424' },
    { id: terracotta, name: 'Терракота', role: 'primary', hex: '#B65C3A' },
    { id: sage, name: 'Шалфей', role: 'secondary', hex: '#8C9A82' },
  ];
  b.cover = {
    title: 'FORMA',
    subtitle: 'Архитектурная студия. Руководство по фирменному стилю для команды и подрядчиков.',
    version: '1.0',
    date: now.toISOString().slice(0, 10),
    author: 'Студия FORMA (демонстрационный проект)',
    logoVariant: 'primary',
    backgroundColorId: null,
  };
  b.about = {
    description:
      'FORMA проектирует жилые и общественные пространства, в которых главное — свет, материал и пропорция. Этот брендбук описывает, как студия выглядит и говорит в документах, на сайте и в соцсетях.',
    mission: 'Создавать спокойные, долговечные пространства, в которых людям хорошо жить и работать.',
    values: ['Ясность вместо декора', 'Честные материалы', 'Внимание к контексту места', 'Долгий срок службы решений'],
    audience: 'Частные заказчики, девелоперы небольших жилых проектов и городские культурные институции.',
    positioning: 'Студия для тех, кому важна не эффектная картинка, а продуманное пространство, которое хорошо стареет.',
  };
  b.logo = {
    variants: { primary: logo.id, alternative: null, mark: markAsset.id, light: light.id },
    clearSpace: 0.5,
    minSizePx: 96,
    minSizeMm: 25,
    usageRules:
      'Логотип размещается на спокойном однотонном фоне. Знак можно использовать отдельно как аватар и штамп на чертежах. Логотип не перекрашивают: для тёмных фонов есть светлая версия.',
    doRules: ['Размещать на фоне «Слоновая кость» или «Графит»', 'Соблюдать охранное поле 0.5 высоты', 'Использовать знак отдельно в квадратных форматах'],
    dontRules: ['Растягивать и сжимать', 'Поворачивать и наклонять', 'Ставить на фотографии без подложки', 'Менять цвета элементов знака'],
    misuse: { stretch: true, rotate: true, busyBackground: true },
    previewColorId: terracotta,
  };
  b.typography = {
    heading: { role: 'heading', familyId: 'manrope', weight: 700, sizePx: 40, lineHeight: 1.1, trackingEm: -0.01 },
    body: { role: 'body', familyId: 'noto-serif', weight: 400, sizePx: 15, lineHeight: 1.55, trackingEm: 0 },
    caption: { role: 'caption', familyId: 'manrope', weight: 600, sizePx: 11, lineHeight: 1.4, trackingEm: 0.04 },
  };
  b.imagery = {
    images: images.map((asset, i) => ({ id: createId('i'), assetId: asset.id, caption: FORMA_COMPOSITIONS[i]!.caption, focalX: FORMA_COMPOSITIONS[i]!.focalX, focalY: FORMA_COMPOSITIONS[i]!.focalY })),
    lighting: 'Естественный боковой свет, мягкие длинные тени. Съёмка утром или в конце дня.',
    composition: 'Спокойная геометрия, сильные вертикали и горизонтали, много свободного пространства вокруг объекта.',
    processing: 'Тёплый баланс белого, умеренный контраст, без тонирования в холодные оттенки.',
    avoid: 'Широкоугольные искажения, людей в постановочных позах, яркие фильтры и HDR.',
  };
  b.voice = {
    qualities: [
      { id: createId('q'), title: 'Спокойно', description: 'Говорим уверенно и без восклицаний. Результат видно в работе, а не в громких словах.' },
      { id: createId('q'), title: 'Точно', description: 'Называем сроки, материалы и решения конкретно, без размытых обещаний.' },
      { id: createId('q'), title: 'Внимательно', description: 'Объясняем решения с точки зрения человека, который будет жить в пространстве.' },
    ],
    rules: ['Короткие предложения, одна мысль в каждом', 'Без англицизмов, если есть понятное русское слово', 'Цифры пишем цифрами'],
    pairs: [
      { id: createId('v'), say: 'Спроектируем дом за четыре месяца и покажем три варианта планировки.', avoid: 'Создадим дом вашей мечты в кратчайшие сроки!' },
      { id: createId('v'), say: 'Фасад из термодерева: через десять лет он станет серебристым, так и задумано.', avoid: 'Уникальный премиальный фасад, который никого не оставит равнодушным.' },
    ],
  };
  b.mockups = {
    businessCard: {
      kind: 'business-card',
      enabled: true,
      colors: { backgroundColorId: ivory, textColorId: graphite, accentColorId: graphite },
      personName: 'Анна Соколова',
      personRole: 'Ведущий архитектор',
      phone: '+7 900 000-00-00',
    },
    socialPost: {
      kind: 'social-post',
      enabled: true,
      colors: { backgroundColorId: terracotta, textColorId: ivory, accentColorId: ivory },
      headline: 'Дом у сосен: как мы сохранили каждое дерево на участке',
      caption: 'Новый проект в портфолио',
    },
    websiteHero: {
      kind: 'website-hero',
      enabled: true,
      colors: { backgroundColorId: ivory, textColorId: graphite, accentColorId: terracotta },
      headline: 'Пространства, которые хорошо стареют',
      subheadline: 'Жилые и общественные проекты от эскиза до авторского надзора.',
      ctaLabel: 'Смотреть проекты',
    },
    packagingLabel: {
      kind: 'packaging-label',
      enabled: true,
      colors: { backgroundColorId: ivory, textColorId: graphite, accentColorId: sage },
      productName: 'Альбом проектов 2026',
      descriptor: 'Двенадцать реализованных объектов, чертежи и материалы',
      netContent: '96 страниц',
    },
  };
  b.contacts = {
    organization: 'Студия FORMA (вымышленная)',
    email: 'hello@example.com',
    website: 'https://example.com',
    usageNote: 'Демонстрационный проект Brandfolio. Бренд, тексты и изображения вымышлены и созданы для примера.',
  };
  project.assetIds = [logo.id, light.id, markAsset.id, ...images.map((a) => a.id)];
  return { project, assets: [logo, light, markAsset, ...images] };
}

/**
 * Opens the user's demo copy if one exists (it is never overwritten by a
 * repeat visit), otherwise creates it.
 */
export async function openOrCreateDemo(): Promise<string> {
  const existing = (await listProjects()).find((p) => p.isDemo);
  if (existing) return existing.id;
  const { project, assets } = await buildFormaDemo();
  await createProject(project, assets);
  return project.id;
}
