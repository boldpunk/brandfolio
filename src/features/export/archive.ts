/**
 * Portable project archive (.brandfolio.zip).
 *
 *   project.json   manifest + project document (schemaVersion, relative asset paths)
 *   assets/…       original files (sanitized SVG, PNG, JPEG)
 *   tokens.json    design tokens
 *   tokens.css     CSS custom properties
 *   README.txt     what the archive is and how to import it
 *
 * Import validates everything before writing and creates a new project with
 * new IDs in a single transaction, so a bad archive leaves nothing behind.
 */
import { Unzip, UnzipInflate, strToU8, zipSync, type Zippable } from 'fflate';
import { z } from 'zod';
import { FONT_FAMILIES } from '@/domain/fonts';
import { createId } from '@/domain/ids';
import { ASSET_LIMITS, IMPORT_LIMITS } from '@/domain/limits';
import { parseProject, SchemaVersionError } from '@/domain/migrations';
import { remapProject } from '@/domain/remap';
import { CURRENT_SCHEMA_VERSION, exportManifestSchema, projectSchema, type Asset, type ExportManifest, type Project } from '@/domain/schema';
import { resolveTokens } from '@/features/brandbook/viewModel';
import { ingestFile, type Decoder } from '@/features/assets/ingest';

export const APP_VERSION = '1.0.0';
const EXT: Record<Asset['mimeType'], string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/svg+xml': 'svg' };

async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------- tokens

/** CSS-safe custom property suffix derived from a stable ID, never from a (Cyrillic) name. */
export function cssTokenName(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

const cssComment = (text: string) => text.replace(/\*\//g, '* /').replace(/[\r\n]+/g, ' ');

export function buildTokens(project: Project): { json: string; css: string } {
  const roles = resolveTokens(project);
  const typography = Object.fromEntries(
    Object.entries(project.brand.typography).map(([role, t]) => [
      role,
      { fontFamily: FONT_FAMILIES[t.familyId].label, fontWeight: t.weight, fontSizePx: t.sizePx, lineHeight: t.lineHeight, letterSpacingEm: t.trackingEm },
    ]),
  );
  const json = {
    $schema: 'brandfolio-tokens/1',
    brand: project.brand.cover.title || project.title,
    colors: project.brand.colors.map((c) => ({ id: c.id, cssVariable: `--bf-color-${cssTokenName(c.id)}`, name: c.name, role: c.role, hex: c.hex })),
    roles,
    typography,
  };
  const lines = [
    `/* Brandfolio tokens: ${cssComment(json.brand)} */`,
    ':root {',
    ...project.brand.colors.map((c) => `  --bf-color-${cssTokenName(c.id)}: ${c.hex}; /* ${cssComment(c.name || c.role)} */`),
    ...(['background', 'text', 'primary', 'secondary', 'accent'] as const).map((r) => `  --bf-${r}: ${roles[r]};`),
    ...Object.entries(project.brand.typography).flatMap(([role, t]) => [
      `  --bf-font-${role}-family: '${FONT_FAMILIES[t.familyId].label}';`,
      `  --bf-font-${role}-weight: ${t.weight};`,
      `  --bf-font-${role}-size: ${t.sizePx}px;`,
      `  --bf-font-${role}-line-height: ${t.lineHeight};`,
      `  --bf-font-${role}-letter-spacing: ${t.trackingEm}em;`,
    ]),
    '}',
    '',
  ];
  return { json: JSON.stringify(json, null, 2) + '\n', css: lines.join('\n') };
}

// ---------------------------------------------------------------- export

const README = (title: string, date: string) => `Brandfolio — архив проекта «${title}»
Создан: ${date}

Содержимое
  project.json  документ проекта и список файлов (schemaVersion ${CURRENT_SCHEMA_VERSION})
  assets/       логотипы и изображения
  tokens.json   цвета и типографика в JSON
  tokens.css    те же токены как CSS custom properties

Как восстановить
  Откройте Brandfolio → «Проекты» → «Импорт архива» и выберите этот файл.
  Проект будет создан как новый; существующие проекты не изменятся.

Шрифты Manrope, Noto Sans и Noto Serif распространяются по SIL Open Font License 1.1.
`;

export async function exportArchive(project: Project, assets: readonly Asset[], now = new Date()): Promise<Blob> {
  const valid = projectSchema.parse(project);
  const byId = new Map(assets.map((a) => [a.id, a]));
  const files: Zippable = {};
  const manifestAssets: ExportManifest['assets'] = [];
  for (const id of valid.assetIds) {
    const asset = byId.get(id);
    if (!asset) throw new Error(`Нет файла ассета ${id}`);
    const bytes = new Uint8Array(await asset.blob.arrayBuffer());
    const path = `assets/${id}.${EXT[asset.mimeType]}`;
    files[path] = [bytes, { level: asset.mimeType === 'image/svg+xml' ? 6 : 0 }];
    manifestAssets.push({ id, kind: asset.kind, mimeType: asset.mimeType, filename: asset.filename, byteSize: bytes.byteLength, width: asset.width, height: asset.height, path, sha256: await sha256(bytes) });
  }
  const manifest: ExportManifest = { format: 'brandfolio-project', schemaVersion: CURRENT_SCHEMA_VERSION, exportedAt: now.toISOString(), appVersion: APP_VERSION, assets: manifestAssets };
  const tokens = buildTokens(valid);
  files['project.json'] = strToU8(JSON.stringify({ ...manifest, project: valid }, null, 2));
  files['tokens.json'] = strToU8(tokens.json);
  files['tokens.css'] = strToU8(tokens.css);
  files['README.txt'] = strToU8(README(valid.title, now.toISOString().slice(0, 10)));
  const zipped = zipSync(files, { level: 6 });
  return new Blob([zipped], { type: 'application/zip' });
}

// ---------------------------------------------------------------- import

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportError';
  }
}

