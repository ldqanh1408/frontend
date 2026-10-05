import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useBlocker, useNavigate } from 'react-router';
import type { SchemaSpec } from '../../data/types';
import { nav } from '../../data/catalog';
import { capability, toast, useApp } from '../../data/app-store';
import { createDefinition, downloadJson, duplicateDefinition, exportDefinition, importDefinition, listDefinitions, listRevisions, saveDefinition } from '../../lib/definitions';
import { ConflictError, type DefinitionRecord, type RevisionRecord } from '../../lib/storage';
import { useDeviceQuery } from '../../lib/hooks';
import { relativeTime } from '../../lib/format';
import { isValidName } from '../../lib/ids';
import { Badge, Banner, Button, EmptyState, Panel } from '../../components/ui';
import { Dialog } from '../../components/overlays';
import { Icon } from '../../components/Icon';
import { DefinitionForm, SectionNav } from './DefinitionForm';
import { initialValues, isDirty, toData, validateAll, type Errors, type FormValue, type FormValues } from './validate';
import { PinPicker, type Pin } from './PinPicker';

/** Authoring workspace for one definition type. `basePath` is where list/editor URLs live (/definitions/:schema or a module tab). */
export function DefinitionWorkspace({ schema, defId, basePath, headingLevel = 2, embedded = false }: { schema: SchemaSpec; defId?: string; basePath: string; headingLevel?: 1 | 2; embedded?: boolean }) {
  const navigate = useNavigate();
  const [collection, setCollection] = useState<'active' | 'archived'>('active');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: defs, loading } = useDeviceQuery(() => listDefinitions(schema.id), [schema.id], [] as DefinitionRecord[]);
  const current = defId ? defs.find((d) => d.id === defId) : undefined;
  const visible = defs.filter((d) => (collection === 'archived' ? d.archived : !d.archived) && d.name.toLowerCase().includes(q.trim().toLowerCase()));
  const mod = nav.modules[schema.route];
  const H = `h${headingLevel}` as 'h1' | 'h2';

  const onCreate = useCallback(async () => {
    setBusy(true);
    try {
      const rec = await createDefinition(schema);
      toast({ tone: 'success', title: 'Local definition created', body: `${rec.name} · device revision 1. Not published to any service.` });
      navigate(`${basePath}/${rec.id}`);
    } catch (e) {
      toast({ tone: 'danger', title: 'Could not create the definition', body: e instanceof Error ? e.message : String(e) });
    } finally { setBusy(false); }
  }, [schema, basePath, navigate]);

  const onImport = async (file: File) => {
    try {
      if (file.size > 2_000_000) throw new Error('The file is larger than 2 MB.');
      const rec = await importDefinition(schema, await file.text());
      toast({ tone: 'success', title: 'Definition imported', body: `${rec.name}${Object.keys(rec.preserved).length ? ` · ${Object.keys(rec.preserved).length} additional fields preserved for review` : ''}` });
      navigate(`${basePath}/${rec.id}`);
    } catch (e) {
      toast({ tone: 'danger', title: 'Import failed', body: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <div className="stack-16">
      <div className={embedded ? 'row-between' : 'page-head'}>
        {embedded ? <H style={{ font: 'var(--text-heading)', fontSize: 18 }}>{schema.title}</H> : (
          <div className="page-head-text">
            <span className="eyebrow">{mod?.label} · Definitions</span>
            <H tabIndex={-1} data-page-title={headingLevel === 1 ? true : undefined}>{schema.title}</H>
            <p>{schema.purpose}</p>
          </div>
        )}
        <div className="row">
          <Badge tone="accent">{schema.fieldCount} fields · v1</Badge>
          <Button icon="plus" variant="primary" onClick={onCreate} disabled={busy}>New {schema.title.toLowerCase()}</Button>
          <Button icon="upload" onClick={() => fileRef.current?.click()}>Import definition JSON</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onImport(f); }} />
          <Button icon="download" onClick={() => downloadJson(`${schema.id}.schema.json`, { format: 'atlas-field-schema/v1', schema: schema.id, title: schema.title, groups: schema.groups })}>Export field schema</Button>
        </div>
      </div>
      {!embedded && <Banner tone="info" title="Device draft">Service is not involved. Complete field checks do not verify credentials, grants, provider health, compatibility, readiness or production effects.</Banner>}
      <div className="split-3">
        <Panel title="Definitions" headingLevel={2}>
          <div className="panel-pad stack-12">
            <div className="field">
              <label className="field-label" htmlFor={`${schema.id}-find`}>Find definitions</label>
              <input id={`${schema.id}-find`} className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name…" />
            </div>
            <div className="field">
              <label className="field-label" htmlFor={`${schema.id}-col`}>Definition collection</label>
              <select id={`${schema.id}-col`} className="select" value={collection} onChange={(e) => setCollection(e.target.value as 'active' | 'archived')}>
                <option value="active">Active</option><option value="archived">Archived</option>
              </select>
            </div>
            {loading ? <span className="caption">Loading…</span> : visible.length === 0 ? (
              <p className="caption">{q ? 'No definition matches this name.' : collection === 'archived' ? 'No archived definitions.' : 'No local definitions of this type yet.'}</p>
            ) : (
              <ul className="list" role="list" aria-label={`${schema.title} definitions`}>
                {visible.map((d) => (
                  <li key={d.id}>
                    <Link className="list-item" to={`${basePath}/${d.id}`} aria-current={d.id === defId ? 'true' : undefined}>
                      <Icon name="file" /><span className="grow break">{d.name}</span><span className="caption">r{d.rev}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
        <div style={{ minWidth: 0 }}>
          {current ? <DefinitionEditor key={current.id} schema={schema} rec={current} basePath={basePath} />
            : defId && !loading ? (
              <Panel><EmptyState icon="danger" title="Definition not found" actions={<Button onClick={() => navigate(basePath)}>Back to {schema.title}</Button>}>This local definition does not exist on this device. It may have been created in another browser.</EmptyState></Panel>
            ) : (
              <Panel>
                <EmptyState icon="layers" title={schema.title} actions={<Button variant="primary" icon="plus" onClick={onCreate} disabled={busy}>Create local definition</Button>}>
                  {schema.purpose}
                </EmptyState>
              </Panel>
            )}
        </div>
        <LifecyclePanel schema={schema} rec={current} />
      </div>
    </div>
  );
}

function LifecyclePanel({ schema, rec }: { schema: SchemaSpec; rec?: DefinitionRecord }) {
  useApp((s) => s.connection);
  const [errs, setErrs] = useState<Errors | null>(null);
  useEffect(() => { setErrs(rec ? validateAll(schema, initialValues(schema, rec.data), true) : null); }, [schema, rec]);
  return (
    <aside className="panel" aria-label="Lifecycle and readiness">
      <section className="panel-section stack" aria-labelledby="lc-h">
        <h2 id="lc-h" className="label">Actions & readiness</h2>
        <Badge tone="warning">Service readiness: not observed</Badge>
        {rec && errs && <Badge tone={Object.keys(errs).length ? 'neutral' : 'success'}>{Object.keys(errs).length ? `Complete validation: ${Object.keys(errs).length} open` : 'Local field checks passed'}</Badge>}
        {schema.actions.map((a) => {
          const cap = capability(`${schema.id}:${a.toLowerCase().replace(/[^a-z]+/g, '-')}`, a);
          return <Button key={a} block blocked={cap.ok ? undefined : rec ? `Requires authorized scope, exact revision and service input contract. ${cap.reason}` : 'Create and save a local definition first.'}>{a}</Button>;
        })}
        <Link className="btn btn-block btn-quiet" to="/connection">Open service lifecycle</Link>
      </section>
      <section className="panel-section stack" aria-labelledby="sec-h">
        <h2 id="sec-h" className="label">Definition sections</h2>
        <SectionNav schema={schema} errors={errs ?? undefined} />
      </section>
    </aside>
  );
}

/** Editing state and commands for one local definition (shared by the definitions page and the module workbenches). */
export function useDefinitionDraft(schema: SchemaSpec, rec: DefinitionRecord, basePath: string) {
  const navigate = useNavigate();
  const [base, setBase] = useState<DefinitionRecord>(rec);
  const saved = useMemo(() => initialValues(schema, base.data), [schema, base]);
  const [values, setValues] = useState<FormValues>(saved);
  const [name, setName] = useState(base.name);
  const [errors, setErrors] = useState<Errors>({});
  const [summary, setSummary] = useState(false);
  const [conflict, setConflict] = useState<{ rev: number } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pinKey, setPinKey] = useState<string | null>(null);
  const dirty = isDirty(values, saved) || name !== base.name;
  // Revisions this editor is writing right now; their change notifications are our own, not another tab's.
  const ownWrites = useRef(new Set<number>());
  // A newer revision written in another tab: adopt it when we have no unsaved edits, otherwise surface the conflict.
  useEffect(() => {
    if (rec.rev > base.rev && !ownWrites.current.has(rec.rev)) {
      if (!dirty) { setBase(rec); setValues(initialValues(schema, rec.data)); setName(rec.name); } else setConflict({ rev: rec.rev });
    }
  }, [rec]); // eslint-disable-line react-hooks/exhaustive-deps
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); } };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);
  const onChange = useCallback((key: string, v: FormValue) => {
    setValues((st) => ({ ...st, [key]: v }));
    setErrors((e) => { if (!e[key]) return e; const n = { ...e }; delete n[key]; return n; });
  }, []);
  const save = async () => {
    const shape = validateAll(schema, values, false);
    const nameErr = isValidName(name);
    if (nameErr) shape['-name'] = nameErr;
    setErrors(shape);
    setSummary(true);
    if (Object.keys(shape).length) return false;
    try {
      ownWrites.current.add(base.rev + 1);
      const next = await saveDefinition(base, { name, data: toData(schema, values) });
      setBase(next); setValues(initialValues(schema, next.data)); setSummary(false);
      toast({ tone: 'success', title: `Device revision ${next.rev} saved`, body: 'Saved on this device only. Publication requires a service.' });
      return true;
    } catch (e) {
      if (e instanceof ConflictError) setConflict({ rev: e.current.rev });
      else toast({ tone: 'danger', title: 'Save failed', body: e instanceof Error ? e.message : String(e) });
      return false;
    }
  };
  const validateComplete = () => {
    const errs = validateAll(schema, values, true);
    const nameErr = isValidName(name);
    if (nameErr) errs['-name'] = nameErr;
    setErrors(errs); setSummary(true);
    if (!Object.keys(errs).length) toast({ tone: 'success', title: 'Local field checks passed', body: 'Shape and required fields are complete. Service validation is not run.' });
    return errs;
  };
  const archiveToggle = async () => {
    try {
      ownWrites.current.add(base.rev + 1);
      const next = await saveDefinition(base, { archived: !base.archived });
      setBase(next);
      toast({ tone: 'success', title: next.archived ? 'Definition archived' : 'Definition restored', body: `${next.name} · device revision ${next.rev}` });
    } catch (e) { toast({ tone: 'danger', title: 'Could not change the collection', body: e instanceof Error ? e.message : String(e) }); }
  };
  const duplicate = async () => {
    const copy = await duplicateDefinition(schema, base);
    toast({ tone: 'success', title: 'Definition duplicated', body: `${copy.name}. Approvals and service state are never copied.` });
    navigate(`${basePath}/${copy.id}`);
  };
  const exportDraft = async () => downloadJson(`${base.name}.json`, { ...(await exportDefinition(base)), unsaved: dirty ? toData(schema, values) : undefined });
  const exportEdits = () => downloadJson(`${base.name}-unsaved.json`, { format: 'atlas-recovery/v1', schemaId: schema.id, name, data: toData(schema, values) });
  const discardAndLoad = () => { setBase(rec); setValues(initialValues(schema, rec.data)); setName(rec.name); setConflict(null); };
  const applyPins = (key: string, pins: Pin[]) => {
    const existing = (() => { try { const v = JSON.parse(String(values[key] || '[]')); return Array.isArray(v) ? v : []; } catch { return []; } })();
    onChange(key, JSON.stringify([...existing.filter((p: { id: string }) => !pins.some((n) => n.id === p.id)), ...pins], null, 2));
  };
  return {
    schema, rec, base, values, name, setName, errors, summary, conflict, dirty, historyOpen, setHistoryOpen, pinKey, setPinKey, blocker,
    onChange, save, validateComplete, archiveToggle, duplicate, exportDraft, exportEdits, discardAndLoad, applyPins,
  };
}
export type DefinitionDraft = ReturnType<typeof useDefinitionDraft>;

