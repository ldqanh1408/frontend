import { lazy, Suspense, useId, type ReactNode } from 'react';
import type { Scene, SceneIndexEntry, ViewEntry } from '../../data/types';
import type { ResolvedAction } from './model';
import { Badge, Banner, Button, EmptyState, Panel, Stages, Spinner } from '../../components/ui';
import { Tabs } from '../../components/overlays';
import { ProvenanceBanner } from '../shared';
import { useApp } from '../../data/app-store';
import { Icon } from '../../components/Icon';

const SchemaSceneForm = lazy(() => import('../definitions/SchemaSceneForm'));
const LifecycleBody = lazy(() => import('./LifecycleBody'));

/** Fixture wording (r-901, T-02, SHAs) is shown only in the labelled review build; production uses neutral wording. */
export const sceneText = (s: Scene) => (__ATLAS_REVIEW__ ? { title: s.title, copy: s.copy, entity: s.entity } : { title: s.prodTitle, copy: s.prodCopy, entity: s.prodEntity });

const btnVariant = (s: string) => (s === 'Primary' ? 'primary' : s === 'Danger' ? 'danger' : s === 'Quiet' ? 'quiet' : 'secondary') as 'primary' | 'danger' | 'quiet' | 'secondary';

export function ActionBar({ actions, onAction, label = 'Actions' }: { actions: ResolvedAction[]; onAction: (to: string, kind: string) => void; label?: string }) {
  if (!actions.length) return null;
  return (
    <div className="row" role="group" aria-label={label} style={{ alignItems: 'flex-start' }}>
      {actions.map((a, i) => (
        <Button key={i} variant={btnVariant(a.style)} blocked={a.kind === 'effect' || a.kind === 'none' ? a.reason : undefined}
          onClick={() => a.to && onAction(a.to, a.kind)}>
          {a.label}
        </Button>
      ))}
    </div>
  );
}

export function SceneRenderer({ scene, view, actions, onAction, bare, isDefault, onReset }: {
  scene: Scene; view: ViewEntry; index: Record<string, SceneIndexEntry>; actions: ResolvedAction[]; onAction: (to: string, kind: string) => void;
  bare?: boolean; isDefault: boolean; onReset: () => void;
}) {
  if (bare) return <BareScene scene={scene} actions={actions} onAction={onAction} view={view} />;
  const t = sceneText(scene);
  return (
    <div className="page">
      <header className="page-head">
        <div className="page-head-text">
          <span className="eyebrow">{view.title}{!isDefault && <> · <button className="btn-quiet" style={{ all: 'unset', cursor: 'pointer', textDecoration: 'underline' }} onClick={onReset}>back to default</button></>}</span>
          <h1 tabIndex={-1} data-page-title>{t.title}</h1>
          {t.copy && <p>{t.copy}</p>}
        </div>
        <div className="row"><Badge tone="info">{scene.state}</Badge></div>
      </header>
      <ProvenanceBanner />
      <ActionBar actions={actions} onAction={onAction} label={`${t.title} actions`} />
      <div className="split-wide">
        <div className="stack-16" style={{ minWidth: 0 }}>
          <SceneBody scene={scene} actions={actions} onAction={onAction} />
        </div>
        <Inspector scene={scene} view={view} />
      </div>
    </div>
  );
}

