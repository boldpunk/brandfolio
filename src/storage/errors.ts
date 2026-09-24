export class RevisionConflictError extends Error {
  readonly storedRevision: number;
  constructor(storedRevision: number) {
    super('Проект изменён в другой вкладке или окне');
    this.name = 'RevisionConflictError';
    this.storedRevision = storedRevision;
  }
}

export class ProjectNotFoundError extends Error {
  constructor(id: string) {
    super(`Проект ${id} не найден`);
    this.name = 'ProjectNotFoundError';
  }
}

export class StorageWriteError extends Error {
  readonly quota: boolean;
  constructor(cause: unknown) {
    const quota = isQuotaError(cause);
    super(quota ? 'На устройстве закончилось место для данных браузера' : 'Браузер не смог записать данные');
    this.name = 'StorageWriteError';
    this.quota = quota;
    this.cause = cause;
  }
}

export function isQuotaError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const inner = (error as { inner?: unknown }).inner;
  return (
    error.name === 'QuotaExceededError' ||
    (error as { name?: string }).name === 'QuotaExceeded' ||
    (inner instanceof Error && inner.name === 'QuotaExceededError')
  );
}

/** The requested write would break references between the project and its assets. */
export class IntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntegrityError';
  }
}
