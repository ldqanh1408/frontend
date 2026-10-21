import { Link, useRouteError, isRouteErrorResponse } from 'react-router';
import { useApp } from '../data/app-store';
import { Badge, ButtonLink, EmptyState, PageHeader } from '../components/ui';
import { usePageMeta } from '../shell/page-meta';

/** States the authority behind what the page shows (device drafts vs. authorized service) — replaces Figma's "Design example" banner. */
export function ProvenanceBanner({ detail }: { detail?: string }) {
  const connection = useApp((s) => s.connection);
  const scope = useApp((s) => s.session?.scope.label);
  if (__ATLAS_REVIEW__) {
    return (
      <div className="provenance" role="note">
        <Badge className="illustrative">Illustrative</Badge>
        <p>Design review build — sample data from the Figma fixtures. No provider, run, PR, CI or cleanup is verified.</p>
      </div>
    );
  }
  return (
    <div className="provenance" role="note">
      <Badge tone={connection === 'connected' ? 'success' : 'neutral'}>{connection === 'connected' ? 'Authorized service' : 'Device drafts'}</Badge>
      <p id="provenance-note">
        {connection === 'connected'
          ? `Records come from the connected service for ${scope ?? 'the current scope'}. Acknowledgements are not effects until read back.`
          : 'No service is connected. Local drafts stay on this device; no provider, run, PR, CI or cleanup result is inferred.'}
        {detail ? ` ${detail}` : ''}
      </p>
      {connection !== 'connected' && <Link to="/connection" className="caption">Connect a service</Link>}
    </div>
  );
}

export function NotFound() {
  usePageMeta('View not found', [{ label: 'Not found' }]);
  return (
    <div className="page">
      <PageHeader title="Workspace view not found" purpose="This link does not identify a supported view. No fallback service resource was loaded." />
      <EmptyState icon="search" title="This view is unavailable" actions={<ButtonLink to="/" icon="home">Return to overview</ButtonLink>}>Check the link or choose a supported workspace view from navigation.</EmptyState>
    </div>
  );
}

export function RouteError() {
  const err = useRouteError();
  const msg = isRouteErrorResponse(err) ? `${err.status} ${err.statusText}` : err instanceof Error ? err.message : 'Unexpected error';
  return (
    <div className="page" role="alert">
      <h1 tabIndex={-1} data-page-title>Something went wrong</h1>
      <EmptyState icon="danger" title="This view could not be displayed" actions={<><ButtonLink to="/" icon="home">Return to overview</ButtonLink><button className="btn" onClick={() => location.reload()}>Reload</button></>}>
        {msg}. Your device drafts are kept. Reload to try again, or return to the overview.
      </EmptyState>
    </div>
  );
}