/** Conflict banner, history, pin picker and the leave-with-unsaved-changes dialog for a draft. */
export function DraftChrome({ d }: { d: DefinitionDraft }) {
  return (
    <>
      <HistoryDialog open={d.historyOpen} onOpenChange={d.setHistoryOpen} rec={d.base} schema={d.schema} current={toData(d.schema, d.values)} />
      {d.pinKey && <PinPicker open onOpenChange={(o) => !o && d.setPinKey(null)} excludeId={d.base.id} onPick={(pins) => { d.applyPins(d.pinKey!, pins); d.setPinKey(null); }} />}
      <Dialog open={d.blocker.state === 'blocked'} onOpenChange={(o) => { if (!o) d.blocker.reset?.(); }} title="Leave with unsaved changes?"
        description="Your edits to this definition have not been saved as a device revision."
        footer={<>
          <Button onClick={() => d.blocker.reset?.()}>Stay and edit</Button>
          <Button onClick={d.exportEdits}>Export unsaved draft</Button>
          <Button variant="danger" onClick={() => d.blocker.proceed?.()}>Discard and leave</Button>
        </>} />
    </>
  );
}

export function ConflictBanner({ d }: { d: DefinitionDraft }) {
  if (!d.conflict) return null;
  return (
    <Banner tone="danger" title="Changed in another tab" role="alert">
      Revision {d.conflict.rev} was saved elsewhere while you edited. Your edits are kept here; export them, or discard them to load the newer revision.
      <div className="row" style={{ marginTop: 8 }}>
        <Button compact onClick={d.exportEdits}>Export my edits</Button>
        <Button compact variant="danger" onClick={d.discardAndLoad}>Discard and load r{d.conflict.rev}</Button>
      </div>
    </Banner>
  );
}