const ALLOWED_ROOT = new Set(['project.json', 'tokens.json', 'tokens.css', 'README.txt']);
const ASSET_PATH = /^assets\/[A-Za-z0-9_-]{1,64}\.(png|jpg|svg)$/;

/**
 * Streams the ZIP and enforces limits while inflating: file count, per-file
 * and total unpacked size, allowed paths (no traversal, no nested archives).
 */
export function unpackLimited(bytes: Uint8Array): Map<string, Uint8Array> {
  if (bytes.byteLength > IMPORT_LIMITS.maxArchiveBytes) throw new ImportError('Архив больше 40 МиБ.');
  if (bytes.byteLength < 22 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new ImportError('Файл не является ZIP-архивом.');
  const files = new Map<string, Uint8Array>();
  let total = 0;
  let count = 0;
  let failure: ImportError | null = null;
  const fail = (message: string) => {
    failure ??= new ImportError(message);
  };

  const unzip = new Unzip();
  unzip.register(UnzipInflate);
  unzip.onfile = (file) => {
    if (failure) return;
    const name = file.name;
    if (name.endsWith('/')) return; // directory entry
    if (++count > IMPORT_LIMITS.maxFiles) return fail(`В архиве больше ${IMPORT_LIMITS.maxFiles} файлов.`);
    if (name.includes('..') || name.startsWith('/') || name.includes('\\') || /^[a-z]:/i.test(name) || name.includes('\0')) {
      return fail(`Недопустимый путь в архиве: ${name}`);
    }
    if (!ALLOWED_ROOT.has(name) && !ASSET_PATH.test(name)) return fail(`В архиве неожиданный файл: ${name}. Импортируются только архивы Brandfolio.`);
    if (files.has(name)) return fail(`Файл повторяется в архиве: ${name}`);
    const limit = name === 'project.json' ? IMPORT_LIMITS.maxProjectJsonBytes : name.startsWith('assets/') ? ASSET_LIMITS.maxBytes : 1024 * 1024;
    if (file.originalSize !== undefined && file.originalSize > limit) return fail(`Файл ${name} слишком большой.`);
    const chunks: Uint8Array[] = [];
    let size = 0;
    file.ondata = (err, data, final) => {
      if (failure) return;
      if (err) return fail(`Архив повреждён: ${err.message}`);
      size += data.length;
      total += data.length;
      if (size > limit) {
        file.terminate();
        return fail(`Файл ${name} слишком большой после распаковки.`);
      }
      if (total > IMPORT_LIMITS.maxUnpackedBytes) {
        file.terminate();
        return fail('Распакованный архив больше 100 МиБ.');
      }
      chunks.push(data);
      if (final) {
        const out = new Uint8Array(size);
        let offset = 0;
        for (const c of chunks) {
          out.set(c, offset);
          offset += c.length;
        }
        if (name.startsWith('assets/') && out[0] === 0x50 && out[1] === 0x4b) return fail(`Вложенные архивы не поддерживаются: ${name}`);
        files.set(name, out);
      }
    };
    try {
      file.start();
    } catch {
      fail(`Неподдерживаемый способ сжатия: ${name}`);
    }
  };

  const CHUNK = 64 * 1024;
  try {
    for (let offset = 0; offset < bytes.length && !failure; offset += CHUNK) {
      unzip.push(bytes.subarray(offset, offset + CHUNK), offset + CHUNK >= bytes.length);
    }
  } catch (error) {
    fail(`Архив повреждён: ${error instanceof Error ? error.message : error}`);
  }
  if (failure) throw failure;
  if (!files.has('project.json')) throw new ImportError(count === 0 ? 'Архив пустой.' : 'В архиве нет project.json.');
  return files;
}

const archiveDocSchema = exportManifestSchema.extend({ project: z.unknown() });

export type ImportedProject = { project: Project; assets: Asset[] };

/**
 * Validates an archive and returns a ready-to-store project with new IDs.
 * Nothing is written here; the caller stores the result in one transaction.
 */
export async function readArchive(file: Blob, options: { decode?: Decoder } = {}): Promise<ImportedProject> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const files = unpackLimited(bytes);

  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(files.get('project.json')!));
  } catch {
    throw new ImportError('project.json повреждён или не в UTF-8.');
  }
  const version = (raw as { schemaVersion?: unknown })?.schemaVersion;
  if (typeof version === 'number' && version > CURRENT_SCHEMA_VERSION) {
    throw new ImportError(`Архив создан более новой версией Brandfolio (схема ${version}, поддерживается до ${CURRENT_SCHEMA_VERSION}). Обновите приложение.`);
  }
  const doc = archiveDocSchema.safeParse(raw);
  if (!doc.success) throw new ImportError(`Неверная структура project.json: ${doc.error.issues[0]?.path.join('.') || ''} ${doc.error.issues[0]?.message ?? ''}`.trim());

  let project: Project;
  try {
    project = parseProject(doc.data.project);
  } catch (error) {
    if (error instanceof SchemaVersionError) throw new ImportError(error.message);
    const issue = error instanceof z.ZodError ? error.issues[0] : undefined;
    throw new ImportError(`Проект в архиве не прошёл проверку${issue ? `: ${issue.path.join('.')} — ${issue.message}` : ''}.`);
  }

  const manifest = new Map(doc.data.assets.map((a) => [a.id, a]));
  if (manifest.size !== doc.data.assets.length) throw new ImportError('Список файлов в project.json содержит повторы.');
  const newProjectId = createId('p');
  const assetIdMap = new Map<string, string>();
  const assets: Asset[] = [];
  for (const id of project.assetIds) {
    const entry = manifest.get(id);
    if (!entry) throw new ImportError(`В описании архива нет файла для ассета ${id}.`);
    const data = files.get(entry.path);
    if (!data) throw new ImportError(`В архиве отсутствует файл ${entry.path}.`);
    const copy = new Uint8Array(data);
    if ((await sha256(copy)) !== entry.sha256) throw new ImportError(`Файл ${entry.path} повреждён: контрольная сумма не совпадает.`);
    // Re-validate as if freshly uploaded: type from bytes, limits, SVG sanitizing, decoding.
    const result = await ingestFile(new File([copy], entry.filename), { kind: entry.kind, projectId: newProjectId, allowSvg: entry.kind === 'logo', decode: options.decode });
    if (!result.ok) throw new ImportError(`Файл ${entry.filename}: ${result.error}`);
    if (result.asset.mimeType !== entry.mimeType) throw new ImportError(`Тип файла ${entry.filename} не совпадает с описанием.`);
    assetIdMap.set(id, result.asset.id);
    assets.push(result.asset);
  }

  const remapped = remapProject(project, newProjectId, assetIdMap);
  const now = new Date().toISOString();
  const imported = projectSchema.parse({ ...remapped, revision: 0, createdAt: now, updatedAt: now });
  return { project: imported, assets };
}
