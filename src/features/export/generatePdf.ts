import { pdf } from '@react-pdf/renderer';
import { createElement } from 'react';
import { SECTION_LABELS } from '@/domain/project';
import type { Asset, Project } from '@/domain/schema';
import { rasterizeSvg } from '@/features/assets/rasterize';
import { buildViewModel, type BrandbookViewModel } from '@/features/brandbook/viewModel';
import { BrandbookPdf } from '@/templates/pdf/BrandbookPdf';
import { registerPdfFonts } from './pdfFonts';

export class MissingAssetError extends Error {
  readonly missing: string[];
  constructor(missing: string[]) {
    super(`Не найдены файлы: ${missing.join('; ')}. Загрузите их заново в редакторе.`);
    this.name = 'MissingAssetError';
    this.missing = missing;
  }
}

export type PdfResult = { blob: Blob; vm: BrandbookViewModel; pageCount: number | null };

/**
 * Renders the PDF for one immutable project snapshot. The caller passes the
 * snapshot taken when the user pressed "export", so edits made while the PDF
 * is being generated cannot produce a mixed version.
 */
export async function generatePdf(snapshot: Project, assets: readonly Asset[], onPhase?: (phase: 'preparing' | 'generating') => void): Promise<PdfResult> {
  onPhase?.('preparing');
  const byId = new Map(assets.map((a) => [a.id, a]));
  const metas = new Map(assets.map(({ blob: _blob, ...meta }) => [meta.id, meta]));
  const vm = buildViewModel(snapshot, metas);

  const referenced = collectReferences(snapshot);
  const missing = referenced.filter((r) => !byId.has(r.id)).map((r) => r.where);
  if (missing.length) throw new MissingAssetError(missing);

  registerPdfFonts();
  const images = new Map<string, Blob>();
  for (const id of vm.requiredAssetIds) {
    const asset = byId.get(id)!;
    images.set(id, asset.mimeType === 'image/svg+xml' ? await rasterizeSvg(await asset.blob.text()) : asset.blob);
  }

  onPhase?.('generating');
  const blob = await pdf(createElement(BrandbookPdf, { vm, images }) as Parameters<typeof pdf>[0]).toBlob();
  return { blob, vm, pageCount: await countPages(blob) };
}

function collectReferences(project: Project): { id: string; where: string }[] {
  const refs: { id: string; where: string }[] = [];
  const visible = new Set(project.sections.filter((s) => s.visible).map((s) => s.kind));
  const logoUsed = visible.has('logo') || visible.has('cover') || visible.has('applications');
  if (logoUsed) {
    for (const [kind, id] of Object.entries(project.brand.logo.variants)) if (id) refs.push({ id, where: `${SECTION_LABELS.logo}: ${kind}` });
  }
  if (visible.has('imagery')) project.brand.imagery.images.forEach((img, i) => refs.push({ id: img.assetId, where: `${SECTION_LABELS.imagery}: изображение ${i + 1}` }));
  return refs;
}

/** Counts /Type /Page objects; good enough for a status line, null if unsure. */
async function countPages(blob: Blob): Promise<number | null> {
  try {
    const text = new TextDecoder('latin1').decode(await blob.arrayBuffer());
    return text.match(/\/Type\s*\/Page\b/g)?.length ?? null;
  } catch {
    return null;
  }
}
