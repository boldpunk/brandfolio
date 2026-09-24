import { pdf } from '@react-pdf/renderer';
import { useEffect, useRef, useState } from 'react';
import { rasterizeSvg } from '@/features/assets/rasterize';
import { sanitizeSvg } from '@/features/assets/svgSanitizer';
import { registerPdfFonts } from '../pdfFonts';
import { PrototypeDocument } from './PrototypeDocument';
import pngUrl from '@/tests/fixtures/ring-alpha.png?url';
import svgSource from '@/tests/fixtures/mark.svg?raw';

type State =
  | { status: 'idle' }
  | { status: 'preparing' }
  | { status: 'generating' }
  | { status: 'ready'; url: string; bytes: number }
  | { status: 'error'; message: string };

/** Dev-only page used to verify the PDF pipeline in a real browser. */
export default function PdfPrototypePage() {
  const [state, setState] = useState<State>({ status: 'idle' });
  const urlRef = useRef<string | null>(null);

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  async function generate() {
    try {
      setState({ status: 'preparing' });
      registerPdfFonts();
      const png = await (await fetch(pngUrl)).blob();
      const clean = sanitizeSvg(svgSource);
      if (!clean.ok) throw new Error(clean.reason);
      const svgRaster = await rasterizeSvg(clean.svg);
      setState({ status: 'generating' });
      const blob = await pdf(<PrototypeDocument images={{ png, svgRaster }} />).toBlob();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = URL.createObjectURL(blob);
      setState({ status: 'ready', url: urlRef.current, bytes: blob.size });
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h1>Прототип PDF</h1>
      <button type="button" onClick={generate} disabled={state.status === 'preparing' || state.status === 'generating'}>
        Сгенерировать
      </button>
      <p role="status" data-testid="pdf-status">
        {state.status === 'idle' && 'Готов к генерации'}
        {state.status === 'preparing' && 'Подготовка ресурсов…'}
        {state.status === 'generating' && 'Генерация PDF…'}
        {state.status === 'ready' && `Готово, ${Math.round(state.bytes / 1024)} КБ`}
        {state.status === 'error' && `Ошибка: ${state.message}`}
      </p>
      {state.status === 'ready' && (
        <>
          <a href={state.url} download="brandfolio-prototype.pdf" data-testid="pdf-download">
            Скачать PDF
          </a>
          <iframe title="PDF" src={state.url} style={{ width: '100%', height: '80vh', border: '1px solid #ccc', marginTop: 12 }} />
        </>
      )}
    </main>
  );
}
