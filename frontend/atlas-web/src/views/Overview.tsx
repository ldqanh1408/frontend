import { Link } from 'react-router';
import { nav } from '../data/catalog';
import { useApp } from '../data/app-store';
import { getAll, type DefinitionRecord, type DocumentRecord } from '../lib/storage';
import { useDeviceQuery } from '../lib/hooks';
import type { WorkflowRecord } from '../lib/workflows';
import { ButtonLink, PageHeader } from '../components/ui';
import { usePageMeta } from '../shell/page-meta';
import { ProvenanceBanner } from './shared';

const AGENT_SCHEMAS = new Set(['agent']);

export default function Overview() {
  const m = nav.modules.home;
  usePageMeta(m.title, [{ label: m.title }]);
  const connection = useApp((s) => s.connection);
  const { data } = useDeviceQuery(async () => {
    const [defs, docs, wfs] = await Promise.all([getAll<DefinitionRecord>('definitions'), getAll<DocumentRecord>('documents'), getAll<WorkflowRecord>('workflows')]);
    const live = defs.filter((d) => !d.archived);
    return {
      documents: docs.filter((d) => d.kind === 'document' && !d.archived).length,
      agents: live.filter((d) => AGENT_SCHEMAS.has(d.schemaId)).length,
      workflows: wfs.filter((w) => !w.archived).length,
    };
  }, [], { documents: 0, agents: 0, workflows: 0 });
  const steps = [
    { n: '01', title: 'Define the outcome', text: 'Document tree and Given / When / Then criteria', to: '/specifications' },
    { n: '02', title: 'Inspect the source', text: 'Real paths, immutable local snapshots and provenance', to: '/code' },
    { n: '03', title: 'Constrain the agent', text: 'Instructions, explicit resources and output contracts', to: '/agents' },
    { n: '04', title: 'Plan and admit work', text: 'Version pins, dependencies and service preflight', to: '/workflow' },
  ];
  return (
    <div className="page">
      <PageHeader title={m.title} purpose={m.purpose} actions={<ButtonLink to="/connection" variant="primary" icon="plug">{connection === 'connected' ? 'Manage connection' : 'Connect workspace'}</ButtonLink>} />
      <ProvenanceBanner />
      <div className="metrics" role="list" aria-label="Workspace summary">
        <SummaryCard label="Document drafts" value={data.documents} to="/specifications" note="Saved on this device" />
        <SummaryCard label="Agent drafts" value={data.agents} to="/agents" note="Saved on this device" />
        <SummaryCard label="Workflow drafts" value={data.workflows} to="/workflow" note="Saved on this device" />
        <div className="card metric-card" role="listitem">
          <span className="caption secondary">Workspace session</span>
          <span className="metric">{connection === 'connected' ? 'Connected' : connection === 'ended' ? 'Ended' : 'Disconnected'}</span>
          <span className="caption">{connection === 'connected' ? 'Authorized records available' : 'No service result inferred'}</span>
        </div>
      </div>
      <div className="dashboard">
        <section className="panel dash-panel" aria-labelledby="journey-h">
          <h2 id="journey-h">Build your first complete journey</h2>
          <ol className="journey" role="list">
            {steps.map((s) => (
              <li key={s.n} className="journey-step">
                <span className="journey-n" aria-hidden="true">{s.n}</span>
                <span className="grow stack" style={{ gap: 'var(--space-4)' }}><span className="label">{s.title}</span><span className="caption">{s.text}</span></span>
                <ButtonLink to={s.to} aria-label={`Open: ${s.title}`}>Open</ButtonLink>
              </li>
            ))}
          </ol>
        </section>
        <section className="panel dash-panel" aria-labelledby="readiness-h">
          <h2 id="readiness-h">Workspace readiness</h2>
          <ul className="stack-16" role="list" style={{ margin: 0, padding: 0 }}>
            {[['Workspace session', '/connection'], ['Repository', '/code'], ['Provider & budget', '/gateway'], ['Runtime capabilities', '/desktop']].map(([label, to]) => (
              <li key={label}>
                <Link className="readiness-item readiness-link" to={to}>
                  <span className="secondary">{label}</span>
                  <span className="muted">{connection === 'connected' ? (label === 'Workspace session' ? 'Authorized session observed' : 'Check the service for the current observation') : 'Service observation required'}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="caption">Local drafts are usable before connecting. Production execution is not verified.</p>
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, to, note }: { label: string; value: number; to: string; note: string }) {
  return (
    <Link className="card metric-card" to={to} role="listitem" aria-label={`${label}: ${value}`}>
      <span className="caption secondary">{label}</span>
      <span className="metric">{value}</span>
      <span className="caption">{note}</span>
    </Link>
  );
}
