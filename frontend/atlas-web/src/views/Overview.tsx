import { Link } from 'react-router';
import { nav } from '../data/catalog';
import { useApp } from '../data/app-store';
import { getAll, type DefinitionRecord, type DocumentRecord } from '../lib/storage';
import { useDeviceQuery } from '../lib/hooks';
import { Badge, ButtonLink, PageHeader, Panel } from '../components/ui';
import { Icon } from '../components/Icon';
import { usePageMeta } from '../shell/page-meta';
import { ProvenanceBanner } from './shared';

const AGENT_SCHEMAS = new Set(['agent']);
const WORKFLOW_SCHEMAS = new Set(['workflow-policy', 'task-policy']);

export default function Overview() {
  const m = nav.modules.home;
  usePageMeta(m.title, [{ label: m.title }]);
  const connection = useApp((s) => s.connection);
  const { data } = useDeviceQuery(async () => {
    const [defs, docs] = await Promise.all([getAll<DefinitionRecord>('definitions'), getAll<DocumentRecord>('documents')]);
    const live = defs.filter((d) => !d.archived);
    return {
      documents: docs.filter((d) => d.kind === 'document' && !d.archived).length,
      agents: live.filter((d) => AGENT_SCHEMAS.has(d.schemaId)).length,
      workflows: live.filter((d) => WORKFLOW_SCHEMAS.has(d.schemaId)).length,
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
      <div className="cards" role="list" aria-label="Workspace summary">
        <SummaryCard label="Document drafts" value={data.documents} to="/specifications" note="Saved on this device" />
        <SummaryCard label="Agent drafts" value={data.agents} to="/agents" note="Saved on this device" />
        <SummaryCard label="Workflow drafts" value={data.workflows} to="/workflow" note="Saved on this device" />
        <div className="card" role="listitem">
          <span className="caption">Workspace session</span>
          <span className="metric" style={{ fontSize: 20 }}>{connection === 'connected' ? 'Connected' : connection === 'ended' ? 'Ended' : 'Disconnected'}</span>
          <span className="caption">{connection === 'connected' ? 'Authorized records available' : 'No service result inferred'}</span>
        </div>
      </div>
      <div className="split">
        <Panel title="Build your first complete journey">
          <ol className="list" role="list" style={{ padding: 'var(--space-8)' }}>
            {steps.map((s) => (
              <li key={s.n}>
                <Link className="list-item" to={s.to}>
                  <span className="mono muted" aria-hidden="true">{s.n}</span>
                  <span className="grow stack" style={{ gap: 2 }}><span className="label">{s.title}</span><span className="caption">{s.text}</span></span>
                  <span className="caption">Open</span><Icon name="chevron-right" />
                </Link>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel title="Workspace readiness" actions={<Badge tone="warning">Service observation required</Badge>}>
          <ul className="list" role="list" style={{ padding: 'var(--space-8)' }}>
            {[['Repository', '/code', 'code'], ['Provider & budget', '/gateway', 'key-round'], ['Runtime capabilities', '/desktop', 'monitor']].map(([label, to, icon]) => (
              <li key={label}>
                <Link className="list-item" to={to}><Icon name={icon} /><span className="grow">{label}</span><Badge tone={connection === 'connected' ? 'info' : 'warning'}>{connection === 'connected' ? 'Check service' : 'Not observed'}</Badge></Link>
              </li>
            ))}
          </ul>
          <div className="panel-section caption">Local drafts are usable before connecting. Production execution is not verified.</div>
        </Panel>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, to, note }: { label: string; value: number; to: string; note: string }) {
  return (
    <Link className="card" to={to} role="listitem" aria-label={`${label}: ${value}`}>
      <span className="caption">{label}</span>
      <span className="metric">{value}</span>
      <span className="caption">{note}</span>
    </Link>
  );
}
