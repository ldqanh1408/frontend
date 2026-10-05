import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { ModuleRoute } from '../../data/types';
import { loadSourceActions, nav } from '../../data/catalog';
import { SERVICE_MODULES } from '../../data/module-specs';
import { actionGate, loadCollection, sendCommand, ServiceError, type Collection, type ServiceAction, type ServiceRecord } from '../../data/service';
import { toast, useApp } from '../../data/app-store';
import { useAsync } from '../../lib/hooks';
import { relativeTime, isoUtc } from '../../lib/format';
import type { JournalEntry } from '../../lib/storage';
import { Badge, Banner, Button, ButtonLink, EmptyState, KeyValue, PageHeader, Stages } from '../../components/ui';
import { Dialog, Tabs } from '../../components/overlays';
import { usePageMeta } from '../../shell/page-meta';
import { ProvenanceBanner } from '../shared';
import { ContinueJourney, LifecycleChain, LifecycleSection, ModuleDefinitions, ModuleViews, NotObserved, OperationReceipts } from './common';

/** Destructive or irreversible controls use the Danger button style (Figma Current UI: Cancel, Reject…). */
const DESTRUCTIVE = /^(cancel|reject|revoke|offboard|request deletion|request erasure)/i;

function InspectFirst({ connected }: { connected: boolean }) {
  return (
    <EmptyState icon="eye" headingLevel={3} title="Inspect before acting">
      {connected ? 'Select a resource to load its current detail from the service.' : 'Actions stay visible. No resource status, provider health or execution result has been inferred.'}
    </EmptyState>
  );
}

