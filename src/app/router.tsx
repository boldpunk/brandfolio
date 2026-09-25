import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter } from 'react-router';
import { useMessages } from '@/i18n/core';
import { commonMessages } from '@/i18n/messages/common';
import { AppShell } from './AppShell';
import { NotFoundPage, RouteErrorPage } from './StatusPages';

const HomePage = lazy(() => import('@/features/home/HomePage'));
const ProjectsPage = lazy(() => import('@/features/projects/ProjectsPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));
const EditorPage = lazy(() => import('@/features/editor/EditorPage'));
const PreviewPage = lazy(() => import('@/features/brandbook/PreviewPage'));

function Loading() {
  return <p className="p-8 text-muted">{useMessages(commonMessages).loading}</p>;
}

const page = (node: ReactNode) => <Suspense fallback={<Loading />}>{node}</Suspense>;

export const router = createBrowserRouter(
  [
  {
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: page(<HomePage />) },
          { path: '/projects', element: page(<ProjectsPage />) },
          { path: '/settings', element: page(<SettingsPage />) },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      { path: '/editor/:projectId', element: page(<EditorPage />) },
      { path: '/preview/:projectId', element: page(<PreviewPage />) },
    ],
  },
],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' },
);
