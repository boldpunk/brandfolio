import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { Wordmark } from '@/components/ui/Wordmark';
import { useMessages } from '@/i18n/core';
import { commonMessages } from '@/i18n/messages/common';

function Recovery({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  const m = useMessages(commonMessages);
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-20">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="text-muted">{text}</p>
      <div className="flex flex-wrap gap-2">
        {children}
        <Link to="/projects" className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold">
          {m.toProjects}
        </Link>
        <Link to="/" className="inline-flex h-10 items-center rounded-md border border-line-strong bg-panel px-4 text-sm font-semibold">
          {m.toHome}
        </Link>
      </div>
    </div>
  );
}

export function NotFoundPage() {
  const m = useMessages(commonMessages);
  return <Recovery title={m.notFoundTitle} text={m.notFoundText} />;
}

export function ProjectMissingPage() {
  const m = useMessages(commonMessages);
  return <Recovery title={m.projectMissingTitle} text={m.projectMissingText} />;
}

export function RouteErrorPage() {
  const error = useRouteError();
  const m = useMessages(commonMessages);
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : m.unknownError;
  return (
    <div className="min-h-dvh bg-paper">
      <div className="px-4 pt-6 sm:px-6">
        <Wordmark />
      </div>
      <Recovery title={m.errorTitle} text={m.errorText(message)}>
        <button type="button" onClick={() => window.location.reload()} className="inline-flex h-10 items-center rounded-md border border-line-strong bg-panel px-4 text-sm font-semibold">
          {m.reload}
        </button>
      </Recovery>
    </div>
  );
}