/** Service-backed module (Figma Current UI: records table, lifecycle, continue the journey, inspect-before-acting, receipts). */
export default function ServiceModulePage({ module }: { module: ModuleRoute }) {
  const m = nav.modules[module];
  const spec = SERVICE_MODULES[module]!;
  usePageMeta(m.title, [{ label: m.label }]);
  const connection = useApp((s) => s.connection);
  const audience = useApp((s) => s.session?.audience);
  const [col, setCol] = useState<Collection | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ action: ServiceAction; label: string } | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true); setErr(null);
    try { const c = await loadCollection(module); setCol(c); setSelId((id) => (id && c.items.some((r) => r.id === id) ? id : null)); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [module]);
  useEffect(() => { if (connection === 'connected') refresh(); else { setCol(null); setSelId(null); } }, [connection, refresh]);
  const record = col?.items.find((r) => r.id === selId) ?? null;
  const { data: sourceActions } = useAsync(loadSourceActions, []);
  const saById = useMemo(() => new Map((sourceActions ?? []).map((a) => [a.id, a])), [sourceActions]);
  const findAction = (label: string) => record?.actions?.find((a) => a.label.toLowerCase() === label.toLowerCase());
  const gates = spec.actions.map((a) => { const svc = findAction(a.label); return { a, svc, gate: actionGate(record, svc) }; });
  const sharedGate = gates.length > 1 && gates.every((g) => g.gate && g.gate === gates[0].gate) ? gates[0].gate : null;
  const extra = record?.actions?.filter((a) => !spec.actions.some((s) => s.label.toLowerCase() === a.label.toLowerCase())) ?? [];
  return (
    <div className="page">
      <PageHeader title={m.title} purpose={m.purpose} actions={<>
        <Button icon="refresh" onClick={refresh} disabled={loading} blocked={connection === 'connected' ? undefined : 'Connect a service to load records.'} reasonId={connection === 'connected' ? undefined : 'provenance-note'}>{loading ? 'Refreshing…' : 'Refresh'}</Button>
        {connection !== 'connected' && <ButtonLink to="/connection" variant="primary" icon="plug">Connect service</ButtonLink>}
      </>} />
      <ProvenanceBanner />
      {audience === 'observer' && module !== 'observer' && <Banner tone="info" title="Observer session">This session can read telemetry only. Workspace actions are disabled.</Banner>}
      <div className="service-grid">
        <section className="panel service-records" aria-label={`${m.title} records`}>
          {col && <p className="caption service-observed">Observed {relativeTime(col.observedAt)}{col.complete ? '' : ' · partial'}</p>}
          {err && <div className="panel-pad"><Banner tone="danger" title="Records could not be loaded" role="alert">{err}</Banner></div>}
          <RecordsTable col={col} loading={loading} selId={selId} onSelect={setSelId} label={m.title} />
          <LifecycleSection states={spec.lifecycle} ids={spec.lifecycleIds} label={m.title} />
          <ContinueJourney links={spec.links} />
        </section>
        <aside className="panel service-inspect" aria-labelledby="iba-h">
          <div className="panel-pad stack-16">
            <section className="stack" aria-labelledby="iba-h">
              <h2 id="iba-h" className="sr-only">Inspect before acting</h2>
              {record ? (
                <>
                  <p className="workbench-title break">{record.name}</p>
                  <KeyValue items={[['State', <Badge key="s">{record.status}</Badge>], ['Revision', `r${record.revision}`], ['Scope', record.scope], ['Observed', isoUtc(record.observedAt)]]} />
                </>
              ) : <><p className="workbench-title">Select a resource</p><p className="caption">Grants and a resource revision are required before acting.</p></>}
            </section>
            <section className="stack-12" aria-label="Actions">
              <div className="row" role="group" aria-label={`${m.title} actions`} aria-describedby={sharedGate ? `${module}-act-reason` : undefined}>
                {gates.map(({ a, svc, gate }) => (
                  <Button key={a.label} variant={DESTRUCTIVE.test(a.label) ? 'danger' : 'secondary'} blocked={gate ?? undefined} reasonId={sharedGate ? `${module}-act-reason` : undefined}
                    onClick={() => svc && setPending({ action: svc, label: a.label })}>{a.label}</Button>
                ))}
                {extra.map((a) => {
                  const gate = actionGate(record, a);
                  return <Button key={a.id} variant={DESTRUCTIVE.test(a.label) ? 'danger' : 'secondary'} blocked={gate ?? undefined} onClick={() => setPending({ action: a, label: a.label })}>{a.label}</Button>;
                })}
              </div>
              {sharedGate && <p id={`${module}-act-reason`} className="caption">{sharedGate}</p>}
            </section>
          </div>
          <Tabs label={`${m.title} detail`} tabs={spec.tabs.map((t) => ({
            id: t, label: t,
            content: <div className="panel-pad">{record ? <RecordTab record={record} tab={t} /> : <InspectFirst connected={connection === 'connected'} />}</div>,
          }))} />
          <OperationReceipts module={module} bare />
        </aside>
      </div>
      <div className="split">
        <details className="panel panel-pad">
          <summary className="label" style={{ cursor: 'pointer' }}>Authorization requirements</summary>
          <dl className="stack" style={{ marginTop: 8 }}>
            {spec.actions.filter((a) => a.sourceAction && saById.get(a.sourceAction)).map((a) => {
              const sa = saById.get(a.sourceAction!)!;
              return <div key={a.label}><dt className="label">{a.label}</dt><dd className="caption">{sa.authorization}. {sa.preconditions}</dd></div>;
            })}
          </dl>
        </details>
        <section className="panel panel-pad stack" aria-labelledby="rule-h">
          <h2 id="rule-h" className="label">Outcome rule</h2>
          <p className="caption">Received and Accepted are acknowledgements. Effective requires a matched operation, scope, input fingerprint and effect readback. Unknown keeps the original operation ID for reconciliation.</p>
        </section>
      </div>
      <LifecycleChain states={spec.lifecycle} ids={spec.lifecycleIds} label={m.title} title="Lifecycle details" />
      <ModuleViews module={module} />
      <ModuleDefinitions module={module} title="Typed inputs & definitions" />
      {pending && record && <CommandDialog module={module} record={record} action={pending.action} onClose={() => setPending(null)} onDone={refresh} />}
      <p className="caption">Related: <Link to="/connection">Connection & operation receipts</Link></p>
    </div>
  );
}

