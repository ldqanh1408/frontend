import { useCallback, useEffect, useState } from 'react';
import { nav } from '../../data/catalog';
import { SERVICE_MODULES } from '../../data/module-specs';
import { app, useApp } from '../../data/app-store';
import { actionGate, loadCollection, type Collection, type ServiceAction, type ServiceRecord } from '../../data/service';
import { Banner, Button, ButtonLink, PageHeader, Panel } from '../../components/ui';
import { usePageMeta } from '../../shell/page-meta';
import { ProvenanceBanner } from '../shared';
import { CommandDialog } from '../modules/ServiceModulePage';
import { ContinueJourney, LifecycleChain, ModuleDefinitions, ModuleViews, OperationReceipts } from '../modules/common';
import ExecutionWorkspace from './ExecutionWorkspace';

export default function ExecutionPage() {
  const m = nav.modules.execution;
  const spec = SERVICE_MODULES.execution!;
  usePageMeta(m.title, [{ label: m.label }]);
  const session = useApp(s => s.session);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [command, setCommand] = useState<ServiceAction | null>(null);
  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true); setError(null);
    try { const next = await loadCollection('execution'); if (app.get().session === session) setCollection(next); } catch (e) { if (app.get().session === session) { setCollection(null); setError(e instanceof Error ? e.message : String(e)); } } finally { if (app.get().session === session) setLoading(false); }
  }, [session]);
  useEffect(() => { setCollection(null); setSelected(null); setCommand(null); setError(null); setLoading(false); if (session) void refresh(); }, [session, refresh]);
  const record: ServiceRecord | null = collection?.items.find(r => r.id === selected) ?? null;
  return <div className="page page-execution"><PageHeader title={m.title} purpose={m.purpose} actions={<><Button icon="refresh" onClick={refresh} disabled={loading} blocked={session ? undefined : 'Connect an authorized service to load execution records.'}>{loading ? 'Refreshing…' : 'Refresh'}</Button>{!session && <ButtonLink to="/connection" variant="primary" icon="plug">Connect service</ButtonLink>}</>} /><ProvenanceBanner />
    {error && <Banner tone="danger" title="Execution records could not be loaded" role="alert">{error} Reconnect or refresh after the service is available.</Banner>}
    <Panel title="Select a resource"><div className="panel-pad stack-8" aria-label="Authorized runs">{collection ? <><div className="row">{collection.items.map(r => <Button key={r.id} aria-pressed={selected === r.id} onClick={() => { setCommand(null); setSelected(r.id); }}>{r.name}</Button>)}</div>{!collection.items.length && <p className="caption">No records in this scope.</p>}</> : <p className="caption">{loading ? 'Loading authorized runs…' : 'Grants and a resource revision are required before acting.'}</p>}{!record && <p className="caption"><strong>Inspect before acting.</strong> {actionGate(null, undefined)}</p>}</div></Panel>
    <ExecutionWorkspace record={record} onCommand={setCommand} />
    <Panel title="Admission & recovery"><div className="panel-pad row">{spec.actions.filter(a => !['Pause', 'Resume'].includes(a.label)).map(a => { const offered = record?.actions?.find(x => x.label.toLowerCase() === a.label.toLowerCase()); const gate = actionGate(record, offered); return <Button key={a.label} blocked={gate ?? undefined} variant={/Cancel|Reject/.test(a.label) ? 'danger' : 'secondary'} onClick={() => offered && !gate && setCommand(offered)}>{a.label}</Button>; })}</div></Panel>
    <div className="split"><section className="panel" aria-label="Lifecycle"><LifecycleChain states={spec.lifecycle} ids={spec.lifecycleIds} label={m.title} title="Lifecycle details" /><ContinueJourney links={spec.links} /></section><OperationReceipts module="execution" /></div>
    <ModuleViews module="execution" /><ModuleDefinitions module="execution" title="Typed inputs & definitions" />
    {command && record && <CommandDialog module="execution" record={record} action={command} onClose={() => setCommand(null)} onDone={refresh} />}
  </div>;
}
