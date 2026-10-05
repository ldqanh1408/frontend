import { useEffect, useMemo, useState } from 'react';
import { Link, useBlocker, useSearchParams } from 'react-router';
import { nav } from '../../data/catalog';
import { capability, toast, useApp } from '../../data/app-store';
import { createWorkflow, layers, listWorkflows, nextTaskId, saveWorkflow, validateWorkflow, type Issue, type WfInput, type WfTask, type WorkflowRecord } from '../../lib/workflows';
import { ConflictError, getAll, type DefinitionRecord, type RevisionRecord } from '../../lib/storage';
import { useDeviceQuery } from '../../lib/hooks';
import { plural, relativeTime } from '../../lib/format';
import { downloadJson } from '../../lib/definitions';
import { isValidName } from '../../lib/ids';
import { Badge, Banner, Button, ButtonLink, EmptyState, PageHeader, Panel } from '../../components/ui';
import { Dialog, Tabs } from '../../components/overlays';
import { usePageMeta } from '../../shell/page-meta';
import { ProvenanceBanner } from '../shared';
import { LifecycleChain, ModuleViews } from '../modules/common';
import type { Pin } from '../definitions/PinPicker';

interface AgentOption { pin: Pin; name: string }
async function agentOptions(): Promise<AgentOption[]> {
  const [defs, revs] = await Promise.all([getAll<DefinitionRecord>('definitions', 'schemaId', 'agent'), getAll<RevisionRecord>('revisions')]);
  const byKey = new Map(revs.map((r) => [`${r.defId}@${r.rev}`, r]));
  return defs.filter((d) => !d.archived).flatMap((d) => { const r = byKey.get(`${d.id}@${d.rev}`); return r ? [{ pin: { id: d.id, kind: 'agent', rev: r.rev, hash: r.hash }, name: d.name }] : []; });
}

/** Workflow definitions & plans (Figma "workflow"): versioned task graph, pinned agents, human checkpoints, local validation. */
export default function WorkflowPage() {
  const m = nav.modules.workflow;
  const [params, setParams] = useSearchParams();
  const { data: list, loading } = useDeviceQuery(listWorkflows, [], [] as WorkflowRecord[]);
  const id = params.get('wf');
  const current = list.find((w) => w.id === id);
  usePageMeta(current ? current.name : m.title, [{ label: m.label, to: '/workflow' }, ...(current ? [{ label: current.name }] : [])]);
  const [creating, setCreating] = useState(false);
  const onCreate = async (name: string) => {
    const w = await createWorkflow(name);
    setCreating(false);
    toast({ tone: 'success', title: 'Workflow draft created', body: `${w.name} · saved on this device` });
    setParams(new URLSearchParams({ wf: w.id }));
  };
  return (
    <div className="page">
      <PageHeader eyebrow={m.label} title={m.title} purpose={m.purpose} actions={<>
        <ButtonLink to="/agents" icon="bot">Agent definitions</ButtonLink>
        <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>New workflow</Button>
      </>} />
      <ProvenanceBanner detail="Local graph validation ≠ admitted execution." />
      <div className="split-sidebar">
        <Panel title="Workflow drafts" actions={<span className="caption">{list.filter((w) => !w.archived).length}</span>}>
          {loading ? <p className="caption panel-pad">Loading…</p> : list.length === 0 ? <p className="caption panel-pad">No workflow drafts yet.</p> : (
            <ul className="list" role="list" style={{ padding: 'var(--space-8)' }}>
              {list.filter((w) => !w.archived).map((w) => (
                <li key={w.id}><Link className="list-item" to={`/workflow?wf=${w.id}`} aria-current={w.id === id ? 'true' : undefined}>
                  <span className="grow stack" style={{ gap: 2 }}><span className="break">{w.name}</span><span className="caption">{w.tasks.length} tasks · r{w.rev} · {relativeTime(w.updatedAt)}</span></span>
                </Link></li>
              ))}
            </ul>
          )}
        </Panel>
        <div style={{ minWidth: 0 }}>
          {current ? <WorkflowEditor key={current.id} rec={current} /> : id && !loading ? (
            <Panel><EmptyState icon="danger" title="Workflow not found">This workflow draft does not exist on this device.</EmptyState></Panel>
          ) : (
            <Panel><EmptyState icon="workflow" title="Plan agent work as a task graph" actions={<Button variant="primary" icon="plus" onClick={() => setCreating(true)}>New workflow</Button>}>
              Add tasks, pin an exact agent revision to each, connect dependencies and mark human checkpoints. Validation here checks structure only; activation and run admission require a service.
            </EmptyState></Panel>
          )}
        </div>
      </div>
      <LifecycleChain states={null} ids={['LC-15', 'LC-16', 'LC-20']} label={m.title} />
      <ModuleViews module="workflow" />
      {creating && <NameDialog title="New workflow" initial="Untitled workflow" onClose={() => setCreating(false)} onSubmit={onCreate} />}
    </div>
  );
}

