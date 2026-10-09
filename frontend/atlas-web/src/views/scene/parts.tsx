import { useId, type ReactNode } from 'react';
import type { Scene, ViewEntry } from '../../data/types';
import { Badge, EmptyState, Panel, Button } from '../../components/ui';
import { Tabs } from '../../components/overlays';
import { useApp } from '../../data/app-store';
import { Icon } from '../../components/Icon';

export type SceneProps = { scene: Scene; onAction: (to: string, kind: string) => void };
/** Every display path makes the production/review boundary explicit. */
export const sceneText = (s: Scene) => __ATLAS_REVIEW__
  ? { title: s.title, copy: s.copy, entity: s.entity, state: s.state }
  : { title: s.prodTitle, copy: s.prodCopy, entity: s.prodEntity, state: s.prodState };
export const structuralRows = (scene: Scene) => __ATLAS_REVIEW__ ? scene.rows : scene.rows.filter((r) => !r.sample);

export function FieldFacts({ fields }: { fields: Scene['fields'] }) {
  return <dl className="facts">{fields.map((f, i) => {
    const v = __ATLAS_REVIEW__ && f.value != null && f.value !== '' ? (typeof f.value === 'string' ? f.value : JSON.stringify(f.value)) : null;
    return <div key={i} className="fact"><dt className="label">{f.label}</dt><dd>{v ? <span className="break">{v}</span> : <span className="muted">Not observed</span>}{f.hint && <span className="caption">{f.hint}</span>}</dd></div>;
  })}</dl>;
}
export function SceneFields({ scene }: { scene: Scene }) {
  return scene.fields.length ? <Panel title="Details"><div className="panel-pad"><FieldFacts fields={scene.fields} /></div></Panel> : null;
}
export function RowsList({ scene, onAction }: SceneProps) {
  const rows = structuralRows(scene);
  if (!rows.length) return <div className="panel-pad"><EmptyState headingLevel={3} title="No authorized records loaded">Connect an authorized service to load records for this scope.</EmptyState></div>;
  return <ul className="list scene-rows" role="list">{rows.map((r, i) => <li key={i} className="list-item">
    <Icon name="chevron-right" /><span className="grow stack"><span className="label break">{__ATLAS_REVIEW__ ? r.label : r.prodLabel}</span><span className="caption break">{__ATLAS_REVIEW__ ? r.detail : 'Not observed — requires service data'}</span></span>
    <Badge>{__ATLAS_REVIEW__ ? r.status : 'Not observed'}</Badge>{__ATLAS_REVIEW__ && r.target && <Button compact variant="quiet" onClick={() => onAction(r.target!, 'scene')}>Open</Button>}
  </li>)}</ul>;
}
export function EvidenceTabs({ scene, onAction }: SceneProps) {
  return <Panel title={scene.rows.length ? 'Records' : 'Evidence & activity'}><Tabs label={`${sceneText(scene).title} sections`} tabs={[
    { id: 'overview', label: 'Overview', content: <RowsList scene={scene} onAction={onAction} /> },
    { id: 'evidence', label: 'Evidence', content: <div className="panel-pad"><EmptyState icon="receipt" headingLevel={3} title="No evidence observed">Evidence identifies the exact actor, scope, resource and revision, and comes from service receipts.</EmptyState></div> },
    { id: 'activity', label: 'Activity', content: <div className="panel-pad"><EmptyState icon="activity" headingLevel={3} title="No activity observed">Connect an authorized service to load activity for this object.</EmptyState></div> },
  ]} /></Panel>;
}
export function InspectorSection({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return <section className="panel-section stack" aria-labelledby={id}><h2 id={id} className="label">{title}</h2>{children}</section>;
}
export function Inspector({ scene, view }: { scene: Scene; view: ViewEntry }) {
  const connected = useApp((s) => s.connection === 'connected');
  const t = sceneText(scene);
  return <aside className="panel scene-inspector" aria-label="Current object">
    <div className="panel-section stack"><span className="eyebrow">Current object</span><span className="label break">{t.entity}</span><Badge>{t.state}</Badge></div>
    <InspectorSection title="Pinned identity">{__ATLAS_REVIEW__ && scene.pins.length ? scene.pins.map((p, i) => <p key={i} className="caption mono break">{p}</p>) : <p className="caption">{connected ? 'Not observed — waiting for pinned identities from the service.' : 'Not observed — no authorized service session. Stable IDs, exact revision and current grants are required.'}</p>}</InspectorSection>
    <InspectorSection title="Actions & availability">{scene.disabled.length ? scene.disabled.map((d, i) => <p key={i} className="caption"><strong className="secondary">{__ATLAS_REVIEW__ ? d.label : d.prodLabel}:</strong> {__ATLAS_REVIEW__ ? d.reason : d.prodReason}</p>) : <p className="caption">Protected actions require a current grant, exact revision and approved command contract.</p>}</InspectorSection>
    <InspectorSection title="Outcome rule"><p className="caption">Requested → Received → Accepted are command stages. Effective requires an authoritative effect readback. A missing outcome remains Unknown.</p></InspectorSection>
    <InspectorSection title="Retained evidence"><p className="caption">Keep actor, resource, revision, attempt, policy and operation identity. Changes to sources or grants invalidate affected actions.</p></InspectorSection>
    <details className="panel-section"><summary className="label">Traceability</summary><div className="stack scene-traceability"><p className="caption">View {view.id} · scene {scene.key} ({scene.j})</p>{scene.packages.length > 0 && <p className="caption">Packages: {scene.packages.join(', ')}</p>}{scene.uat.length > 0 && <p className="caption">Acceptance cases: {scene.uat.join(', ')}</p>}{scene.ux.length > 0 && <p className="caption">Journey steps: {scene.ux.join(', ')}</p>}{scene.lifecycle.length > 0 && <p className="caption">Lifecycles: {scene.lifecycle.join(', ')}</p>}</div></details>
  </aside>;
}
