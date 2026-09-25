/**
 * Names of brandbook parts. Used both in the interface (interface language)
 * and inside the document (the project's document language).
 */
import { defineMessages } from '../core';

export const brandMessages = defineMessages({
  ru: {
    sections: {
      cover: 'Обложка',
      about: 'О бренде',
      logo: 'Логотип',
      colors: 'Цвета',
      typography: 'Типографика',
      imagery: 'Стиль изображений',
      voice: 'Тон общения',
      applications: 'Примеры применения',
      contacts: 'Контакты',
    },
    colorRoles: {
      primary: 'Основной',
      secondary: 'Дополнительный',
      accent: 'Акцент',
      background: 'Фон',
      text: 'Текст',
      custom: 'Другое',
    },
    typeRoles: { heading: 'Заголовки', body: 'Основной текст', caption: 'Подписи' },
    logoVariants: { primary: 'Основной', alternative: 'Альтернативный', mark: 'Знак', light: 'Светлая версия' },
    mockups: { businessCard: 'Визитка', socialPost: 'Публикация', websiteHero: 'Сайт', packagingLabel: 'Этикетка' },
    defaultColorNames: { background: 'Фон', text: 'Текст' },
  },
  uz: {
    sections: {
      cover: 'Muqova',
      about: 'Brend haqida',
      logo: 'Logotip',
      colors: 'Ranglar',
      typography: 'Tipografika',
      imagery: 'Tasvirlar uslubi',
      voice: 'Muloqot ohangi',
      applications: 'Qo‘llash namunalari',
      contacts: 'Kontaktlar',
    },
    colorRoles: {
      primary: 'Asosiy',
      secondary: 'Qo‘shimcha',
      accent: 'Urg‘u',
      background: 'Fon',
      text: 'Matn',
      custom: 'Boshqa',
    },
    typeRoles: { heading: 'Sarlavhalar', body: 'Asosiy matn', caption: 'Izohlar' },
    logoVariants: { primary: 'Asosiy', alternative: 'Muqobil', mark: 'Belgi', light: 'Och versiya' },
    mockups: { businessCard: 'Vizitka', socialPost: 'Post', websiteHero: 'Sayt', packagingLabel: 'Yorliq' },
    defaultColorNames: { background: 'Fon', text: 'Matn' },
  },
  en: {
    sections: {
      cover: 'Cover',
      about: 'About the brand',
      logo: 'Logo',
      colors: 'Colors',
      typography: 'Typography',
      imagery: 'Imagery',
      voice: 'Tone of voice',
      applications: 'Applications',
      contacts: 'Contacts',
    },
    colorRoles: {
      primary: 'Primary',
      secondary: 'Secondary',
      accent: 'Accent',
      background: 'Background',
      text: 'Text',
      custom: 'Other',
    },
    typeRoles: { heading: 'Headings', body: 'Body text', caption: 'Captions' },
    logoVariants: { primary: 'Primary', alternative: 'Alternative', mark: 'Mark', light: 'Light version' },
    mockups: { businessCard: 'Business card', socialPost: 'Social post', websiteHero: 'Website', packagingLabel: 'Label' },
    defaultColorNames: { background: 'Background', text: 'Text' },
  },
});
