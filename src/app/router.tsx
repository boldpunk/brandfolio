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
const AuthPage = lazy(() => import('@/features/account/AuthPage'));
const AccountPage = lazy(() => import('@/features/account/AccountPage'));
const SharedPage = lazy(() => import('@/features/share/SharedPage'));
const PricingPage = lazy(() => import('@/features/billing/PricingPage'));

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
          { path: '/login', element: page(<AuthPage />) },
          { path: '/register', element: page(<AuthPage />) },
          { path: '/account', element: page(<AccountPage />) },
          { path: '/pricing', element: page(<PricingPage />) },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      { path: '/editor/:projectId', element: page(<EditorPage />) },
      { path: '/preview/:projectId', element: page(<PreviewPage />) },
      // Public read-only brand book behind a share link.
      { path: '/b/:slug', element: page(<SharedPage />) },
    ],
  },
],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' },
);
