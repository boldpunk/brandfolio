import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { AnnouncerProvider } from './components/ui/Announcer';
import { router } from './app/router';
import { initAnalytics } from './lib/analytics';
import './index.css';

initAnalytics();

const root = document.getElementById('root');
if (!root) throw new Error('Root element missing');

createRoot(root).render(
  <StrictMode>
    <AnnouncerProvider>
      <RouterProvider router={router} />
    </AnnouncerProvider>
  </StrictMode>,
);
