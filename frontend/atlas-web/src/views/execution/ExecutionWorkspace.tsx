import { useRunStream } from '../live/useRunStream';
import { ThoughtList } from '../live/ThoughtList';
import { LazyTaskGraph } from '../../components/LazyTaskGraph';
import { lazy, Suspense, useEffect, useId, useMemo, useState } from 'react';
import { Badge, Banner, Button, ButtonLink, EmptyState, KeyValue, Panel } from '../../components/ui';
import { Tabs } from '../../components/overlays';
import { Icon } from '../../components/Icon';
import { capability, useApp } from '../../data/app-store';
import { statePresentation } from '../../data/states';
import { actionPermission } from '../../data/permissions';
import { actionGate, type ServiceAction, type ServiceRecord } from '../../data/service';
import { graphLayout, readExecutionNodes, type ExecutionNode } from './model';
import { isoUtc, relativeTime } from '../../lib/format';

const LiveTerminal = lazy(() => import('../live/LiveTerminal'));

const REVIEW_STATES = { running: 'Running', parallel: 'Parallel', checkpoint: 'Human checkpoint', failed: 'Failed · paused', budget: 'Budget blocked', paused: 'Paused', cleanup: 'Cleanup held', completed: 'Completed' };
type ReviewState = keyof typeof REVIEW_STATES;

function illustrativeNodes(state: ReviewState): ExecutionNode[] {
  if (!__ATLAS_REVIEW__) return [];
  const base: ExecutionNode[] = [
    { id: 'T-01', name: 'Resolve frozen context', type: 'MEMORY_PREP', agent: 'Context Resolver', status: 'Completed', dependencies: [], attempt: '1', duration: '18s' },
    { id: 'T-02', name: 'Implement OAuth state validation', type: 'AGENT', agent: 'Backend Engineer', status: 'Running', dependencies: ['T-01'], attempt: '1', duration: '02:24', worker: 'java-worker-02', tool: 'sandbox.applyPatch', output: 'Patch + unit test report', fileScope: ['src/auth/state.ts', 'src/auth/callback.ts'], snapshot: 'Illustrative saved artifact snapshot', memory: 'TaskMemoryPackage · frozen context', budget: 'Illustrative · $12.80 / $50' },
    { id: 'T-03', name: 'Write replay tests', type: 'TEST', agent: 'Test Engineer', status: 'Running', dependencies: ['T-01'], attempt: '1', duration: '52s' },
    { id: 'T-04', name: 'Review migration scope', type: 'HUMAN_GATE', agent: 'Human checkpoint', status: 'Waiting_Human_Checkpoint', dependencies: ['T-01'], attempt: '1' },
    { id: 'T-05', name: 'Apply session migration', type: 'AGENT', agent: 'DB Migrator', status: 'Pending', dependencies: ['T-04'], attempt: '1' },
    { id: 'T-06', name: 'Verify combined changes', type: 'SANDBOX', agent: 'Integration QA', status: 'Pending', dependencies: ['T-02', 'T-03', 'T-05'], attempt: '1' },
    { id: 'T-07', name: 'Publish durable evidence', type: 'TOOL', agent: 'Artifact Assembler', status: 'Pending', dependencies: ['T-06'], attempt: '1' },
  ];
  return base.map(n => ({ ...n, status: state === 'completed' ? 'Completed' : n.id === 'T-02' ? ({ failed: 'Failed_Paused', budget: 'Blocked_Budget', paused: 'Ready', cleanup: 'Completed', checkpoint: 'Waiting_Human_Checkpoint' } as Partial<Record<ReviewState, string>>)[state] ?? n.status : n.status }));
}
const typeIcon = (type: string) => ({ AGENT: 'bot', HUMAN_GATE: 'users', GOVERNANCE_GATE: 'shield', TEST: 'checklist', SANDBOX: 'terminal', MEMORY_PREP: 'brain', MCP: 'plug', TOOL: 'boxes', PARALLEL: 'network', CONDITION: 'branch' })[type] ?? 'workflow';

