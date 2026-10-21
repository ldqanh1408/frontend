import { lazy, Suspense } from 'react';
import type { Scene, SceneIndexEntry, ViewEntry } from '../../data/types';
import type { ResolvedAction } from './model';
import { Badge, Banner, Button, EmptyState, Panel, Stages, Spinner } from '../../components/ui';
import { ProvenanceBanner } from '../shared';
import { Inspector, SceneFields, EvidenceTabs, sceneText } from './parts';
import IdeScene from './IdeScene';
import ReviewScene from './ReviewScene';
import TableScene from './TableScene';
import StatePatternScene from './StatePatternScene';
import RunScene from './RunScene';
import TerminalScene from './TerminalScene';
import DiffScene from './DiffScene';
import PlanScene from './PlanScene';
import PaletteScene from './PaletteScene';
import BareScene from './BareScene';
import ExecutionWorkspace from '../execution/ExecutionWorkspace';
import { permissionReason, requiresServiceAction } from '../../data/permissions';

const SchemaSceneForm = lazy(() => import('../definitions/SchemaSceneForm'));
const LifecycleBody = lazy(() => import('./LifecycleBody'));
export { sceneText } from './parts';
export const btnVariant = (s: string) => (s === 'Primary' ? 'primary' : s === 'Danger' ? 'danger' : s === 'Quiet' ? 'quiet' : 'secondary') as 'primary' | 'danger' | 'quiet' | 'secondary';

export function ActionBar({ actions, onAction, label = 'Actions' }: { actions: ResolvedAction[]; onAction: (to: string, kind: string) => void; label?: string }) {
  if (!actions.length) return null;
  return <div className="row scene-actions" role="group" aria-label={label}>{actions.map((a, i) => {
    const protectedAction = requiresServiceAction(a.label);
    const reason = protectedAction ? permissionReason(a.label) ?? a.reason ?? 'Requires an approved service command and the current resource revision. A design-state link cannot apply this action.' : a.kind === 'effect' || a.kind === 'none' ? a.reason : undefined;
    return <Button key={i} data-action-kind={protectedAction ? 'effect' : a.kind} variant={btnVariant(a.style)} blocked={reason} onClick={() => a.to && onAction(a.to, a.kind)}>{a.label}</Button>;
  })}</div>;
}

export function SceneRenderer({ scene, view, actions, onAction, bare, isDefault, onReset }: {
  scene: Scene; view: ViewEntry; index: Record<string, SceneIndexEntry>; actions: ResolvedAction[]; onAction: (to: string, kind: string) => void;
  bare?: boolean; isDefault: boolean; onReset: () => void;
}) {
  if (bare) return <BareScene scene={scene} actions={actions} onAction={onAction} view={view} />;
  const t = sceneText(scene);
  const inspector = <Inspector scene={scene} view={view} />;
  const execution = /^execution(?:-|$)/.test(scene.key) && ['run', 'tasklist'].includes(scene.kind);
  return <div className="page">
    <header className="page-head"><div className="page-head-text"><div className="row"><span className="eyebrow">{view.title}</span>{!isDefault && <Button compact variant="quiet" icon="arrow-left" onClick={onReset}>Back to default</Button>}</div><h1 tabIndex={-1} data-page-title>{t.title}</h1>{t.copy && <p>{t.copy}</p>}</div><Badge>{t.state}</Badge></header>
    <ProvenanceBanner />
    <ActionBar actions={actions} onAction={onAction} label={`${t.title} actions`} />
    {execution ? <ExecutionWorkspace initialMode={scene.kind === 'tasklist' ? 'list' : undefined} /> : scene.kind === 'ide' ? <IdeScene scene={scene} onAction={onAction} inspector={inspector} /> : <div className="split-wide"><div className="stack-16"><SceneBody scene={scene} actions={actions} onAction={onAction} /></div>{inspector}</div>}
  </div>;
}

function SceneBody({ scene, actions, onAction }: { scene: Scene; actions: ResolvedAction[]; onAction: (to: string, kind: string) => void }) {
  if (scene.kind === 'receipt' || scene.receipt) return <Panel title="Operation receipt"><div className="panel-pad stack-12">{__ATLAS_REVIEW__ && scene.receipt ? <><Stages stage={scene.receipt.stage} /><p className="secondary">{scene.receipt.note}</p><p className="caption mono">{scene.receipt.operation}</p></> : <EmptyState icon="receipt" headingLevel={3} title="No operation recorded">An authorized service must acknowledge a request. Effective requires a matching effect readback.</EmptyState>}</div></Panel>;
  if (scene.kind === 'lifecycle') return <Suspense fallback={<Spinner />}><LifecycleBody scene={scene} /></Suspense>;
  if (scene.kind === 'confirm') {
    const danger = actions.find((a) => a.style === 'Danger') ?? actions.at(-1);
    return <Panel title="Confirm this request"><div className="panel-pad stack-12"><Banner tone="warning" title="Review the exact scope and impact">{sceneText(scene).copy || 'This request may not be reversible.'}</Banner>{scene.schema && <Suspense fallback={<Spinner />}><SchemaSceneForm schemaId={scene.schema} sceneTitle={sceneText(scene).title} /></Suspense>}{danger && <p className="caption">Primary consequence: {danger.label}. Unknown keeps the original operation identity for reconciliation.</p>}</div></Panel>;
  }
  if (scene.schema && scene.kind === 'form') return <Suspense fallback={<Spinner />}><SchemaSceneForm schemaId={scene.schema} sceneTitle={sceneText(scene).title} /></Suspense>;
  const props = { scene, onAction };
  switch (scene.kind) {
    case 'review': return <ReviewScene {...props} />;
    case 'table': return <TableScene {...props} />;
    case 'statepattern': return <StatePatternScene {...props} />;
    case 'run': case 'observer': case 'trace': return <RunScene {...props} />;
    case 'terminal': return <TerminalScene {...props} />;
    case 'diff': case 'merge': return <DiffScene {...props} />;
    case 'plan': case 'workflow': case 'tasklist': return <PlanScene {...props} />;
    case 'palette': return <PaletteScene {...props} />;
    default: return <>{scene.kind === 'notice' && scene.disabled.length > 0 && <Banner tone="warning" title={sceneText(scene).state}>{__ATLAS_REVIEW__ ? scene.disabled[0].reason : scene.disabled[0].prodReason}</Banner>}<SceneFields scene={scene} /><EvidenceTabs {...props} /></>;
  }
}