export function NameField({ d, prefix = 'definition' }: { d: DefinitionDraft; prefix?: string }) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={`${prefix}-name`}>Name<span className="req" aria-hidden="true"> *</span></label>
      <input id={`${prefix}-name`} className="input" value={d.name} onChange={(e) => d.setName(e.target.value)} disabled={d.base.archived} aria-invalid={d.errors['-name'] ? true : undefined} aria-describedby={`${prefix}-name-hint`} required />
      <small id={`${prefix}-name-hint`} className={d.errors['-name'] ? 'field-error' : 'field-hint'}>{d.errors['-name'] ?? '1–180 characters; no path separators or control characters.'}</small>
    </div>
  );
}

function DefinitionEditor({ schema, rec, basePath }: { schema: SchemaSpec; rec: DefinitionRecord; basePath: string }) {
  const d = useDefinitionDraft(schema, rec, basePath);
  const { base, dirty } = d;
  return (
    <div className="stack-16" onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); d.save(); } }}>
      <Panel title={base.archived ? 'Archived definition' : 'Edit definition'} actions={<Badge>{dirty ? 'Unsaved changes' : `Device revision ${base.rev}`}</Badge>}>
        <div className="panel-pad stack-12">
          {base.archived && <Banner tone="warning" title="Archived">Archived definitions are read-only. Restore to edit.</Banner>}
          <ConflictBanner d={d} />
          <NameField d={d} />
          <div className="row">
            <Button variant="primary" icon="save" onClick={d.save} disabled={base.archived || !!d.conflict}>Save local revision</Button>
            <Button icon="success" onClick={d.validateComplete}>Validate complete definition</Button>
            <Button icon="history" onClick={() => d.setHistoryOpen(true)}>History / compare</Button>
          </div>
        </div>
      </Panel>
      <DefinitionForm schema={schema} values={d.values} errors={d.errors} onChange={d.onChange} disabled={base.archived} showSummary={d.summary} onPickPins={d.setPinKey} />
      <PreservedFields rec={base} />
      <Panel title="Saved definition actions">
        <div className="panel-pad row">
          <Button icon={base.archived ? 'restore' : 'archive'} onClick={d.archiveToggle} disabled={dirty}>{base.archived ? 'Restore' : 'Archive'}</Button>
          <Button icon="copy" onClick={d.duplicate} disabled={dirty}>Duplicate definition</Button>
          <Button icon="download" onClick={d.exportDraft}>Export definition & draft</Button>
          {dirty && <span className="caption">Save or export changes before archiving or duplicating.</span>}
        </div>
      </Panel>
      <DraftChrome d={d} />
    </div>
  );
}