export default function ExecutionWorkspace({ record, onCommand, initialMode }: { record?: ServiceRecord | null; onCommand?: (a: ServiceAction) => void; initialMode?: 'graph' | 'list' }) {
  const session = useApp(s => s.session);
  const connection = useApp(s => s.connection);
  const [mode, setMode] = useState(() => initialMode ?? (matchMedia('(max-width: 1023px)').matches ? 'list' : 'graph'));
  const [reviewState, setReviewState] = useState<ReviewState>('running');
  const [selected, setSelected] = useState<string | null>(null);
  const [dock, setDock] = useState('events');
  const [inspector, setInspector] = useState('task');
  const rid = useId();
  useEffect(() => { const m = matchMedia('(max-width: 1023px)'); const change = () => { if (m.matches) setMode('list'); }; m.addEventListener('change', change); return () => m.removeEventListener('change', change); }, []);
  const live = useRunStream(record);
  const parsed = useMemo(() => readExecutionNodes(record?.fields?.tasks), [record]);
  const nodes = useMemo(() => __ATLAS_REVIEW__ && !record ? illustrativeNodes(reviewState) : live.nodes ?? parsed.nodes, [record, live.nodes, parsed.nodes, reviewState]);
  const node = nodes.find(n => n.id === selected) ?? (__ATLAS_REVIEW__ ? nodes.find(n => n.id === 'T-02') : null) ?? null;
  const layout = graphLayout(nodes);
  const controls = ['Review checkpoint', 'Pause', 'Resume', 'Retry failed', 'Cancel run', 'Snapshot', 'Artifacts', 'Export'];
  const actionFor = (label: string) => record?.actions?.find(a => a.label.toLowerCase() === label.toLowerCase());
  const gateFor = (label: string) => {
    if (record && live.revision != null && live.revision !== record.revision) return 'Live revision changed. Refresh the resource and current action preconditions before acting.';
    const perm = actionPermission(label);
    const gate = perm ? capability(perm, label) : null;
    return gate && !gate.ok ? gate.reason : actionGate(record ?? null, actionFor(label));
  };
  const requestCommand = (label: string) => { const action = actionFor(label); if (action && !gateFor(label)) onCommand?.(action); };
  const reason = connection !== 'connected' ? 'Connect an authorized service to load the run, current grants and revision. Run commands are unavailable until then.' : !record ? 'Select an authorized run to inspect command preconditions.' : null;
  const choose = (n: ExecutionNode) => { setSelected(n.id); setInspector('task'); };
  const completed = nodes.filter(n => n.status === 'Completed').length;
  return <div className="stack-16 execution-workspace" data-execution-workspace>
    {__ATLAS_REVIEW__ && !record && <div className="review-state-control"><Badge tone="warning">Illustrative</Badge><label htmlFor={`${rid}-review`}>Review run state</label><select id={`${rid}-review`} className="select" value={reviewState} onChange={e => setReviewState(e.target.value as ReviewState)}>{Object.entries(REVIEW_STATES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><span className="caption">Design preview · commands remain unavailable</span></div>}
    <div className="execution-summary"><div className="stack"><span className="eyebrow">Current run</span><strong className="mono break">{record?.name ?? (__ATLAS_REVIEW__ ? 'RUN-DEMO-284' : 'Not observed')}</strong></div><div className="stack"><span className="caption">Progress</span><strong>{nodes.length ? `${completed} / ${nodes.length} completed` : 'Not observed'}</strong></div><div className="stack"><span className="caption">Active agents</span><strong>{nodes.length ? nodes.filter(n => n.status === 'Running').length : 'Not observed'}</strong></div><div className="stack"><span className="caption">Budget · key / project / task</span><strong>{__ATLAS_REVIEW__ && !record ? '$12.80 / $50 · Illustrative' : 'Not observed'}</strong></div><Badge>{record?.status ?? (__ATLAS_REVIEW__ ? REVIEW_STATES[reviewState] : 'Not observed')}</Badge></div>
    <section className="execution-command-bar stack-8" aria-label="Run commands"><div className="row">{controls.map(label => {
      const local = label === 'Artifacts';
      const gate = gateFor(label);
      return <Button key={label} icon={label === 'Pause' ? 'pause' : label === 'Resume' ? 'play' : label === 'Cancel run' ? 'stop' : label === 'Retry failed' ? 'retry' : label === 'Snapshot' ? 'copy' : label === 'Export' ? 'download' : label === 'Review checkpoint' ? 'layers' : 'boxes'} variant={label === 'Cancel run' ? 'danger' : label === 'Review checkpoint' ? 'primary' : 'secondary'} blocked={local ? undefined : gate ?? undefined} reasonId={!local && reason ? `${rid}-reason` : undefined} onClick={() => local ? setDock('artifacts') : requestCommand(label)}>{label}</Button>;
    })}</div>{reason && <p id={`${rid}-reason`} className="caption">{reason} Pause, Resume, Retry and Cancel require agent:control; checkpoint review requires dag:milestone_approve.</p>}</section>
    {record && <p className="caption" role="status">{live.reason}</p>}
    {parsed.error && <Banner tone="warning" title="Execution graph unavailable">{parsed.error}</Banner>}
    <div className="execution-grid"><div className="stack-16"><Panel title="Execution graph" actions={<div role="group" aria-label="Execution view"><Button compact aria-pressed={mode === 'graph'} onClick={() => setMode('graph')}>Graph</Button><Button compact aria-pressed={mode === 'list'} onClick={() => setMode('list')}>List</Button></div>}>
      {!nodes.length ? <div className="execution-empty"><div className="execution-empty-grid" aria-hidden="true"><span /><span /><span /></div><EmptyState icon="network" headingLevel={3} title="No execution observed" actions={<ButtonLink to="/connection" icon="plug">Connect service</ButtonLink>}>An authorized run supplies the task graph, attempts, dependencies and human checkpoints.</EmptyState></div>
        : mode === 'list' ? <div className="table-wrap"><table className="table execution-list"><caption className="sr-only">Execution tasks in dependency order</caption><thead><tr>{['Task', 'Type', 'Depends on', 'State', 'Attempt'].map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{nodes.map(n => <tr key={n.id} data-selected={node?.id === n.id || undefined}><th scope="row"><button className="link-button" aria-pressed={node?.id === n.id} onClick={() => choose(n)}>{n.id} · {n.name}</button></th><td data-label="Type"><span className="row"><Icon name={typeIcon(n.type)} />{n.type.replaceAll('_', ' ')}</span></td><td data-label="Depends on" className="break">{n.dependencies.join(', ') || 'None'}</td><td data-label="State"><Badge>{statePresentation(n.status).label}</Badge></td><td data-label="Attempt">{n.attempt ?? 'Not observed'}</td></tr>)}</tbody></table></div>
        : <LazyTaskGraph label="Execution graph. Use List for a complete keyboard review." onOpen={id => { const task = nodes.find(n => n.id === id); if (task) choose(task); }} items={layout.map(({node: n, x, y}) => ({ id: n.id, x, y, dependencies: n.dependencies, selected: node?.id === n.id, label: `${n.id}: ${n.name}. ${statePresentation(n.status).label}. Depends on ${n.dependencies.join(', ') || 'no tasks'}. Inspect task.`, content: <><span className="row-between caption"><span className="mono">{n.id}</span><span className="row"><Icon name={typeIcon(n.type)} />{n.type.replaceAll('_', ' ')}</span></span><strong className="label">{n.name}</strong><span className="caption">{n.agent ?? 'Agent not observed'}</span><span className="row"><Badge>{statePresentation(n.status).label}</Badge><span className="caption">{n.attempt ? `A${n.attempt}` : 'Attempt not observed'}{n.duration ? ` · ${n.duration}` : ''}</span></span><span className="caption execution-node-open">Inspect task <Icon name="chevron-right" /></span></> }))} />}

    </Panel><Panel title="Run activity"><p className="panel-pad caption">Logs &amp; PTY streams require an authorized live endpoint. Until connected, no terminal input is sent.</p><Tabs label="Run activity" value={dock} onValueChange={setDock} tabs={['Events', 'Terminal', 'Artifacts', 'Memory', 'Thought tree'].map(title => ({ id: title.toLowerCase().replace(' ', '-'), label: title, content: <div className={`panel-pad execution-dock ${title === 'Terminal' ? 'mono' : ''}`}>{title === 'Terminal' ? <Suspense fallback={<p className="caption">Loading terminal…</p>}><LiveTerminal resourceId={record?.id ?? ''} illustrative={__ATLAS_REVIEW__ && !record}/></Suspense> : title === 'Thought tree' && live.thoughts.length ? <ThoughtList entries={live.thoughts}/> : __ATLAS_REVIEW__ && !record ? <div className="stack-12"><Badge tone="warning">Illustrative</Badge>{title === 'Events' ? <p><time dateTime="2026-10-01T21:36:14Z">2026-10-01 21:36:14 UTC</time> · sample event · relative time not measured</p> : title === 'Thought tree' ? <ul className="structured-thoughts"><li>Admission <Badge>Completed</Badge><ul><li>Snapshot preparation <Badge>Running</Badge></li></ul></li></ul> : <p>{title === 'Terminal' ? '[Illustrative replay] Scoped attempt heartbeat received.' : `${title} comes from a scoped run and its immutable input package.`}</p>}</div> : <EmptyState icon={title === 'Terminal' ? 'terminal' : title === 'Memory' ? 'brain' : title === 'Artifacts' ? 'boxes' : 'activity'} headingLevel={3} title={title === 'Terminal' ? 'No stream received' : `No ${title.toLowerCase()} received`}>Not observed — {title === 'Thought tree' ? 'only structured task states are shown; raw chain-of-thought is not exposed.' : 'connect a scoped run to inspect its authoritative data.'}</EmptyState>}</div> }))} /></Panel></div>
    <aside className="panel execution-inspector" aria-label="Selected node"><div className="panel-pad stack-12"><span className="eyebrow">Selected node</span><strong className="workbench-title break">{node?.name ?? 'Select a task'}</strong><span className="caption">{node ? `${node.id} · ${node.type.replaceAll('_', ' ')}` : 'Not observed'}</span></div><Tabs label="Selected task inspector" value={inspector} onValueChange={setInspector} tabs={[
      { id: 'task', label: 'Task', content: <div className="panel-pad stack-16"><KeyValue items={[['State', node ? <Badge key="state">{statePresentation(node.status).label}</Badge> : 'Not observed'], ['Attempt', node?.attempt ?? 'Not observed'], ['Heartbeat', node?.heartbeat ? `${isoUtc(node.heartbeat)} · ${relativeTime(node.heartbeat)}` : 'Not observed'], ['Worker', node?.worker ?? 'Not observed'], ['Tool', node?.tool ?? 'Not observed'], ['Output contract', node?.output ?? 'Not observed'], ['Latest snapshot', node?.snapshot ?? 'Not observed']]} /><p className="caption">{node ? statePresentation(node.status).next : 'Inspect the run and its task identities before acting.'}</p><h3 className="label">File scope & locks</h3><p className="mono break">{node?.fileScope?.join('\n') || 'Not observed'}</p><KeyValue items={['Holder', 'TTL', 'Heartbeat', 'Queue', 'Configuration source'].map(k => [k, 'Not observed'])} /><Button onClick={() => requestCommand('Force release')} blocked={gateFor('Force release') ?? undefined}>Force release</Button></div> },
      { id: 'context', label: 'Context', content: <div className="panel-pad stack-16"><KeyValue items={[['Memory slice', node?.memory ?? 'Not observed'], ['Input lineage', 'Not observed'], ['Output contract', node?.output ?? 'Not observed']]} /><h3 className="label">Budget layers</h3><KeyValue items={['Key', 'Workspace / Project', 'SubTask', 'Resolved configuration layer', 'Warning / block threshold'].map(k => [k, 'Not observed'])} /><Button onClick={() => requestCommand('Inspect snapshot')} blocked={gateFor('Inspect snapshot') ?? undefined}>Inspect snapshot</Button><Button onClick={() => requestCommand('Review lineage')} blocked={gateFor('Review lineage') ?? undefined}>Review lineage</Button></div> },
      { id: 'access', label: 'Access', content: <div className="panel-pad stack-12"><h3 className="label">Current session grants</h3>{session ? <ul className="grant-list">{session.grants.map(g => <li key={g} className="mono break">{g}</li>)}</ul> : <p className="caption">Not observed — no authorized service session.</p>}<p className="caption">Permissions are never inferred from role names. Observer sessions are read-only.</p><p className="caption">Entitlements and quotas require service evidence.</p></div> },
    ]} /></aside></div>
  </div>;
}
