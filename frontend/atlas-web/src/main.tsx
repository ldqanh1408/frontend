import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Outlet, RouterProvider, type RouteObject } from 'react-router';
import '@fontsource-variable/inter';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import { AppShell } from './shell/AppShell';
import { PageMetaProvider, usePageMetaValue } from './shell/page-meta';
import { NotFound, RouteError } from './views/shared';
import { Spinner } from './components/ui';
import { Toaster } from './components/overlays';
import { nav, routes } from './data/catalog';
import { DRAFT_MODULES, SERVICE_MODULES } from './data/module-specs';
import { initStorage } from './lib/storage';
import type { ModuleRoute } from './data/types';

const Overview = lazy(() => import('./views/Overview'));
const ViewPage = lazy(() => import('./views/ViewPage'));
const DefinitionsCatalog = lazy(() => import('./views/definitions/DefinitionsCatalog'));
const DefinitionTypePage = lazy(() => import('./views/definitions/DefinitionTypePage'));
const ServiceModulePage = lazy(() => import('./views/modules/ServiceModulePage'));
const DraftModulePage = lazy(() => import('./views/modules/DraftModulePage'));
const ConnectionPage = lazy(() => import('./views/modules/ConnectionPage'));
const ModuleLanding = lazy(() => import('./views/modules/ModuleLanding'));

function Root() {
  return <PageMetaProvider><Outlet /></PageMetaProvider>;
}

/** Account-level pages (sign-in, invitation) render without the workspace shell. */
function BareLayout() {
  usePageMetaValue();
  return (
    <>
      <Suspense fallback={<div className="page"><Spinner label="Loading" /></div>}><Outlet /></Suspense>
      <Toaster />
    </>
  );
}

function modulePage(r: ModuleRoute) {
  if (r === 'home') return null;
  if (r === 'connection') return <ConnectionPage />;
  if (SERVICE_MODULES[r]) return <ServiceModulePage key={r} module={r} />;
  if (DRAFT_MODULES[r]) return <DraftModulePage key={r} module={r} />;
  return <ModuleLanding key={r} module={r} />;
}

const moduleRoutes: RouteObject[] = (Object.keys(nav.modules) as ModuleRoute[]).filter((r) => r !== 'home').flatMap((r) => {
  const out: RouteObject[] = [{ path: `/${r}`, element: modulePage(r) }];
  if (DRAFT_MODULES[r]) {
    out.push({ path: `/${r}/drafts/:schemaId`, element: <DraftModulePage key={r} module={r} /> });
    out.push({ path: `/${r}/drafts/:schemaId/:defId`, element: <DraftModulePage key={r} module={r} /> });
  }
  return out;
});
const viewRoutes: RouteObject[] = routes.filter((r) => !r.bare && r.route !== '/').map((r) => ({ path: r.route, element: <ViewPage key={r.id} viewId={r.id} /> }));
const bareRoutes: RouteObject[] = routes.filter((r) => r.bare).map((r) => ({ path: r.route, element: <ViewPage key={r.id} viewId={r.id} bare /> }));

const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <RouteError />,
    children: [
      { element: <BareLayout />, children: bareRoutes },
      {
        element: <AppShell />,
        children: [{
          errorElement: <RouteError />,
          children: [
            { index: true, element: <Overview /> },
            { path: '/definitions', element: <DefinitionsCatalog /> },
            { path: '/definitions/:schemaId', element: <DefinitionTypePage /> },
            { path: '/definitions/:schemaId/:defId', element: <DefinitionTypePage /> },
            ...moduleRoutes,
            ...viewRoutes,
            { path: '*', element: <NotFound /> },
          ],
        }],
      },
    ],
  },
]);

initStorage();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
