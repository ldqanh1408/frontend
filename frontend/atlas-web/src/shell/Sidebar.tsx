import { Link, useLocation } from 'react-router';
import { nav } from '../data/catalog';
import { useApp } from '../data/app-store';
import { Icon } from '../components/Icon';
import type { ModuleRoute } from '../data/types';
import { prefetchModule } from './prefetch';

export const modulePath = (r: ModuleRoute) => (r === 'home' ? '/' : `/${r}`);

export function activeModule(pathname: string): ModuleRoute | null {
  if (pathname === '/') return 'home';
  const seg = pathname.split('/')[1];
  return seg in nav.modules ? (seg as ModuleRoute) : null;
}

export function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const active = activeModule(pathname);
  const connection = useApp((s) => s.connection);
  const scope = useApp((s) => s.session?.scope);
  const audience = useApp((s) => s.session?.audience);
  return (
    <>
      <div className="nav-scroll">
        <Link to="/" className="brand" onClick={onNavigate} aria-label="Atlas home">
          <span className="brand-mark" aria-hidden="true">A</span><span>atlas</span>
        </Link>
        <span className="caption">{connection === 'connected' ? (audience === 'observer' ? 'Observer session' : 'Workspace session') : 'Device workspace'}</span>
        <div className="scope-card">
          {connection === 'connected' && scope ? (
            <><strong className="break">{scope.label}</strong><span className="caption">Authorized service scope</span></>
          ) : (
            <><strong>Device draft area</strong><span className="caption">No tenant inferred</span></>
          )}
        </div>
        <nav aria-label="Workspace">
          {nav.groups.map((g) => (
            <div key={g.label}>
              <h2 className="nav-group-label">{g.label}</h2>
              <ul className="nav-list" role="list">
                {g.routes.map((r) => {
                  const m = nav.modules[r];
                  return (
                    <li key={r}>
                      {r === 'observer' ? <a href={import.meta.env.VITE_OBSERVER_URL || '/observer'} className="nav-link"><Icon name={m.icon} />{m.label}</a> : <Link to={modulePath(r)} className="nav-link" aria-current={active === r ? 'page' : undefined} onClick={onNavigate} onPointerEnter={() => prefetchModule(r)} onFocus={() => prefetchModule(r)}>
                        <Icon name={m.icon} />{m.label}
                      </Link>}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="nav-footer">
        <Link to="/definitions" className="btn btn-block" onClick={onNavigate} aria-current={pathname.startsWith('/definitions') ? 'page' : undefined}>
          <Icon name="layers" />Browse definitions
        </Link>
      </div>
    </>
  );
}

export function Sidebar() {
  return <aside className="app-nav" aria-label="Workspace navigation"><NavContent /></aside>;
}