export function PreservedFields({ rec }: { rec: DefinitionRecord }) {
  if (!Object.keys(rec.preserved).length) return null;
  return (
    <Panel title="Preserved legacy fields">
      <div className="panel-pad stack">
        <p className="caption">These fields are retained when saving. They require explicit service contract mapping before publication.</p>
        <details><summary>{Object.keys(rec.preserved).length} retained fields</summary><pre className="code-block">{JSON.stringify(rec.preserved, null, 2)}</pre></details>
      </div>
    </Panel>
  );
}

export function HistoryDialog({ open, onOpenChange, rec, schema, current }: { open: boolean; onOpenChange: (o: boolean) => void; rec: DefinitionRecord; schema: SchemaSpec; current: Record<string, unknown> }) {
  const [revs, setRevs] = useState<RevisionRecord[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  useEffect(() => { if (open) listRevisions(rec.id).then((r) => { setRevs(r); setSel(r[1]?.rev ?? r[0]?.rev ?? null); }); }, [open, rec.id, rec.rev]);
  const chosen = revs.find((r) => r.rev === sel);
  const keys = schema.groups.flatMap((g) => g.fields.map((f) => [f.key, f.label] as const));
  const diff = chosen ? keys.filter(([k]) => JSON.stringify(chosen.data[k]) !== JSON.stringify(current[k])) : [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange} wide title="Saved definition history" description="Every device revision is immutable and hashed. Compare a saved revision with the current form.">
      {revs.length === 0 ? <p>No saved revisions.</p> : (
        <div className="split">
          <div className="stack" role="group" aria-label="Revisions">
            {revs.map((r) => (
              <button key={r.id} className="list-item" aria-pressed={r.rev === sel} onClick={() => setSel(r.rev)}>
                <span className="grow">r{r.rev} · {r.name}</span><span className="caption" title={r.savedAt}>{relativeTime(r.savedAt)}</span>
              </button>
            ))}
          </div>
          <div className="stack">
            {chosen && <p className="caption mono break">sha256 {chosen.hash}</p>}
            {chosen && (diff.length === 0 ? <p>The current form matches r{chosen.rev}.</p> : (
              <table className="table">
                <thead><tr><th scope="col">Field</th><th scope="col">r{chosen.rev}</th><th scope="col">Current</th></tr></thead>
                <tbody>{diff.map(([k, label]) => <tr key={k}><th scope="row" className="label">{label}</th><td className="mono">{fmt(chosen.data[k])}</td><td className="mono">{fmt(current[k])}</td></tr>)}</tbody>
              </table>
            ))}
          </div>
        </div>
      )}
    </Dialog>
  );
}
const fmt = (v: unknown) => (v === undefined ? '—' : typeof v === 'string' ? v : JSON.stringify(v));
