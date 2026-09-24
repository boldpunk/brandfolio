import { CURRENT_SCHEMA_VERSION, projectSchema, type Project } from './schema';

/**
 * Each migration upgrades a raw document from version N to N+1. Documents are
 * validated with the current schema only after all migrations ran.
 * Version 1 is the first released schema, so the table is empty for now;
 * a future v2 adds `1: (doc) => ({ ...doc, schemaVersion: 2, ... })`.
 */
type RawDocument = Record<string, unknown> & { schemaVersion: number };
export const MIGRATIONS: Record<number, (doc: RawDocument) => RawDocument> = {};

export class SchemaVersionError extends Error {
  readonly found: unknown;
  constructor(message: string, found: unknown) {
    super(message);
    this.name = 'SchemaVersionError';
    this.found = found;
  }
}

export function migrateProject(
  input: unknown,
  migrations: Record<number, (doc: RawDocument) => RawDocument> = MIGRATIONS,
  targetVersion: number = CURRENT_SCHEMA_VERSION,
): RawDocument {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new SchemaVersionError('Файл проекта не является объектом JSON', input);
  }
  const version = (input as { schemaVersion?: unknown }).schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new SchemaVersionError('В проекте нет корректного schemaVersion', version);
  }
  if (version > targetVersion) {
    throw new SchemaVersionError(
      `Проект создан более новой версией Brandfolio (схема ${version}, поддерживается до ${targetVersion}). Обновите приложение.`,
      version,
    );
  }
  let doc = input as RawDocument;
  for (let v = version; v < targetVersion; v++) {
    const step = migrations[v];
    if (!step) throw new SchemaVersionError(`Нет миграции со схемы ${v}`, v);
    doc = step(doc);
  }
  return doc;
}

export function parseProject(input: unknown): Project {
  return projectSchema.parse(migrateProject(input));
}
