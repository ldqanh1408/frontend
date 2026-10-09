import { Link } from 'react-router';
import type { Scene, ViewEntry } from '../../data/types';
import type { ResolvedAction } from './model';
import { Badge, Banner, Button } from '../../components/ui';
import { setTheme, useApp } from '../../data/app-store';
import { FieldFacts, sceneText } from './parts';
import { requiresServiceAction } from '../../data/permissions';

/** Account screens follow GAP/J01. Authentication never completes in a local scene. */
export default function BareScene({ scene, actions, onAction, view }: { scene: Scene; actions: ResolvedAction[]; onAction: (to: string, kind: string) => void; view: ViewEntry }) {
  const theme = useApp((s) => s.theme);
  const t = sceneText(scene);
  return <div className="bare">
    <section className="bare-brand" aria-label="About Atlas"><div className="row-between"><Link to="/" className="brand"><span className="brand-mark" aria-hidden="true">A</span><span>atlas</span></Link><Button variant="quiet" iconOnly icon={theme === 'dark' ? 'sun' : 'moon'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}</Button></div>
      {__ATLAS_REVIEW__ && <Badge tone="warning">Illustrative</Badge>}
      <p className="bare-promise">From source<br />to shared clarity.</p><p className="secondary">A focused workspace for specifications, code intelligence and accountable agent work.</p>
      <div className="bare-scope stack-12"><strong className="label">Identity first. Scope always.</strong><p className="caption">Your account opens only the organizations, workspaces and projects you are authorized to use.</p></div>
    </section>
    <main className="bare-main" aria-labelledby="bare-title"><div className="bare-card stack-24"><div className="stack-12"><span className="eyebrow">{view.id === 'workspace/login' ? 'Welcome to Atlas' : view.title}</span><h1 id="bare-title" tabIndex={-1} data-page-title>{t.title}</h1>{t.copy && <p className="secondary">{t.copy}</p>}</div>
      <FieldFacts fields={scene.fields} />
      {scene.disabled.length > 0 && <Banner tone="warning" title={t.state}>{__ATLAS_REVIEW__ ? scene.disabled[0].reason : scene.disabled[0].prodReason}</Banner>}
      <Banner tone="info" title="Company SSO">Authentication is provided by your Atlas service. Sign-in and invitation acceptance require your identity provider and an authenticated session.</Banner>
      <div className="stack-12">{actions.map((a, i) => {
        const protectedAction = requiresServiceAction(a.label) || /^(continue with|accept invitation|request .*invitation)/i.test(a.label);
        const reason = protectedAction ? 'Configure your identity provider and an authorized service before this account action.' : a.kind === 'effect' || a.kind === 'none' ? a.reason : undefined;
        return <Button key={i} data-action-kind={protectedAction ? 'effect' : a.kind} block variant={a.style === 'Primary' ? 'primary' : a.style === 'Danger' ? 'danger' : a.style === 'Quiet' ? 'quiet' : 'secondary'} blocked={reason} onClick={() => a.to && onAction(a.to, a.kind)}>{a.label}</Button>;
      })}</div>
      <Link className="caption" to="/connection">Configure the service connection</Link><p className="caption">{__ATLAS_REVIEW__ ? 'Illustrative account view. No authentication result is verified.' : 'No authenticated identity or tenant scope has been observed.'}</p>
    </div></main>
  </div>;
}
