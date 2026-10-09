import { ScopeSwitcher } from '../views/modules/ScopeSwitcher';
import { lazy, Suspense, useState } from 'react';
import { Dialog } from '../components/overlays';
import { Link } from 'react-router';
import { Button, Kbd } from '../components/ui';
import { setTheme, useApp } from '../data/app-store';
import { usePageMetaValue } from './page-meta';

const NotificationInbox = lazy(() => import('../views/live/NotificationInbox'));
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export function TopBar({ onOpenNav, onOpenSearch, onOpenHelp, onOpenPrefs, navOpen }: {
  onOpenNav: () => void; onOpenSearch: () => void; onOpenHelp: () => void; onOpenPrefs: () => void; navOpen: boolean;
}) {
  const [inbox, setInbox] = useState(false);
  const { crumbs, title } = usePageMetaValue();
  const theme = useApp((s) => s.theme);
  const connection = useApp((s) => s.connection);
  const trail = crumbs.length ? crumbs : [{ label: title }];
  return (
    <header className="app-bar">
      <Button className="menu-toggle" variant="quiet" iconOnly icon="menu" onClick={onOpenNav} aria-expanded={navOpen} aria-haspopup="dialog">
        Open workspace navigation
      </Button>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li><Link to="/">Workspace</Link></li>
          {trail.map((c, i) => (
            <li key={i} aria-current={i === trail.length - 1 ? 'page' : undefined}>{c.to && i < trail.length - 1 ? <Link to={c.to}>{c.label}</Link> : <span className="breadcrumb-label">{c.label}</span>}</li>
          ))}
        </ol>
      </nav>
      <div className="bar-actions">
        <Button className="search-trigger" icon="search" onClick={event => { event.currentTarget.focus(); onOpenSearch(); }} aria-label="Search workspace" aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}>
          <span className="search-label">Search workspace</span><Kbd>{isMac ? '⌘ K' : 'Ctrl K'}</Kbd>
        </Button>
        <Link to="/connection" className={`badge hide-xs ${connection === 'connected' ? 'badge-success' : connection === 'ended' ? 'badge-warning' : ''}`} aria-label={`Service ${connection === 'connected' ? 'connected' : connection === 'ended' ? 'session ended' : 'disconnected'} — open connection`}>
          {connection === 'connected' ? 'Service connected' : connection === 'ended' ? 'Session ended' : 'Service disconnected'}
        </Link>
        <Button variant="quiet" iconOnly icon={theme === 'dark' ? 'sun' : 'moon'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
          {theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        </Button>
        <Button variant="quiet" iconOnly icon="bell" onClick={() => setInbox(true)}>Open notification inbox</Button>
        <Button variant="quiet" iconOnly icon="sliders" className="hide-xs" onClick={onOpenPrefs}>Display preferences</Button>
        <Button variant="quiet" iconOnly icon="help" onClick={onOpenHelp} aria-keyshortcuts="Shift+?">Help and keyboard shortcuts</Button>
      </div>
      <Dialog open={inbox} onOpenChange={setInbox} title="Notification inbox"><Suspense fallback={<p className="caption">Loading inbox…</p>}><NotificationInbox/></Suspense></Dialog>
    </header>
  );
}

export function StatusBar() {
  const connection = useApp((s) => s.connection);
  const scope = useApp((s) => s.session?.scope.label);
  return (
    <footer className="app-status">
      <span>{connection === 'connected' ? `Service session · ${scope ?? 'authorized scope'}` : 'Device drafts / disconnected service'}</span>
      <span>Acknowledgement ≠ effective execution</span>
    </footer>
  );
}

export function TenantContext() {
  const scope = useApp(s => s.session?.scope);
  return <div className="tenant-context" aria-label="Tenant context">{[['Organization', scope?.org], ['Workspace', scope?.workspace], ['Project', scope?.project]].map(([label, value]) => <span key={label}><strong>{label}</strong><span className="muted break">{value || 'Not observed'}</span></span>)}<Link to="/tenancy" className="caption">Review scope</Link><ScopeSwitcher /></div>;
}