function RecordsTable({ col, loading, selId, onSelect, label }: { col: Collection | null; loading: boolean; selId: string | null; onSelect: (id: string) => void; label: string }) {
  const connection = useApp((s) => s.connection);
  // Figma keeps the column structure visible even before the service returns records.
  const head = <thead><tr><th scope="col">Name</th><th scope="col">State</th><th scope="col">Revision</th><th scope="col">Observed</th></tr></thead>;
  const empty = !col ? (
    <EmptyState icon="play" headingLevel={3} title={loading ? 'Loading records…' : 'Connect this lifecycle'}>
      {connection === 'connected' ? 'Loading authorized records for this scope.' : 'Records, states and revisions come from an authorized service. Nothing is shown until the service returns it.'}
    </EmptyState>
  ) : !col.items.length ? <EmptyState icon="inbox" headingLevel={3} title="No records in this scope">The connected service returned no {label.toLowerCase()} records for your current scope.</EmptyState> : null;
  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="sr-only">{label} records. Select one to inspect actions.</caption>
        {head}
        <tbody>
          {empty ? <tr><td colSpan={4} className="table-empty">{empty}</td></tr> : col!.items.map((r) => (
            <tr key={r.id} aria-selected={r.id === selId} data-selected={r.id === selId || undefined}>
              <th scope="row"><button className="link-button" aria-pressed={r.id === selId} onClick={() => onSelect(r.id)}>{r.name}</button></th>
              <td><Badge>{r.status}</Badge></td>
              <td className="mono">r{r.revision}</td>
              <td title={isoUtc(r.observedAt)}>{relativeTime(r.observedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecordTab({ record, tab }: { record: ServiceRecord; tab: string }) {
  const key = tab.toLowerCase().replace(/[^a-z]+/g, '');
  const entry = Object.entries(record.fields ?? {}).find(([k]) => k.toLowerCase().replace(/[^a-z]+/g, '') === key);
  if (!entry) {
    const fields = Object.entries(record.fields ?? {});
    if (tab === 'Tasks' || !fields.length) return <NotObserved what={tab} />;
    return (
      <div className="stack-12">
        <p className="caption">The service returned no “{tab}” section. Fields observed on this record:</p>
        <KeyValue items={fields.map(([k, v]) => [k, <span key={k} className="mono break">{typeof v === 'string' ? v : JSON.stringify(v)}</span>])} />
      </div>
    );
  }
  const v = entry[1];
  return <pre className="code-block">{typeof v === 'string' ? v : JSON.stringify(v, null, 2)}</pre>;
}

function CommandDialog({ module, record, action, onClose, onDone }: { module: string; record: ServiceRecord; action: ServiceAction; onClose: () => void; onDone: () => void }) {
  const session = useApp((s) => s.session);
  const [input, setInput] = useState<Record<string, string>>({});
  const [result, setResult] = useState<JournalEntry | null>(null);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const missing = (action.inputs ?? []).filter((i) => i.required && !input[i.key]?.trim());
  const send = async () => {
    if (sending || result) return;
    setSending(true); setErr(null);
    try {
      const e = await sendCommand(module, record, action, input);
      setResult(e);
      toast({ tone: e.stage === 'Effective' ? 'success' : e.stage === 'Rejected' ? 'danger' : e.stage === 'Unknown' ? 'warning' : 'info', title: `${action.label}: ${e.stage}`, body: e.message, kind: 'operation' });
      onDone();
    } catch (e) {
      setErr(e instanceof ServiceError || e instanceof Error ? e.message : String(e));
    } finally { setSending(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={result ? `${action.label} · ${result.stage}` : `Send “${action.label}”?`}
      description={result ? undefined : 'Review the exact resource, revision and scope. The request is sent once; an unclear outcome is recorded as Unknown and is never re-sent automatically.'}
      footer={result ? <Button variant="primary" onClick={onClose}>Close</Button> : <>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={send} disabled={sending || missing.length > 0}>{sending ? 'Sending…' : `Send ${action.label}`}</Button>
      </>}>
      <div className="stack-12">
        <KeyValue items={[['Resource', record.name], ['Expected revision', `r${action.expectedRevision}`], ['Scope', session?.scope.label ?? '—'], ['Grant', action.grant]]} />
        {!result && (action.inputs ?? []).map((i) => (
          <div className="field" key={i.key}>
            <label className="field-label" htmlFor={`cmd-${i.key}`}>{i.label}{i.required && <span className="req" aria-hidden="true"> *</span>}</label>
            <input id={`cmd-${i.key}`} className="input" required={i.required} value={input[i.key] ?? ''} onChange={(e) => setInput((s) => ({ ...s, [i.key]: e.target.value }))} />
          </div>
        ))}
        {err && <Banner tone="danger" title="Not sent" role="alert">{err}</Banner>}
        {result && (
          <div className="stack" role="status">
            <Stages stage={result.stage} />
            <p className="secondary">{result.message}</p>
            <p className="caption mono break">Operation {result.id}</p>
          </div>
        )}
      </div>
    </Dialog>
  );
}
