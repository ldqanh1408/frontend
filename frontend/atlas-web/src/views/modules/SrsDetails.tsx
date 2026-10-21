import type { ModuleRoute } from '../../data/types';
import type { ServiceRecord } from '../../data/service';
import { Badge, ButtonLink, KeyValue, Panel } from '../../components/ui';
import { statePresentation, DOMAIN_STATES } from '../../data/states';
import { useConfiguration, numericConfiguration, riskBand } from '../../data/configuration';

function observed(record: ServiceRecord | null | undefined, key: string) {
  const value = record?.fields?.[key];
  return value == null ? 'Not observed' : typeof value === 'string' ? value : JSON.stringify(value);
}
/** SRS obligations remain visible before any service returns business evidence. Thresholds are resolved by the service. */
export function SrsDetails({ module, record }: { module: ModuleRoute; record?: ServiceRecord | null }) {
  const { snapshot } = useConfiguration();
  const low = numericConfiguration(snapshot, 'risk_low_threshold');
  const high = numericConfiguration(snapshot, 'risk_high_threshold');
  const warning = numericConfiguration(snapshot, 'budget_warning_threshold');
  const block = numericConfiguration(snapshot, 'budget_block_threshold');
  const risk = record?.fields?.composite_risk_score;
  const riskLabel = typeof risk === 'number' && low && high && high.value > low.value ? riskBand(risk, low.value, high.value, record?.fields?.hard_veto_triggered === true) : 'Not observed';
  const source = (v: typeof low) => v ? `${v.value} · ${v.layer} · revision ${v.revision}` : 'Not observed';
  const budgetStatus = (key: string) => {
    const budget = record?.fields?.[key] as { used?: unknown; limit?: unknown } | undefined;
    if (!budget || typeof budget.used !== 'number' || typeof budget.limit !== 'number' || !Number.isFinite(budget.used) || !Number.isFinite(budget.limit) || budget.used < 0 || budget.limit <= 0 || !warning || !block || block.value <= warning.value) return 'Not observed';
    const ratio = budget.used / budget.limit;
    return `${budget.used} / ${budget.limit} · ${ratio >= block.value ? 'Blocked_Budget' : ratio >= warning.value ? 'Warning' : 'Within budget'}`;
  };
  if (module === 'governance') return <Panel title="Risk & independent approval"><div className="panel-pad stack-16"><div className="risk-axes">{[
    ['Call graph blast radius', 'graph_blast_radius_score'], ['Schema migration', 'schema_risk_score'], ['Breaking API surface', 'api_surface_risk_score'], ['Security / sensitive modules', 'security_risk_score'], ['Test delta quality', 'test_delta_risk_score'], ['Churn / complexity', 'churn_complexity_score'],
  ].map(([label, key]) => <div className="risk-axis" key={key}><strong className="caption">{label}</strong><span className="risk-meter" aria-hidden="true" /><span className="caption">{observed(record, key)}</span></div>)}</div><KeyValue items={[
    ['Composite risk', observed(record, 'composite_risk_score')], ['Risk classification', riskLabel], ['Hard Veto', observed(record, 'hard_veto_triggered')], ['Veto reasons', observed(record, 'veto_reasons')], ['Risk thresholds', `Low: ${source(low)} · High: ${source(high)}`], ['Resolved configuration layer', snapshot ? `Configuration revision ${snapshot.revision}` : 'Not observed'], ['Independent reviewer eligibility', observed(record, 'reviewer_eligibility')], ['Signatures', observed(record, 'signatures')],
  ]} /><p className="caption">Authors cannot approve their own change. Medium risk requires an independent signature; high risk or Hard Veto requires distinct Tech Lead and Security Officer signatures. A missing eligible reviewer blocks the gate.</p><div className="row">{DOMAIN_STATES.ApprovalGate.map(s => <Badge key={s}>{statePresentation(s).label}</Badge>)}</div></div></Panel>;
  if (module === 'gateway' || module === 'saas') return <Panel title="Budget layers & resolved limits"><div className="panel-pad stack-16"><KeyValue items={[
    ['Key budget', budgetStatus('key_budget')], ['Workspace / Project budget', budgetStatus('project_budget')], ['SubTask / Turn budget', budgetStatus('subtask_budget')], ['Warning threshold', source(warning)], ['Block threshold', source(block)], ['Resolved configuration layer', snapshot ? `Configuration revision ${snapshot.revision}` : 'Not observed'],
  ]} /><p className="caption">Budget exhaustion holds the run at a safe checkpoint. Restore available budget and review the saved snapshot before requesting Resume.</p><div className="row"><Badge>Blocked budget</Badge><ButtonLink to="/execution">Inspect safe checkpoint</ButtonLink></div></div></Panel>;
  if (module === 'identity') return <Panel title="Invitation policy & identity"><div className="panel-pad stack-16"><KeyValue items={[
    ['Invitation expires at', observed(record, 'invitation_expires_at')], ['Invitation TTL', observed(record, 'invite_ttl_hours')], ['Default role', observed(record, 'default_role')], ['Resolved configuration layer', observed(record, 'configuration_source')],
  ]} /><p className="caption">A valid invitation, matching authenticated identity and current scope are required. Expired or revoked invitations must be replaced through the service.</p></div></Panel>;
  return null;
}

export function SrsJourney() {
  const steps = [
    { title: 'Lock specification', to: '/specifications', grant: 'spec:lock' }, { title: 'Submit to AI', to: '/specifications', grant: 'spec:submit_to_ai' },
    { title: 'Memory preparation', to: '/memory', grant: 'workspace:memory_manage' }, { title: 'Review proposed DAG', to: '/workflow', grant: 'dag:plan_approve' },
    { title: 'Human checkpoint', to: '/execution', grant: 'dag:milestone_approve' }, { title: 'Risk & approval gate', to: '/governance', grant: 'gov:approve_medium / gov:approve_high' },
    { title: 'PR & CI verification', to: '/governance', grant: 'Service integration required' }, { title: 'Post-merge drift', to: '/code', grant: 'code:view_graph' },
    { title: 'Implemented', to: '/specifications', grant: 'Matched drift verification required' }, { title: 'Episodic draft → Promote', to: '/memory', grant: 'workspace:memory_manage' },
  ];
  return <Panel title="Specification to verified delivery"><ol className="srs-journey">{steps.map((s, i) => <li key={s.title}><span className="srs-step-number" aria-hidden="true">{i + 1}</span><div className="stack"><ButtonLink to={s.to} variant="quiet">{s.title}</ButtonLink><span className="caption">Not observed · {s.grant}</span></div></li>)}</ol><p className="panel-pad caption">Locking never starts an agent. Submit to AI is an explicit request; every approval and outcome requires current service evidence.</p></Panel>;
}
