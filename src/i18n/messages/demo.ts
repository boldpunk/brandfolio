/**
 * Content of the FORMA demonstration project in each document language. This
 * is brand content the demo fills into a project, not interface text: the
 * demo is built in one language and its project.language is set to match.
 */
import { defineMessages } from '../core';

export const demoMessages = defineMessages({
  ru: {
    title: 'FORMA — архитектурная студия',
    fileError: (name: string, error: string) => `Демо-файл ${name}: ${error}`,
    colors: { ivory: 'Слоновая кость', graphite: 'Графит', terracotta: 'Терракота', sage: 'Шалфей' },
    cover: {
      subtitle: 'Архитектурная студия. Руководство по фирменному стилю для команды и подрядчиков.',
      author: 'Студия FORMA (демонстрационный проект)',
    },
    about: {
      description:
        'FORMA проектирует жилые и общественные пространства, в которых главное — свет, материал и пропорция. Этот брендбук описывает, как студия выглядит и говорит в документах, на сайте и в соцсетях.',
      mission: 'Создавать спокойные, долговечные пространства, в которых людям хорошо жить и работать.',
      values: ['Ясность вместо декора', 'Честные материалы', 'Внимание к контексту места', 'Долгий срок службы решений'],
      audience: 'Частные заказчики, девелоперы небольших жилых проектов и городские культурные институции.',
      positioning: 'Студия для тех, кому важна не эффектная картинка, а продуманное пространство, которое хорошо стареет.',
    },
    logo: {
      usageRules:
        'Логотип размещается на спокойном однотонном фоне. Знак можно использовать отдельно как аватар и штамп на чертежах. Логотип не перекрашивают: для тёмных фонов есть светлая версия.',
      doRules: ['Размещать на фоне «Слоновая кость» или «Графит»', 'Соблюдать охранное поле 0.5 высоты', 'Использовать знак отдельно в квадратных форматах'],
      dontRules: ['Растягивать и сжимать', 'Поворачивать и наклонять', 'Ставить на фотографии без подложки', 'Менять цвета элементов знака'],
    },
    imagery: {
      captions: {
        light: 'Свет и тень: мягкий боковой свет, длинные тени, тёплый тон',
        material: 'Материал: ритм арок и фактура, без лишних деталей',
        space: 'Пространство: чистая перспектива, много воздуха, один акцент',
      },
      lighting: 'Естественный боковой свет, мягкие длинные тени. Съёмка утром или в конце дня.',
      composition: 'Спокойная геометрия, сильные вертикали и горизонтали, много свободного пространства вокруг объекта.',
      processing: 'Тёплый баланс белого, умеренный контраст, без тонирования в холодные оттенки.',
      avoid: 'Широкоугольные искажения, людей в постановочных позах, яркие фильтры и HDR.',
    },
    voice: {
      qualities: [
        { title: 'Спокойно', description: 'Говорим уверенно и без восклицаний. Результат видно в работе, а не в громких словах.' },
        { title: 'Точно', description: 'Называем сроки, материалы и решения конкретно, без размытых обещаний.' },
        { title: 'Внимательно', description: 'Объясняем решения с точки зрения человека, который будет жить в пространстве.' },
      ],
      rules: ['Короткие предложения, одна мысль в каждом', 'Без англицизмов, если есть понятное русское слово', 'Цифры пишем цифрами'],
      pairs: [
        { say: 'Спроектируем дом за четыре месяца и покажем три варианта планировки.', avoid: 'Создадим дом вашей мечты в кратчайшие сроки!' },
        { say: 'Фасад из термодерева: через десять лет он станет серебристым, так и задумано.', avoid: 'Уникальный премиальный фасад, который никого не оставит равнодушным.' },
      ],
    },
    mockups: {
      personName: 'Анна Соколова',
      personRole: 'Ведущий архитектор',
      phone: '+7 900 000-00-00',
      postHeadline: 'Дом у сосен: как мы сохранили каждое дерево на участке',
      postCaption: 'Новый проект в портфолио',
      heroHeadline: 'Пространства, которые хорошо стареют',
      heroSubheadline: 'Жилые и общественные проекты от эскиза до авторского надзора.',
      heroCta: 'Смотреть проекты',
      productName: 'Альбом проектов 2026',
      productDescriptor: 'Двенадцать реализованных объектов, чертежи и материалы',
      netContent: '96 страниц',
    },
    contacts: {
      organization: 'Студия FORMA (вымышленная)',
      usageNote: 'Демонстрационный проект Brandfolio. Бренд, тексты и изображения вымышлены и созданы для примера.',
    },
  },
  uz: {
    title: 'FORMA — arxitektura studiyasi',
    fileError: (name: string, error: string) => `Demo fayl ${name}: ${error}`,
    colors: { ivory: 'Fil suyagi', graphite: 'Grafit', terracotta: 'Terrakota', sage: 'Shalfey' },
    cover: {
      subtitle: 'Arxitektura studiyasi. Jamoa va pudratchilar uchun firma uslubi bo‘yicha qo‘llanma.',
      author: 'FORMA studiyasi (namoyish loyihasi)',
    },
    about: {
      description:
        'FORMA turar joy va jamoat makonlarini loyihalaydi, ularda eng muhimi — yorug‘lik, material va mutanosiblik. Ushbu brendbuk studiya hujjatlarda, saytda va ijtimoiy tarmoqlarda qanday ko‘rinishi va qanday gapirishini tasvirlaydi.',
      mission: 'Odamlarga yashash va ishlash uchun yoqimli bo‘lgan sokin, uzoq xizmat qiladigan makonlar yaratish.',
      values: ['Bezak o‘rniga aniqlik', 'Halol materiallar', 'Joy kontekstiga e’tibor', 'Yechimlarning uzoq xizmat muddati'],
      audience: 'Xususiy buyurtmachilar, kichik turar joy loyihalari developerlari va shahar madaniyat muassasalari.',
      positioning: 'Ta’sirli surat emas, balki yillar o‘tib ham chiroyli qoladigan, puxta o‘ylangan makon muhim bo‘lganlar uchun studiya.',
    },
    logo: {
      usageRules:
        'Logotip sokin, bir tusli fonga joylashtiriladi. Belgini alohida avatar va chizmalardagi muhr sifatida ishlatish mumkin. Logotip qayta bo‘yalmaydi: to‘q fonlar uchun och versiyasi bor.',
      doRules: ['«Fil suyagi» yoki «Grafit» fonida joylashtirish', 'Balandlikning 0.5 qismiga teng himoya maydoniga rioya qilish', 'Kvadrat formatlarda belgini alohida ishlatish'],
      dontRules: ['Cho‘zish va siqish', 'Burish va qiyshaytirish', 'Fotosurat ustiga tagliksiz qo‘yish', 'Belgi elementlarining ranglarini o‘zgartirish'],
    },
    imagery: {
      captions: {
        light: 'Yorug‘lik va soya: yumshoq yon yorug‘lik, uzun soyalar, iliq ton',
        material: 'Material: arkalar ritmi va faktura, ortiqcha detallarsiz',
        space: 'Makon: toza perspektiva, ko‘p havo, bitta urg‘u',
      },
      lighting: 'Tabiiy yon yorug‘lik, yumshoq uzun soyalar. Ertalab yoki kun oxirida suratga olamiz.',
      composition: 'Sokin geometriya, kuchli vertikal va gorizontal chiziqlar, obyekt atrofida ko‘p bo‘sh joy.',
      processing: 'Iliq oq balansi, mo‘tadil kontrast, sovuq tuslarga tonlashsiz.',
      avoid: 'Keng burchakli obyektiv buzilishlari, sun’iy pozadagi odamlar, yorqin filtrlar va HDR.',
    },
    voice: {
      qualities: [
        { title: 'Sokin', description: 'Ishonch bilan, undovlarsiz gapiramiz. Natija baland so‘zlarda emas, ishda ko‘rinadi.' },
        { title: 'Aniq', description: 'Muddat, material va yechimlarni aniq aytamiz, mavhum va’dalarsiz.' },
        { title: 'E’tiborli', description: 'Yechimlarni shu makonda yashaydigan inson nuqtai nazaridan tushuntiramiz.' },
      ],
      rules: ['Qisqa gaplar, har birida bitta fikr', 'Tushunarli o‘zbekcha so‘z bo‘lsa, chet so‘z ishlatmaymiz', 'Sonlarni raqam bilan yozamiz'],
      pairs: [
        { say: 'Uyni to‘rt oyda loyihalaymiz va rejalashtirishning uchta variantini ko‘rsatamiz.', avoid: 'Orzuingizdagi uyni eng qisqa muddatda yaratamiz!' },
        { say: 'Termoyog‘och fasad: o‘n yildan keyin u kumushrang tusga kiradi, shunday o‘ylangan.', avoid: 'Hech kimni befarq qoldirmaydigan noyob premium fasad.' },
      ],
    },
    mockups: {
      personName: 'Malika Karimova',
      personRole: 'Yetakchi arxitektor',
      phone: '+998 90 000-00-00',
      postHeadline: 'Qarag‘aylar yonidagi uy: uchastkadagi har bir daraxtni qanday saqlab qoldik',
      postCaption: 'Portfoliodagi yangi loyiha',
      heroHeadline: 'Yillar o‘tib ham chiroyli qoladigan makonlar',
      heroSubheadline: 'Turar joy va jamoat loyihalari — eskizdan mualliflik nazoratigacha.',
      heroCta: 'Loyihalarni ko‘rish',
      productName: 'Loyihalar albomi 2026',
      productDescriptor: 'O‘n ikkita amalga oshirilgan obyekt, chizmalar va materiallar',
      netContent: '96 sahifa',
    },
    contacts: {
      organization: 'FORMA studiyasi (to‘qima)',
      usageNote: 'Brandfolio namoyish loyihasi. Brend, matnlar va tasvirlar to‘qima, namuna uchun yaratilgan.',
    },
  },
  en: {
    title: 'FORMA — architecture studio',
    fileError: (name: string, error: string) => `Demo file ${name}: ${error}`,
    colors: { ivory: 'Ivory', graphite: 'Graphite', terracotta: 'Terracotta', sage: 'Sage' },
    cover: {
      subtitle: 'Architecture studio. Brand guidelines for the team and contractors.',
      author: 'FORMA studio (demo project)',
    },
    about: {
      description:
        'FORMA designs homes and public spaces where light, material and proportion come first. This brand book describes how the studio looks and speaks in documents, on the website and on social media.',
      mission: 'To create calm, lasting spaces where people enjoy living and working.',
      values: ['Clarity over decoration', 'Honest materials', 'Respect for the context of the place', 'Solutions built to last'],
      audience: 'Private clients, developers of small residential projects and the city’s cultural institutions.',
      positioning: 'A studio for people who care less about a striking picture and more about a well-thought-out space that ages well.',
    },
    logo: {
      usageRules:
        'The logo sits on a calm, solid background. The mark can be used on its own as an avatar and as a stamp on drawings. The logo is never recolored: there is a light version for dark backgrounds.',
      doRules: ['Place on Ivory or Graphite', 'Keep a clear space of 0.5 × the logo height', 'Use the mark on its own in square formats'],
      dontRules: ['Stretch or squash', 'Rotate or tilt', 'Place on photos without a backing', 'Change the colors of the mark'],
    },
    imagery: {
      captions: {
        light: 'Light and shadow: soft side light, long shadows, warm tone',
        material: 'Material: rhythm of arches and texture, no extra detail',
        space: 'Space: clean perspective, plenty of air, one accent',
      },
      lighting: 'Natural side light, soft long shadows. Shoot in the morning or late in the day.',
      composition: 'Calm geometry, strong verticals and horizontals, plenty of free space around the subject.',
      processing: 'Warm white balance, moderate contrast, no cool toning.',
      avoid: 'Wide-angle distortion, posed people, bright filters and HDR.',
    },
    voice: {
      qualities: [
        { title: 'Calm', description: 'We speak with confidence and without exclamation marks. The result shows in the work, not in loud words.' },
        { title: 'Precise', description: 'We name deadlines, materials and decisions specifically, without vague promises.' },
        { title: 'Attentive', description: 'We explain decisions from the point of view of the person who will live in the space.' },
      ],
      rules: ['Short sentences, one idea in each', 'Plain words instead of jargon', 'Numbers written as digits'],
      pairs: [
        { say: 'We’ll design the house in four months and show you three layout options.', avoid: 'We’ll create the home of your dreams in record time!' },
        { say: 'A thermowood facade: in ten years it will turn silver, and that’s the plan.', avoid: 'A unique premium facade that will leave no one indifferent.' },
      ],
    },
    mockups: {
      personName: 'Anna Sokolova',
      personRole: 'Lead architect',
      phone: '+1 555 000 0000',
      postHeadline: 'House by the pines: how we kept every tree on the site',
      postCaption: 'New project in the portfolio',
      heroHeadline: 'Spaces that age well',
      heroSubheadline: 'Residential and public projects from first sketch to site supervision.',
      heroCta: 'View projects',
      productName: 'Project album 2026',
      productDescriptor: 'Twelve completed buildings, drawings and materials',
      netContent: '96 pages',
    },
    contacts: {
      organization: 'FORMA studio (fictional)',
      usageNote: 'A Brandfolio demo project. The brand, texts and images are fictional and made for the example.',
    },
  },
});