function SceneBody({ scene, actions, onAction }: { scene: Scene; actions: ResolvedAction[]; onAction: (to: string, kind: string) => void }) {
  const connected = useApp((s) => s.connection === 'connected');
  const illustrative = __ATLAS_REVIEW__;
  if (scene.kind === 'receipt' || scene.receipt) {
    return (
      <Panel title="Operation receipt">
        <div className="panel-pad stack-12">
          {illustrative && scene.receipt ? (
            <>
              <Stages stage={scene.receipt.stage} />
              <p className="secondary">{scene.receipt.note}</p>
              <p className="caption mono">{scene.receipt.operation}</p>
            </>
          ) : (
            <EmptyState icon="receipt" headingLevel={3} title="No operation recorded">
              Receipts appear here only after an authorized service acknowledges a request. A request is never shown as effective until its effect is read back.
            </EmptyState>
          )}
        </div>
      </Panel>
    );
  }
  if (scene.kind === 'lifecycle') {
    return <Suspense fallback={<Spinner />}><LifecycleBody scene={scene} /></Suspense>;
  }
  if (scene.kind === 'confirm') {
    const danger = actions.find((a) => a.style === 'Danger') ?? actions[actions.length - 1];
    return (
      <Panel title="Confirm this request">
        <div className="panel-pad stack-12">
          <Banner tone="warning" title="Review the exact scope and impact">{sceneText(scene).copy || 'This request may not be reversible.'}</Banner>
          {scene.schema && <Suspense fallback={<Spinner />}><SchemaSceneForm schemaId={scene.schema} sceneTitle={sceneText(scene).title} /></Suspense>}
          {danger && <p className="caption">Primary consequence: {danger.label}. Unknown outcomes keep the original operation identity for reconciliation.</p>}
        </div>
      </Panel>
    );
  }
  if (scene.schema && (scene.kind === 'form' || scene.fields.length === 0)) {
    return <Suspense fallback={<Spinner />}><SchemaSceneForm schemaId={scene.schema} sceneTitle={sceneText(scene).title} /></Suspense>;
  }
  const notices = scene.kind === 'notice' && scene.disabled.length ? (
    <Banner tone="warning" title={scene.state}>{__ATLAS_REVIEW__ ? scene.disabled[0].reason : scene.disabled[0].prodReason}</Banner>
  ) : null;
  return (
    <>
      {notices}
      {scene.fields.length > 0 && <SceneFields scene={scene} />}
      <Panel title={scene.rows.length ? 'Records' : 'Details'}>
        <Tabs label={`${sceneText(scene).title} sections`} tabs={[
          { id: 'overview', label: 'Overview', content: <RowsList scene={scene} connected={connected} onAction={onAction} /> },
          { id: 'evidence', label: 'Evidence', content: <EvidenceList connected={connected} /> },
          { id: 'activity', label: 'Activity', content: <div className="panel-pad"><EmptyState icon="activity" headingLevel={3} title="No activity observed">{connected ? 'The service returned no activity for this object.' : 'Connect an authorized service to load activity for this object.'}</EmptyState></div> },
        ]} />
      </Panel>
    </>
  );
}

function RowsList({ scene, connected, onAction }: { scene: Scene; connected: boolean; onAction: (to: string, kind: string) => void }) {
  // Production shows only structural rows (no fixture records); the review build shows the labelled design sample.
  const rows = __ATLAS_REVIEW__ ? scene.rows : scene.rows.filter((r) => !r.sample);
  if (!rows.length) {
    return <div className="panel-pad"><EmptyState icon="inbox" headingLevel={3} title={connected ? 'No records returned' : 'No authorized records loaded'}>{connected ? 'The connected service returned no records for this view and scope.' : 'This view shows service records. Connect an authorized service; Atlas does not invent results.'}</EmptyState></div>;
  }
  return (
    <ul className="list" role="list" style={{ padding: 'var(--space-8)' }}>
      {rows.map((r, i) => (
        <li key={i} className="list-item" style={{ cursor: 'default' }}>
          <Icon name="chevron-right" />
          <span className="grow stack" style={{ gap: 2 }}>
            <span className="label">{r.label}</span>
            <span className="caption break">{__ATLAS_REVIEW__ ? r.detail : connected ? 'Awaiting service data' : 'Not observed — requires service data'}</span>
          </span>
          <Badge>{__ATLAS_REVIEW__ ? r.status : 'Not observed'}</Badge>
          {__ATLAS_REVIEW__ && r.target && <Button compact variant="quiet" onClick={() => onAction(r.target!, 'scene')}>Open</Button>}
        </li>
      ))}
    </ul>
  );
}

function EvidenceList({ connected }: { connected: boolean }) {
  return (
    <div className="panel-pad">
      <EmptyState icon="receipt" headingLevel={3} title="No evidence observed">
        {connected ? 'The service returned no evidence for this object.' : 'Evidence names the exact actor, scope, resource and revision, and comes only from service receipts.'}
      </EmptyState>
    </div>
  );
}

/** Scene fields are read-only facts about the object; values exist only when a service returns them (or in the review build). */
function SceneFields({ scene }: { scene: Scene }) {
  return (
    <Panel title="Details">
      <div className="panel-pad"><FieldFacts fields={scene.fields} /></div>
    </Panel>
  );
}
function FieldFacts({ fields }: { fields: Scene['fields'] }) {
  const show = (v: unknown) => (v == null || v === '' ? null : typeof v === 'string' ? v : JSON.stringify(v));
  return (
    <dl className="facts">
      {fields.map((f, i) => {
        const v = __ATLAS_REVIEW__ ? show(f.value) : null;
        return (
          <div key={i} className="fact">
            <dt className="label">{f.label}</dt>
            <dd>{v ? <span className="break">{v}</span> : <span className="muted">Not observed</span>}{f.hint && <span className="caption">{f.hint}</span>}</dd>
          </div>
        );
      })}
    </dl>
  );
}

