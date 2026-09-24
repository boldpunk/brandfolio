/**
 * Renders a sanitized SVG to a PNG Blob for the PDF, where react-pdf's own SVG
 * support is too limited to be faithful. The sanitized SVG stays the source of
 * truth in storage and archives.
 */
export async function rasterizeSvg(svg: string, longSidePx = 1600): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    const ratio = image.naturalWidth / image.naturalHeight || 1;
    const width = ratio >= 1 ? longSidePx : Math.round(longSidePx * ratio);
    const height = ratio >= 1 ? Math.round(longSidePx / ratio) : longSidePx;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D недоступен');
    ctx.drawImage(image, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Не удалось создать PNG'))), 'image/png'),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