function NameDialog({ title, initial, onClose, onSubmit }: { title: string; initial: string; onClose: () => void; onSubmit: (n: string) => Promise<void> }) {
  const [name, setName] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={title}>
      <form className="stack-12" noValidate onSubmit={async (e) => { e.preventDefault(); const v = isValidName(name); if (v) return setErr(v); try { await onSubmit(name); } catch (x) { setErr(x instanceof Error ? x.message : String(x)); } }}>
        <div className="field">
          <label className="field-label" htmlFor="wf-name">Name<span className="req" aria-hidden="true"> *</span></label>
          <input id="wf-name" className="input" autoFocus required value={name} onFocus={(e) => e.target.select()} onChange={(e) => { setName(e.target.value); setErr(null); }} aria-invalid={err ? true : undefined} aria-describedby="wf-name-hint" />
          <small id="wf-name-hint" className={err ? 'field-error' : 'field-hint'} role={err ? 'alert' : undefined}>{err ?? '1–180 characters.'}</small>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="primary">Create</Button></div>
      </form>
    </Dialog>
  );
}

function WorkflowEditor({ rec }: { rec: WorkflowRecord }) {
  const [base, setBase] = useState(rec);
  const [tasks, setTasks] = useState<WfTask[]>(rec.tasks);
  const [inputs, setInputs] = useState<WfInput[]>(rec.inputs);
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [editing, setEditing] = useState<WfTask | null>(null);
  const [conflict, setConflict] = useState<number | null>(null);
  const [tab, setTab] = useState('graph');
  const connection = useApp((s) => s.connection);
  const { data: agents } = useDeviceQuery(agentOptions, [], [] as AgentOption[]);
  const dirty = JSON.stringify(tasks) !== JSON.stringify(base.tasks) || JSON.stringify(inputs) !== JSON.stringify(base.inputs);
  useEffect(() => { if (rec.rev > base.rev) { if (!dirty) { setBase(rec); setTasks(rec.tasks); setInputs(rec.inputs); } else setConflict(rec.rev); } }, [rec]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const h = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h); }, [dirty]);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search));
  const save = async () => {
    try {
      const next = await saveWorkflow(base, { tasks, inputs });
      setBase(next);
      toast({ tone: 'success', title: `Device revision ${next.rev} saved`, body: 'Saved on this device. Activation and run admission require a service.' });
      return true;
    } catch (e) {
      if (e instanceof ConflictError) setConflict(e.current.rev); else toast({ tone: 'danger', title: 'Save failed', body: e instanceof Error ? e.message : String(e) });
      return false;
    }
  };
  const validate = () => {
    const r = validateWorkflow(tasks, inputs);
    setIssues(r);
    if (!r.some((i) => i.level === 'error')) toast({ tone: 'success', title: 'Local graph checks passed', body: `${r.length ? `${plural(r.length, 'warning')}. ` : ''}Admission, grants, budget and runtime were not checked.` });
  };
  const upsert = (t: WfTask) => { setTasks((ts) => (ts.some((x) => x.id === t.id) ? ts.map((x) => (x.id === t.id ? t : x)) : [...ts, t])); setEditing(null); setIssues(null); };
  const remove = (id: string) => { setTasks((ts) => ts.filter((t) => t.id !== id).map((t) => ({ ...t, dependsOn: t.dependsOn.filter((d) => d !== id) }))); setEditing(null); setIssues(null); };
  const addTask = () => setEditing({ id: nextTaskId(tasks), title: '', agent: null, dependsOn: tasks.length ? [tasks[tasks.length - 1].id] : [], checkpoint: false, instructions: '', output: '' });
  const gate = (g: string, w: string) => { const c = capability(g, w); return c.ok ? undefined : c.reason; };
  const shared = connection !== 'connected' ? 'wf-gate' : undefined;
  const errors = issues?.filter((i) => i.level === 'error') ?? [];
  return (
    <div className="stack-16" onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); } }}>
      <Panel title={<span className="break">{base.name}</span>} actions={<Badge tone={dirty ? 'warning' : 'neutral'}>{dirty ? 'Unsaved changes' : `Device revision ${base.rev}`}</Badge>}>
        <div className="panel-pad stack-12">
          {conflict && (
            <Banner tone="danger" title="Changed in another tab" role="alert">Revision {conflict} was saved elsewhere. Export your edits or discard them to load it.
              <div className="row" style={{ marginTop: 8 }}>
                <Button compact onClick={() => downloadJson(`${base.name}-unsaved.json`, { format: 'atlas-workflow/v1', name: base.name, tasks, inputs })}>Export my edits</Button>
                <Button compact variant="danger" onClick={() => { setBase(rec); setTasks(rec.tasks); setInputs(rec.inputs); setConflict(null); }}>Discard and load r{conflict}</Button>
              </div>
            </Banner>
          )}
          <div className="row">
            <Button icon="plus" onClick={addTask}>Add task</Button>
            <Button icon="success" onClick={validate}>Validate draft</Button>
            <Button variant="primary" icon="save" onClick={save} disabled={!dirty || !!conflict} aria-keyshortcuts="Control+S">Save draft</Button>
            <Button icon="download" onClick={() => downloadJson(`${base.name}.workflow.json`, { format: 'atlas-workflow/v1', authority: 'DEVICE_ONLY', name: base.name, rev: base.rev, tasks, inputs })}>Export workflow draft</Button>
          </div>
          <div className="row" role="group" aria-label="Service actions">
            <Button compact icon="sparkles" blocked={gate('workflow:generate', 'Generate with AI')} reasonId={shared}>Generate with AI</Button>
            <Button compact icon="play" blocked={gate('workflow:activate', 'Activate')} reasonId={shared}>Activate</Button>
            <Button compact icon="play-circle" blocked={gate('execution:admit', 'Admit run')} reasonId={shared}>Admit run</Button>
            <Button compact icon="shield-check" blocked={gate('workflow:admission-read', 'Inspect service admission')} reasonId={shared}>Inspect service admission</Button>
          </div>
          {shared && <p id="wf-gate" className="caption">Local graph validation ≠ admitted execution. Generation, activation and admission need an authorized service. <Link to="/connection">Connect a service</Link></p>}
          {issues && (issues.length === 0 ? <Banner tone="success" title="Local graph checks passed">No structural issues. Admission, grants, budget and runtime were not checked.</Banner> : (
            <div className={errors.length ? 'error-summary' : 'warning-summary'} role="alert" tabIndex={-1}>
              <strong>{errors.length ? plural(errors.length, 'error') : 'No errors'}{issues.length - errors.length ? ` · ${plural(issues.length - errors.length, 'warning')}` : ''}</strong>
              <ul>{issues.map((i, k) => <li key={k}>{i.level === 'error' ? 'Error' : 'Warning'}: {i.task ? <button className="link-button" onClick={() => setEditing(tasks.find((t) => t.id === i.task) ?? null)}>{i.message}</button> : i.message}</li>)}</ul>
            </div>
          ))}
        </div>
      </Panel>
      <Panel>
        <Tabs label="Workflow views" value={tab} onValueChange={setTab} tabs={[
          { id: 'graph', label: 'Graph', content: <div className="panel-pad"><Graph tasks={tasks} issues={issues} onOpen={setEditing} onAdd={addTask} /></div> },
          { id: 'list', label: 'Task list', badge: <span className="badge" style={{ marginLeft: 4 }}>{tasks.length}</span>, content: <div className="panel-pad"><TaskTable tasks={tasks} onOpen={setEditing} /></div> },
          { id: 'pins', label: 'Pins & inputs', content: <div className="panel-pad"><PinsAndInputs tasks={tasks} inputs={inputs} onInputs={(v) => { setInputs(v); setIssues(null); }} /></div> },
          { id: 'checkpoints', label: 'Human checkpoint', content: <div className="panel-pad"><Checkpoints tasks={tasks} onOpen={setEditing} /></div> },
        ]} />
      </Panel>
      {editing && <TaskDialog task={editing} tasks={tasks} agents={agents} onClose={() => setEditing(null)} onSave={upsert} onDelete={tasks.some((t) => t.id === editing.id) ? () => remove(editing.id) : undefined} />}
      <Dialog open={blocker.state === 'blocked'} onOpenChange={(o) => { if (!o) blocker.reset?.(); }} title="Leave with unsaved changes?" description="Your workflow edits have not been saved as a device revision."
        footer={<>
          <Button onClick={() => blocker.reset?.()}>Stay and edit</Button>
          <Button onClick={async () => { if (await save()) blocker.proceed?.(); }}>Save and leave</Button>
          <Button variant="danger" onClick={() => blocker.proceed?.()}>Discard and leave</Button>
        </>} />
    </div>
  );
}