function Inspector({ scene, view }: { scene: Scene; view: ViewEntry }) {
  const connected = useApp((s) => s.connection === 'connected');
  return (
    <aside className="panel" aria-label="Current object">
      <div className="panel-section stack">
        <span className="eyebrow">Current object</span>
        <span className="label break">{sceneText(scene).entity}</span>
        <Badge tone="info">{scene.state}</Badge>
      </div>
      <InspectorSection title="Pinned identity">
        {__ATLAS_REVIEW__ && scene.pins.length ? scene.pins.map((p, i) => <p key={i} className="caption mono break">{p}</p>)
          : <p className="caption">{connected ? 'Pinned identities appear when the service returns this object.' : 'Not observed — no authorized service session. Stable IDs, exact revision and current grants are required.'}</p>}
      </InspectorSection>
      <InspectorSection title="Actions & availability">
        {scene.disabled.length ? scene.disabled.map((d, i) => <p key={i} className="caption"><strong className="secondary">{__ATLAS_REVIEW__ ? d.label : d.prodLabel}:</strong> {__ATLAS_REVIEW__ ? d.reason : d.prodReason}</p>)
          : <p className="caption">Protected actions require the current capability, exact revision and an approved command contract.</p>}
      </InspectorSection>
      <InspectorSection title="Outcome rule">
        <p className="caption">Requested → Received → Accepted are command stages. Effective requires the current authoritative owner/provider receipt. A missing outcome remains Unknown.</p>
      </InspectorSection>
      <InspectorSection title="Retained evidence">
        <p className="caption">Keep exact actor, resource, revision, attempt, policy and operation identity. A source or grant change invalidates affected protected actions.</p>
      </InspectorSection>
      <details className="panel-section">
        <summary className="label" style={{ cursor: 'pointer' }}>Traceability</summary>
        <div className="stack" style={{ marginTop: 8 }}>
          <p className="caption">View {view.id} · scene {scene.key} ({scene.j})</p>
          {scene.packages.length > 0 && <p className="caption">Packages: {scene.packages.join(', ')}</p>}
          {scene.uat.length > 0 && <p className="caption">Acceptance cases: {scene.uat.join(', ')}</p>}
          {scene.ux.length > 0 && <p className="caption">Journey steps: {scene.ux.join(', ')}</p>}
          {scene.lifecycle.length > 0 && <p className="caption">Lifecycles: {scene.lifecycle.join(', ')}</p>}
          {scene.blockedBy.length > 0 && <p className="caption">Contract gates: {[...new Set(scene.blockedBy)].join(', ')}</p>}
        </div>
      </details>
    </aside>
  );
}
function InspectorSection({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return <section className="panel-section stack" aria-labelledby={id}><h2 id={id} className="label">{title}</h2>{children}</section>;
}

/** Account-level scenes (sign-in, invitation, identity checks) without the workspace shell (Figma GAP/J01/sign-in). */
function BareScene({ scene, actions, onAction, view }: { scene: Scene; actions: ResolvedAction[]; onAction: (to: string, kind: string) => void; view: ViewEntry }) {
  return (
    <div className="bare">
      <section className="bare-brand" aria-label="About Atlas">
        <a href="/" className="brand"><span className="brand-mark" aria-hidden="true">A</span><span>atlas</span></a>
        <p className="bare-promise">From source<br />to shared clarity.</p>
        <p className="secondary">A focused workspace for specifications, code intelligence and accountable agent work.</p>
        <div className="stack" style={{ marginTop: 'var(--space-24)' }}>
          <strong className="label">Identity first. Scope always.</strong>
          <p className="caption">Your account opens only the organizations, workspaces and projects you are authorized to use.</p>
        </div>
      </section>
      <section className="bare-main" aria-labelledby="bare-title">
        <div className="bare-card stack-16">
          <span className="eyebrow">{view.id === 'workspace/login' ? 'Welcome to Atlas' : view.title}</span>
          <h1 id="bare-title" tabIndex={-1} data-page-title>{sceneText(scene).title}</h1>
          {sceneText(scene).copy && <p className="secondary">{sceneText(scene).copy}</p>}
          {__ATLAS_REVIEW__ && scene.fields.length > 0 && <FieldFacts fields={scene.fields} />}
          {scene.disabled.length > 0 && <Banner tone="warning" title={scene.state}>{__ATLAS_REVIEW__ ? scene.disabled[0].reason : scene.disabled[0].prodReason}</Banner>}
          <Banner tone="info" title="Authentication is provided by your Atlas service">Sign-in, invitation acceptance and identity checks complete only through the connected service and its identity provider. Atlas never treats a request as a validated session.</Banner>
          <div className="stack">
            {actions.map((a, i) => (
              <Button key={i} block variant={btnVariant(a.style)} blocked={a.kind === 'effect' || a.kind === 'none' ? a.reason : undefined} onClick={() => a.to && onAction(a.to, a.kind)}>{a.label}</Button>
            ))}
          </div>
          <a className="caption" href="/connection">Configure the service connection</a>
        </div>
      </section>
    </div>
  );
}
