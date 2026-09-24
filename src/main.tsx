import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const PdfPrototypePage = lazy(() => import('./features/export/prototype/PdfPrototypePage'));

const root = document.getElementById('root');
if (!root) throw new Error('Root element missing');

createRoot(root).render(
  <StrictMode>
    <Suspense fallback={null}>
      <PdfPrototypePage />
    </Suspense>
  </StrictMode>,
);
