import { ArrowRight, BookOpen } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { openOrCreateDemo } from '@/features/demo/formaDemo';
import { TEMPLATE_INFO } from '@/templates/templateInfo';

const STEPS = [
  { title: 'Заполните разделы', text: 'Логотип, цвета, шрифты, стиль изображений, тон общения и примеры применения. Пустые разделы не попадут в документ.' },
  { title: 'Выберите оформление', text: 'Три шаблона с разной сеткой и обложкой. Данные при смене не теряются, порядок и видимость разделов настраиваются.' },
  { title: 'Скачайте результат', text: 'PDF с выделяемым текстом и встроенными шрифтами, а также архив проекта с токенами цветов для разработчиков.' },
];

const FAQ = [
  {
    q: 'Где хранятся мои проекты?',
    a: 'Только в этом браузере, в IndexedDB на вашем устройстве. Сервера и аккаунта нет, файлы никуда не отправляются. Если очистить данные сайта, проекты удалятся, поэтому храните архивы как резервные копии.',
  },
  {
    q: 'Как перенести проект на другой компьютер?',
    a: 'Скачайте архив .brandfolio.zip в редакторе или в списке проектов и импортируйте его на другом устройстве. Внутри project.json, логотипы, изображения и токены в JSON и CSS.',
  },
  {
    q: 'Как устроен PDF?',
    a: 'Документ собирается прямо в браузере из снимка проекта в момент экспорта. Шрифты с кириллицей и узбекской латиницей встраиваются в файл, текст можно выделять и копировать.',
  },
  {
    q: 'Какие файлы можно загрузить?',
    a: 'PNG, JPEG и SVG для логотипов, PNG и JPEG для изображений, до 5 МиБ и 20 мегапикселей. SVG очищается от скриптов, внешних ссылок и других опасных элементов перед сохранением.',
  },
];

const EX = `${import.meta.env.BASE_URL}examples/`;

const COVERS: Record<string, string> = {
  editorial: EX + 'editorial-p1.jpg',
  studio: EX + 'studio-p1.jpg',
  contrast: EX + 'contrast-p1.jpg',
};

function Sheet({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return <img src={src} alt={alt} width={909} height={1286} loading="lazy" className={`block h-auto w-full rounded-sm bg-panel shadow-sheet ${className ?? ''}`} />;
}

export default function HomePage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openDemo() {
    setBusy(true);
    setError(null);
    try {
      navigate(`/editor/${await openOrCreateDemo()}`);
    } catch (e) {
      setError(`Не удалось открыть пример: ${e instanceof Error ? e.message : e}`);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section aria-labelledby="hero-h" className="grid gap-10 py-12 sm:py-16 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <p className="font-mono text-xs tracking-wide text-muted uppercase">Конструктор брендбука</p>
          <h1 id="hero-h" className="mt-4 text-4xl leading-[1.05] font-bold tracking-tight sm:text-6xl">
            Правила бренда в одном документе
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Соберите логотип, палитру, шрифты и тон общения в аккуратный брендбук и скачайте его в PDF. Всё работает в браузере, без регистрации.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/projects?create=1" className="inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 font-semibold text-ink hover:brightness-95">
              Создать брендбук <ArrowRight size={18} aria-hidden />
            </Link>
            <Button icon={<BookOpen size={18} />} onClick={() => void openDemo()} disabled={busy} className="h-11">
              {busy ? 'Открываем…' : 'Открыть пример'}
            </Button>
          </div>
          {error && (
            <p role="alert" className="mt-3 text-sm font-semibold text-danger">
              {error}
            </p>
          )}
        </div>
        <figure className="m-0">
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-desk p-4 sm:gap-4 sm:p-6">
            <Sheet src={EX + 'editorial-p1.jpg'} alt="Обложка брендбука FORMA в оформлении Editorial" />
            <Sheet src={EX + 'editorial-p5.jpg'} alt="Страница «Цвета» брендбука FORMA: четыре цвета с HEX, RGB, HSL и контрастом" />
          </div>
          <figcaption className="mt-3 text-xs text-muted">Страницы PDF демонстрационного проекта FORMA. Бренд вымышленный.</figcaption>
        </figure>
      </section>

      <section aria-labelledby="steps-h" className="border-t border-line py-12 sm:py-16">
        <h2 id="steps-h" className="text-2xl font-bold sm:text-3xl">
          Три шага до готового PDF
        </h2>
        <ol className="mt-8 grid gap-8 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="border-t-2 border-ink pt-4">
              <span className="font-mono text-sm text-muted">0{i + 1}</span>
              <h3 className="mt-2 text-lg font-bold">{step.title}</h3>
              <p className="mt-2 text-muted">{step.text}</p>
            </li>
          ))}
        </ol>
        <figure className="mt-10">
          <img src={EX + 'editor.jpg'} alt="Редактор Brandfolio: список разделов слева, страница «Цвета» в центре, настройки цвета справа" width={1440} height={900} loading="lazy" className="block h-auto w-full rounded-lg border border-line shadow-panel" />
          <figcaption className="mt-3 text-xs text-muted">Редактор: разделы, рабочий лист и настройки. На телефоне панели переключаются вкладками.</figcaption>
        </figure>
      </section>

      <section aria-labelledby="tpl-h" className="border-t border-line py-12 sm:py-16">
        <h2 id="tpl-h" className="text-2xl font-bold sm:text-3xl">
          Три варианта оформления
        </h2>
        <p className="mt-3 max-w-2xl text-muted">Один и тот же проект в разных шаблонах. Цвета и шрифты берутся из бренда, сетка и композиция — из шаблона.</p>
        <ul className="mt-8 grid gap-6 sm:grid-cols-3">
          {TEMPLATE_INFO.map((info) => (
            <li key={info.id}>
              <Sheet src={COVERS[info.id] ?? ''} alt={`Обложка в оформлении ${info.name}`} />
              <h3 className="mt-4 font-bold">{info.name}</h3>
              <p className="mt-1 text-sm text-muted">{info.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="faq-h" className="border-t border-line py-12 sm:py-16">
        <h2 id="faq-h" className="text-2xl font-bold sm:text-3xl">
          Хранение и экспорт
        </h2>
        <dl className="mt-8 grid gap-x-10 gap-y-8 md:grid-cols-2">
          {FAQ.map((item) => (
            <div key={item.q}>
              <dt className="font-bold">{item.q}</dt>
              <dd className="mt-2 text-muted">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="flex flex-wrap justify-between gap-3 border-t border-line py-8 text-sm text-muted">
        <span>Brandfolio v1. Проекты хранятся локально в вашем браузере.</span>
        <span>Шрифты Manrope, Noto Sans, Noto Serif, JetBrains Mono — SIL OFL 1.1.</span>
      </footer>
    </div>
  );
}
