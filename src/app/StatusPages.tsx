import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { Wordmark } from '@/components/ui/Wordmark';

function Recovery({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-20">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="text-muted">{text}</p>
      <div className="flex flex-wrap gap-2">
        {children}
        <Link to="/projects" className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold">
          К проектам
        </Link>
        <Link to="/" className="inline-flex h-10 items-center rounded-md border border-line-strong bg-panel px-4 text-sm font-semibold">
          На главную
        </Link>
      </div>
    </div>
  );
}

export function NotFoundPage() {
  return <Recovery title="Страница не найдена" text="Такого адреса в Brandfolio нет. Возможно, ссылка устарела или в ней опечатка." />;
}

export function ProjectMissingPage() {
  return (
    <Recovery
      title="Проект не найден"
      text="В этом браузере нет проекта с таким адресом. Проекты хранятся только на устройстве, где их создали. Если у вас есть архив .brandfolio.zip, импортируйте его на странице проектов."
    />
  );
}

export function RouteErrorPage() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Неизвестная ошибка';
  return (
    <div className="min-h-dvh bg-paper">
      <div className="px-4 pt-6 sm:px-6">
        <Wordmark />
      </div>
      <Recovery title="Что-то пошло не так" text={`Страница не смогла открыться: ${message}. Данные проектов в браузере не затронуты.`}>
        <button type="button" onClick={() => window.location.reload()} className="inline-flex h-10 items-center rounded-md border border-line-strong bg-panel px-4 text-sm font-semibold">
          Обновить страницу
        </button>
      </Recovery>
    </div>
  );
}
