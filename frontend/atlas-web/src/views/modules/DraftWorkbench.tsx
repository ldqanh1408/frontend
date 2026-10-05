import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { ModuleRoute, SchemaSpec } from '../../data/types';
import type { DraftModuleSpec, DraftTab } from '../../data/module-specs';
import { capability, useApp } from '../../data/app-store';
import { listDefinitions, listRevisions } from '../../lib/definitions';
import { getAll, type DefinitionRecord, type RevisionRecord } from '../../lib/storage';
import type { WorkflowRecord } from '../../lib/workflows';
import { useDeviceQuery } from '../../lib/hooks';
import { relativeTime } from '../../lib/format';
import { Badge, Banner, Button, EmptyState, Skeleton } from '../../components/ui';
import { Tabs } from '../../components/overlays';
import { Icon } from '../../components/Icon';
import { DefinitionForm } from '../definitions/DefinitionForm';
import { fieldId } from '../definitions/FieldControl';
import { ConflictBanner, DraftChrome, NameField, PreservedFields, useDefinitionDraft, type DefinitionDraft } from '../definitions/DefinitionWorkspace';
import { initialValues, validateAll } from '../definitions/validate';

/** Which tab shows a field: explicit fields first, then groups, otherwise the first fields tab. */
function tabResolver(schema: SchemaSpec, tabs: DraftTab[]) {
  const fieldTabs = tabs.filter((t) => !t.kind || t.kind === 'fields' || t.groups || t.fields);
  const first = tabs.find((t) => !t.kind || t.kind === 'fields') ?? tabs[0];
  const map = new Map<string, string>();
  for (const g of schema.groups) for (const f of g.fields) {
    const t = fieldTabs.find((x) => x.fields?.includes(f.key)) ?? fieldTabs.find((x) => x.groups?.includes(g.group)) ?? first;
    map.set(f.key, t.label);
  }
  return { tabOf: (key: string) => (key === '-name' ? first.label : map.get(key) ?? first.label), first: first.label };
}