const NODE_W = 208, NODE_H = 84, COL = 256, ROW = 108;
function Graph({ tasks, issues, onOpen, onAdd }: { tasks: WfTask[]; issues: Issue[] | null; onOpen: (t: WfTask) => void; onAdd: () => void }) {
  const lv = useMemo(() => layers(tasks), [tasks]);
  if (!tasks.length) return <EmptyState icon="workflow" headingLevel={3} title="No tasks yet" actions={<Button icon="plus" onClick={onAdd}>Add task</Button>}>Each task runs one pinned agent revision. Connect tasks by dependency to form the plan.</EmptyState>;
  const cols = new Map<number, WfTask[]>();
  tasks.forEach((t) => { const l = lv.get(t.id) ?? 0; cols.set(l, [...(cols.get(l) ?? []), t]); });
  const pos = new Map<string, { x: number; y: number }>();
  [...cols.entries()].forEach(([l, ts]) => ts.forEach((t, i) => pos.set(t.id, { x: 16 + l * COL, y: 16 + i * ROW })));
  const w = 32 + (Math.max(...cols.keys()) + 1) * COL - (COL - NODE_W);
  const h = 32 + Math.max(...[...cols.values()].map((c) => c.length)) * ROW - (ROW - NODE_H);
  const bad = new Set((issues ?? []).filter((i) => i.level === 'error' && i.task).map((i) => i.task));
  return (
    <div className="graph-scroll">
      <div className="graph" style={{ width: w, height: h }} role="group" aria-label={`Task graph with ${tasks.length} tasks. The task list tab shows the same information as a table.`}>
        <svg width={w} height={h} aria-hidden="true" className="graph-edges">
          <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="currentColor" /></marker></defs>
          {tasks.flatMap((t) => t.dependsOn.filter((d) => pos.has(d)).map((d) => {
            const a = pos.get(d)!, b = pos.get(t.id)!;
            const back = (lv.get(d) ?? 0) >= (lv.get(t.id) ?? 0);
            const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2, x2 = b.x, y2 = b.y + NODE_H / 2;
            const dx = Math.max(40, Math.abs(x2 - x1) / 2);
            return <path key={`${d}-${t.id}`} d={back ? `M${x1} ${y1} C ${x1 + 60} ${y1 - 70}, ${x2 - 60} ${y2 - 70}, ${x2} ${y2}` : `M${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`}
              className={back ? 'edge edge-bad' : 'edge'} markerEnd="url(#arrow)" />;
          }))}
        </svg>
        {tasks.map((t) => {
          const p = pos.get(t.id)!;
          return (
            <button key={t.id} className="graph-node" data-error={bad.has(t.id) || undefined} style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H }} onClick={() => onOpen(t)}
              aria-label={`${t.id} ${t.title || 'untitled'}${t.dependsOn.length ? `, depends on ${t.dependsOn.join(', ')}` : ''}${t.checkpoint ? ', human checkpoint' : ''}${t.agent ? '' : ', no agent pinned'}`}>
              <span className="row-between" style={{ gap: 6 }}><span className="mono caption">{t.id}</span>{t.checkpoint && <span className="badge badge-warning">Checkpoint</span>}</span>
              <span className="label graph-title">{t.title || 'Untitled task'}</span>
              <span className="caption graph-agent">{t.agent ? `Agent r${t.agent.rev} · ${t.agent.hash.slice(0, 8)}` : 'No agent pinned'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TaskTable({ tasks, onOpen }: { tasks: WfTask[]; onOpen: (t: WfTask) => void }) {
  if (!tasks.length) return <p className="caption">No tasks yet.</p>;
  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="sr-only">Workflow tasks</caption>
        <thead><tr><th scope="col">Task</th><th scope="col">Depends on</th><th scope="col">Agent pin</th><th scope="col">Checkpoint</th><th scope="col">Output contract</th></tr></thead>
        <tbody>{tasks.map((t) => (
          <tr key={t.id}>
            <th scope="row"><button className="link-button" onClick={() => onOpen(t)}>{t.id} · {t.title || 'Untitled task'}</button></th>
            <td>{t.dependsOn.join(', ') || '—'}</td>
            <td className="mono">{t.agent ? `${t.agent.id} r${t.agent.rev}` : <span className="muted">None</span>}</td>
            <td>{t.checkpoint ? 'Human review' : '—'}</td>
            <td className="clamp-2">{t.output || <span className="muted">Missing</span>}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function PinsAndInputs({ tasks, inputs, onInputs }: { tasks: WfTask[]; inputs: WfInput[]; onInputs: (v: WfInput[]) => void }) {
  const pins = [...new Map(tasks.filter((t) => t.agent).map((t) => [`${t.agent!.id}@${t.agent!.rev}`, t.agent!])).values()];
  return (
    <div className="split">
      <div className="stack-12">
        <h3 className="label">Pinned agent revisions ({pins.length})</h3>
        {pins.length === 0 ? <p className="caption">No agent pinned yet. Open a task to pin a saved agent revision.</p> : (
          <ul className="list" role="list">{pins.map((p) => <li key={`${p.id}@${p.rev}`} className="list-item" style={{ cursor: 'default' }}><span className="grow mono break">{p.id} · r{p.rev}</span><span className="caption mono">{p.hash.slice(0, 12)}…</span></li>)}</ul>
        )}
        <p className="caption">Pins name an exact saved device revision. A later edit to the agent does not change this workflow until you re-pin.</p>
      </div>
      <div className="stack-12">
        <h3 className="label">Workflow inputs ({inputs.length})</h3>
        {inputs.map((inp, i) => (
          <fieldset key={i} className="input-row">
            <legend className="sr-only">Input {i + 1}</legend>
            <div className="field grow"><label className="field-label" htmlFor={`in-n-${i}`}>Name</label><input id={`in-n-${i}`} className="input mono" value={inp.name} onChange={(e) => onInputs(inputs.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} /></div>
            <div className="field"><label className="field-label" htmlFor={`in-t-${i}`}>Type</label>
              <select id={`in-t-${i}`} className="select" value={inp.type} onChange={(e) => onInputs(inputs.map((x, k) => (k === i ? { ...x, type: e.target.value as WfInput['type'] } : x)))}>
                {['text', 'number', 'boolean', 'document', 'repository'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select></div>
            <label className="checkbox"><input type="checkbox" checked={inp.required} onChange={(e) => onInputs(inputs.map((x, k) => (k === i ? { ...x, required: e.target.checked } : x)))} /> Required</label>
            <Button compact variant="quiet" iconOnly icon="trash" onClick={() => onInputs(inputs.filter((_, k) => k !== i))}>Remove input {inp.name || i + 1}</Button>
          </fieldset>
        ))}
        <div><Button compact icon="plus" onClick={() => onInputs([...inputs, { name: `input${inputs.length + 1}`, type: 'text', required: true }])}>Add input</Button></div>
      </div>
    </div>
  );
}

function Checkpoints({ tasks, onOpen }: { tasks: WfTask[]; onOpen: (t: WfTask) => void }) {
  const cps = tasks.filter((t) => t.checkpoint);
  return (
    <div className="stack-12">
      <p className="caption">Human checkpoints pause the run until an eligible reviewer approves the exact task output. Decisions are recorded by the service, never locally.</p>
      {cps.length === 0 ? <p className="caption">No checkpoints. Mark a task as a human checkpoint to require review before dependents start.</p> : (
        <ul className="list" role="list">{cps.map((t) => (
          <li key={t.id}><button className="list-item" onClick={() => onOpen(t)}><span className="mono caption">{t.id}</span><span className="grow">{t.title || 'Untitled task'}</span><span className="caption clamp-2">{t.instructions || 'No reviewer instructions'}</span></button></li>
        ))}</ul>
      )}
    </div>
  );
}

function TaskDialog({ task, tasks, agents, onClose, onSave, onDelete }: { task: WfTask; tasks: WfTask[]; agents: AgentOption[]; onClose: () => void; onSave: (t: WfTask) => void; onDelete?: () => void }) {
  const [t, setT] = useState(task);
  const [err, setErr] = useState<string | null>(null);
  const others = tasks.filter((x) => x.id !== t.id);
  const agentKey = t.agent ? `${t.agent.id}@${t.agent.rev}` : '';
  const stale = t.agent && !agents.some((a) => a.pin.id === t.agent!.id && a.pin.rev === t.agent!.rev);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} wide title={`${tasks.some((x) => x.id === task.id) ? 'Edit' : 'Add'} task ${t.id}`}
      footer={<>
        {onDelete && <Button variant="danger" icon="trash" onClick={onDelete}>Delete task</Button>}
        <span className="grow" />
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={() => { if (!t.title.trim()) { setErr('Enter a task title.'); document.getElementById('task-title')?.focus(); return; } onSave({ ...t, title: t.title.trim() }); }}>Apply</Button>
      </>}>
      <div className="form-grid">
        <div className="field">
          <label className="field-label" htmlFor="task-title">Title<span className="req" aria-hidden="true"> *</span></label>
          <input id="task-title" className="input" autoFocus value={t.title} onChange={(e) => { setT({ ...t, title: e.target.value }); setErr(null); }} aria-invalid={err ? true : undefined} aria-describedby="task-title-hint" maxLength={180} />
          <small id="task-title-hint" className={err ? 'field-error' : 'field-hint'}>{err ?? 'What this task delivers, e.g. “Implement payment retry”.'}</small>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="task-agent">Agent revision</label>
          <select id="task-agent" className="select" value={agentKey} onChange={(e) => setT({ ...t, agent: agents.find((a) => `${a.pin.id}@${a.pin.rev}` === e.target.value)?.pin ?? null })} aria-describedby="task-agent-hint">
            <option value="">No agent pinned</option>
            {stale && <option value={agentKey}>{t.agent!.id} r{t.agent!.rev} (older revision)</option>}
            {agents.map((a) => <option key={`${a.pin.id}@${a.pin.rev}`} value={`${a.pin.id}@${a.pin.rev}`}>{a.name} · r{a.pin.rev}</option>)}
          </select>
          <small id="task-agent-hint" className="field-hint">{agents.length ? 'Pins the exact saved revision and its SHA-256.' : <>No saved agent definitions yet. <Link to="/agents">Create an agent</Link></>}</small>
        </div>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field-label">Depends on</legend>
          {others.length === 0 ? <span className="caption">No other tasks.</span> : (
            <div className="stack" style={{ gap: 4 }}>
              {others.map((o) => (
                <label key={o.id} className="checkbox"><input type="checkbox" checked={t.dependsOn.includes(o.id)} onChange={(e) => setT({ ...t, dependsOn: e.target.checked ? [...t.dependsOn, o.id] : t.dependsOn.filter((d) => d !== o.id) })} /> <span className="mono caption">{o.id}</span> {o.title || 'Untitled task'}</label>
              ))}
            </div>
          )}
        </fieldset>
        <div className="field">
          <span className="field-label">Human checkpoint</span>
          <label className="checkbox"><input type="checkbox" checked={t.checkpoint} onChange={(e) => setT({ ...t, checkpoint: e.target.checked })} /> Require human review of this task's output</label>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="task-instr">{t.checkpoint ? 'Instructions & reviewer guidance' : 'Instructions'}</label>
          <textarea id="task-instr" className="textarea" rows={4} value={t.instructions} onChange={(e) => setT({ ...t, instructions: e.target.value })} maxLength={20000} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="task-out">Output contract</label>
          <textarea id="task-out" className="textarea" rows={4} value={t.output} onChange={(e) => setT({ ...t, output: e.target.value })} maxLength={20000} aria-describedby="task-out-hint" />
          <small id="task-out-hint" className="field-hint">What the task must produce so dependents and reviewers can verify it.</small>
        </div>
      </div>
    </Dialog>
  );
}
