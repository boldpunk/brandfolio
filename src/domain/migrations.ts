import { msg } from '@/i18n/core';
import { validationMessages } from '@/i18n/messages/validation';
import { CURRENT_SCHEMA_VERSION, projectSchema, type Project } from './schema';

/**
 * Each migration upgrades a raw document from version N to N+1. Documents are
 * validated with the current schema only after all migrations ran.
 *
 * v1 → v2: the document gets its own `language`. Every v1 project was made
 * in the Russian-only release, so its labels stay Russian.
 * v2 → v3: brands can carry their own fonts; existing brands have none.
 */
type RawDocument = Record<string, unknown> & { schemaVersion: number };
export const MIGRATIONS: Record<number, (doc: RawDocument) => RawDocument> = {
  1: (doc) => ({ ...doc, schemaVersion: 2, language: 'ru' }),
  2: (doc) => {
    const brand = typeof doc.brand === 'object' && doc.brand !== null ? doc.brand : {};
    return { ...doc, schemaVersion: 3, brand: { ...brand, customFonts: [] } };
  },
};

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
    throw new SchemaVersionError(msg(validationMessages).notJsonObject, input);
  }
  const version = (input as { schemaVersion?: unknown }).schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new SchemaVersionError(msg(validationMessages).badSchemaVersion, version);
  }
  if (version > targetVersion) {
    throw new SchemaVersionError(msg(validationMessages).newerSchema(version, targetVersion), version);
  }
  let doc = input as RawDocument;
  for (let v = version; v < targetVersion; v++) {
    const step = migrations[v];
    if (!step) throw new SchemaVersionError(msg(validationMessages).noMigration(v), v);
    doc = step(doc);
  }
  return doc;
}

export function parseProject(input: unknown): Project {
  return projectSchema.parse(migrateProject(input));
}