/** Figma "Definition catalog" + "Definition workbench" for a device-draft module. */
export function DraftWorkbench({ module, spec, schema, defId, basePath, onCreate, busy }: {
  module: ModuleRoute; spec: DraftModuleSpec; schema: SchemaSpec; defId?: string; basePath: string; onCreate: () => void; busy: boolean;
}) {
  const [archived, setArchived] = useState(false);
  const { data: defs, loading } = useDeviceQuery(() => listDefinitions(schema.id), [schema.id], [] as DefinitionRecord[]);
  const visible = defs.filter((d) => d.archived === archived);
  const current = defId ? defs.find((d) => d.id === defId) : undefined;
  return (
    <div className="workbench">
      <section className="panel workbench-catalog" aria-labelledby={`${module}-drafts-h`}>
        <div className="panel-pad stack-12">
          <h2 id={`${module}-drafts-h`} className="eyebrow">Device drafts</h2>
          {loading ? <Skeleton lines={2} label="Loading device drafts" /> : visible.length === 0 ? (
            <p className="caption">{archived ? 'No archived drafts.' : `No device drafts yet. Use “${spec.newLabel}” to start one.`}</p>
          ) : (
            <ul className="list" role="list" aria-label={`${schema.title} drafts`}>
              {visible.map((d) => (
                <li key={d.id}>
                  <Link className="list-item" to={`${basePath}/${d.id}`} aria-current={d.id === defId ? 'true' : undefined}>
                    <Icon name={module === 'agents' ? 'bot' : module === 'memory' ? 'brain' : module === 'configuration' ? 'settings' : 'boxes'} />
                    <span className="grow tree-name">{d.name}</span><span className="caption">r{d.rev}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {visible.length > 0 && !archived && <p className="caption">Unpublished draft · no verified consumers</p>}
          <label className="checkbox caption"><input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> Show archived</label>
        </div>
      </section>
      <div style={{ minWidth: 0 }}>
        {current ? <ModuleEditor key={current.id} spec={spec} schema={schema} rec={current} basePath={basePath} />
          : defId && !loading ? (
            <section className="panel"><EmptyState icon="danger" title="Draft not found">This device draft does not exist in this browser. It may have been created elsewhere.</EmptyState></section>
          ) : (
            <section className="panel">
              <EmptyState icon="layers" title={schema.title} actions={<Button variant="primary" icon="plus" onClick={onCreate} disabled={busy}>{spec.newLabel}</Button>}>
                {schema.purpose} Drafts stay on this device; publishing and readiness require a service.
              </EmptyState>
            </section>
          )}
      </div>
    </div>
  );
}

function ModuleEditor({ spec, schema, rec, basePath }: { spec: DraftModuleSpec; schema: SchemaSpec; rec: DefinitionRecord; basePath: string }) {
  const d = useDefinitionDraft(schema, rec, basePath);
  const { tabOf, first } = useMemo(() => tabResolver(schema, spec.tabs), [schema, spec.tabs]);
  const [tab, setTab] = useState(first);
  const connection = useApp((s) => s.connection);
  const focusField = (key: string) => {
    setTab(tabOf(key));
    requestAnimationFrame(() => document.getElementById(key === '-name' ? 'definition-name' : fieldId(key))?.focus());
  };
  const validate = () => {
    const errs = d.validateComplete();
    const keys = Object.keys(errs);
    const t = spec.tabs.find((x) => x.label === tab);
    if (keys.length && t?.kind && t.kind !== 'fields') setTab(tabOf(keys[0]));
  };
  const actions = ['Evaluate', 'Publish', 'Assign'];
  const gates = actions.map((a) => capability(`${schema.id}:${a.toLowerCase()}`, a));
  const reasonId = `${schema.id}-lifecycle-reason`;
  const errorTabs = useMemo(() => { const c: Record<string, number> = {}; for (const k of Object.keys(d.errors)) c[tabOf(k)] = (c[tabOf(k)] ?? 0) + 1; return c; }, [d.errors, tabOf]);
  return (
    <section className="panel workbench-editor" aria-labelledby="draft-title" onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); d.save(); } }}>
      <div className="panel-pad stack-12">
        <h2 id="draft-title" className="workbench-title break">{d.base.name}</h2>
        <div className="row">
          <Badge>Device draft · r{d.base.rev}</Badge>
          {d.dirty && <Badge tone="warning">Unsaved changes</Badge>}
          {d.base.archived && <Badge tone="warning">Archived</Badge>}
        </div>
        <div className="row" role="group" aria-label="Definition controls">
          <Button onClick={validate}>Validate draft</Button>
          {actions.map((a, i) => <Button key={a} blocked={gates[i].ok ? undefined : gates[i].reason} reasonId={gates[i].ok ? undefined : reasonId}>{a}</Button>)}
          <Button variant="primary" onClick={d.save} disabled={d.base.archived || !!d.conflict} aria-keyshortcuts="Control+S">Save draft</Button>
        </div>
        <p id={reasonId} className="caption">Publishing and runnable readiness require service receipts.{spec.note.startsWith('Publishing') ? '' : ` ${spec.note}`}{connection !== 'connected' ? <> <Link to="/connection">Connect a service</Link> to evaluate, publish or assign.</> : ''}</p>
        {d.base.archived && <Banner tone="warning" title="Archived">Archived drafts are read-only. Restore to edit.</Banner>}
        <ConflictBanner d={d} />
        <Tabs label={`${schema.title} sections`} value={tab} onValueChange={setTab} tabs={spec.tabs.map((t) => ({
          id: t.label,
          label: t.label,
          badge: errorTabs[t.label] ? <span className="badge badge-danger" style={{ marginLeft: 6 }} aria-label={`${errorTabs[t.label]} issues`}>{errorTabs[t.label]}</span> : undefined,
          content: <div className="workbench-tab"><TabBody t={t} d={d} first={t.label === first} tabOf={tabOf} focusField={focusField} spec={spec} /></div>,
        }))} />
        <div className="readiness-grid" aria-label="Readiness summary" role="group">
          {spec.readiness.map((r) => <div key={r.label} className="readiness-item"><span className="secondary">{r.label}</span><span className="caption">{r.status}</span></div>)}
        </div>
        <PreservedFields rec={d.base} />
        <div className="row">
          <Button icon="download" onClick={d.exportDraft}>Export draft</Button>
          <Button variant="quiet" icon={d.base.archived ? 'restore' : 'archive'} onClick={d.archiveToggle} disabled={d.dirty}>{d.base.archived ? 'Restore' : 'Archive'}</Button>
          <Button variant="quiet" icon="copy" onClick={d.duplicate} disabled={d.dirty}>Duplicate</Button>
          {d.dirty && <span className="caption">Save before archiving or duplicating.</span>}
        </div>
      </div>
      <DraftChrome d={d} />
    </section>
  );
}

function TabBody({ t, d, first, tabOf, focusField, spec }: { t: DraftTab; d: DefinitionDraft; first: boolean; tabOf: (k: string) => string; focusField: (k: string) => void; spec: DraftModuleSpec }) {
  const form = (
    <DefinitionForm schema={d.schema} values={d.values} errors={d.errors} onChange={d.onChange} disabled={d.base.archived} showSummary={d.summary}
      onPickPins={d.setPinKey} onFocusField={focusField} include={(_g, key) => tabOf(key) === t.label} />
  );
  if (t.kind === 'readiness') return <Readiness d={d} tabOf={tabOf} focusField={focusField} spec={spec} />;
  if (t.kind === 'versions') return <div className="stack-16"><Versions d={d} />{t.groups && form}</div>;
  if (t.kind === 'consumers') return <Consumers d={d} label={t.label} />;
  return <div className="stack-16">{first && <NameField d={d} />}{form}</div>;
}

function Readiness({ d, tabOf, focusField, spec }: { d: DefinitionDraft; tabOf: (k: string) => string; focusField: (k: string) => void; spec: DraftModuleSpec }) {
  const open = useMemo(() => validateAll(d.schema, d.values, true), [d.schema, d.values]);
  const savedOpen = useMemo(() => Object.keys(validateAll(d.schema, initialValues(d.schema, d.base.data), true)).length, [d.schema, d.base]);
  const byTab: Record<string, string[]> = {};
  for (const k of Object.keys(open)) (byTab[tabOf(k)] ??= []).push(k);
  const labelOf = (k: string) => d.schema.groups.flatMap((g) => g.fields).find((f) => f.key === k)?.label ?? k;
  return (
    <div className="stack-16">
      <div className="stack">
        <h3 className="label">Local field checks</h3>
        {Object.keys(open).length === 0
          ? <Banner tone="success" title="Complete">All required fields are filled and valid in the editor{d.dirty ? ' (unsaved)' : ''}. This does not verify credentials, grants, provider health or runtime capability.</Banner>
          : (
            <ul className="list" role="list">
              {spec.tabs.filter((t) => byTab[t.label]).map((t) => (
                <li key={t.label} className="stack" style={{ gap: 2, padding: '4px 0' }}>
                  <span className="secondary">{t.label} · {byTab[t.label].length} open</span>
                  <span className="row" style={{ gap: 4 }}>{byTab[t.label].map((k) => <button key={k} className="chip" onClick={() => focusField(k)}>{labelOf(k)}</button>)}</span>
                </li>
              ))}
            </ul>
          )}
        <p className="caption">Saved revision r{d.base.rev}: {savedOpen ? `${savedOpen} required or invalid fields` : 'complete'}.</p>
      </div>
      <div className="stack">
        <h3 className="label">Service readiness</h3>
        <p className="caption">Runnable readiness, evaluation results and publication come only from service receipts for an exact revision. None are observed for device drafts.</p>
      </div>
    </div>
  );
}

function Versions({ d }: { d: DefinitionDraft }) {
  const { data: revs } = useDeviceQuery(() => listRevisions(d.base.id), [d.base.id, d.base.rev], [] as RevisionRecord[]);
  return (
    <div className="stack-12">
      <div className="row-between"><h3 className="label">Device revisions ({revs.length})</h3><Button compact icon="history" onClick={() => d.setHistoryOpen(true)}>Compare revisions</Button></div>
      <ul className="list" role="list">
        {revs.map((r) => (
          <li key={r.id} className="list-item" style={{ cursor: 'default' }}>
            <span className="mono caption">r{r.rev}</span><span className="grow break">{r.name}</span>
            <span className="caption mono" title={r.hash}>{r.hash.slice(0, 10)}…</span><span className="caption" title={r.savedAt}>{relativeTime(r.savedAt)}</span>
          </li>
        ))}
      </ul>
      <p className="caption">Published versions are created by the service from an exact saved revision; none are observed here.</p>
    </div>
  );
}

/** Local consumers: device drafts and workflows that pin this definition. Service consumers are never inferred. */
function Consumers({ d, label }: { d: DefinitionDraft; label: string }) {
  const id = d.base.id;
  const { data } = useDeviceQuery(async () => {
    const [defs, wfs] = await Promise.all([getAll<DefinitionRecord>('definitions'), getAll<WorkflowRecord>('workflows')]);
    const needle = `"id":"${id}"`;
    return {
      defs: defs.filter((x) => x.id !== id && !x.archived && JSON.stringify(x.data).replace(/\s/g, '').includes(needle)),
      wfs: wfs.filter((w) => !w.archived && w.tasks.some((t) => t.agent?.id === id)),
    };
  }, [id], { defs: [] as DefinitionRecord[], wfs: [] as WorkflowRecord[] });
  const none = !data.defs.length && !data.wfs.length;
  return (
    <div className="stack-12">
      <h3 className="label">{label === 'Context package' ? 'Context packages pinning this draft' : 'Local consumers'}</h3>
      {none ? <p className="caption">No device draft pins this definition yet.</p> : (
        <ul className="list" role="list">
          {data.defs.map((x) => <li key={x.id}><Link className="list-item" to={`/definitions/${x.schemaId}/${x.id}`}><Icon name="file" /><span className="grow break">{x.name}</span><span className="caption">{x.schemaId}</span></Link></li>)}
          {data.wfs.map((w) => <li key={w.id}><Link className="list-item" to={`/workflow?wf=${w.id}`}><Icon name="workflow" /><span className="grow break">{w.name}</span><span className="caption">workflow</span></Link></li>)}
        </ul>
      )}
      <p className="caption">Service consumers (published assignments, runs) are not observed for device drafts.</p>
    </div>
  );
}
