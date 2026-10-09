import nativeStates from '../../generated/native-states.json';
import { useState } from 'react';
import { Link } from 'react-router';
import { loadLifecycles, loadSchemas, nav, routes } from '../../data/catalog';
import type { ModuleRoute } from '../../data/types';
import { useAsync, useDeviceQuery } from '../../lib/hooks';
import { listJournal, reconcile } from '../../data/service';
import { useApp, toast } from '../../data/app-store';
import { relativeTime } from '../../lib/format';
import type { JournalEntry } from '../../lib/storage';
import { Badge, Button, EmptyState, Panel, Stages } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { modulePath } from '../../shell/Sidebar';

/** Every planned view owned by a module (Atlas-Screen-Inventory), so each of the 210 views is reachable from its module. */
export function ModuleViews({ module, title = 'Views in this module' }: { module: ModuleRoute; title?: string }) {
  const [showStates, setShowStates] = useState(false);
  const mine = routes.filter((r) => r.module === module && !r.bare);
  const screens = mine.filter((r) => r.kind === 'route');
  const states = mine.filter((r) => r.kind === 'state');
  if (!mine.length) return null;
  return (
    <Panel title={title} actions={<span className="caption">{screens.length} screens{states.length ? ` · ${states.length} states` : ''}</span>}>
      {nativeStates.filter(s => s.module === module).length > 0 && <nav className="panel-pad chip-row" aria-label="Detailed module states">{nativeStates.filter(s => s.module === module).map(s => <Link key={s.key} className="chip" to={`/states/${s.key}`}>{s.title}</Link>)}</nav>}
      <ul className="view-links" role="list">
        {screens.map((r) => <li key={r.id}><Link to={r.route} className="list-item"><Icon name="chevron-right" /><span className="grow">{r.title}</span></Link></li>)}
      </ul>
      {states.length > 0 && (
        <div className="panel-pad" style={{ paddingTop: 0 }}>
          <Button compact variant="quiet" icon={showStates ? 'chevron-down' : 'chevron-right'} aria-expanded={showStates} onClick={() => setShowStates((v) => !v)}>
            {showStates ? 'Hide' : 'Show'} state views ({states.length})
          </Button>
          {showStates && (
            <ul className="view-links" role="list">
              {states.map((r) => <li key={r.id}><Link to={r.route} className="list-item"><Icon name="layers" /><span className="grow">{r.title}</span></Link></li>)}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}

export function ModuleDefinitions({ module, title = 'Definitions' }: { module: ModuleRoute; title?: string }) {
  const { data } = useAsync(loadSchemas, []);
  const list = data?.list.filter((s) => s.route === module) ?? [];
  if (!list.length) return null;
  return (
    <Panel title={title} actions={<Link className="caption" to="/definitions">All definitions</Link>}>
      <ul className="view-links" role="list">
        {list.map((s) => (
          <li key={s.id}>
            <Link to={`/definitions/${s.id}`} className="list-item">
              <Icon name="file-text" /><span className="grow stack" style={{ gap: 2 }}><span>{s.title}</span><span className="caption clamp-2">{s.purpose}</span></span>
              <span className="caption nowrap">{s.fieldCount} fields</span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function LifecycleChain({ states, ids, label, title = 'Lifecycle' }: { states: string[] | null; ids: string[]; label: string; title?: string }) {
  const { data } = useAsync(loadLifecycles, []);
  const lcs = ids.map((id) => data?.[id]).filter(Boolean);
  return (
    <Panel title={title} actions={<Badge tone="warning">Proposed</Badge>}>
      <div className="panel-pad stack-12">
        {states && <ol className="lifecycle-chain" aria-label={`${label} lifecycle: ${states.join(' / ')}`}>{states.map((s) => <li key={s}><span className="badge">{s}</span></li>)}</ol>}
        {lcs.map((lc) => (
          <details key={lc!.id} className="lc-detail">
            <summary><span className="label">{lc!.entity}</span> <span className="caption">{lc!.id}</span></summary>
            <ol className="lifecycle-chain" aria-label={`${lc!.entity} states`}>{lc!.states.map((s, i) => <li key={`${s.name}-${i}`}><span className="badge">{s.name}</span></li>)}</ol>
            <p className="caption"><strong>Requires service:</strong> {lc!.disabled}. {lc!.reason}.</p>
            <p className="caption"><strong>Recovery:</strong> {lc!.recovery}</p>
          </details>
        ))}
        <p className="caption">Connect this lifecycle to an authorized service to see each record's current state. State names are design proposals until the service contract is approved.</p>
      </div>
    </Panel>
  );
}

/** Figma "Lifecycle" band inside the records panel: the state names as a plain chain (raised background). */
export function LifecycleSection({ states, ids, label }: { states: string[] | null; ids: string[]; label: string }) {
  const { data } = useAsync(loadLifecycles, []);
  const names = states ?? (ids[0] && data?.[ids[0]] ? data[ids[0]]!.states.map((s) => s.name) : []);
  return (
    <section className="lifecycle-band stack" aria-labelledby={`${label}-lc-h`.replace(/\W+/g, '-')}>
      <h2 id={`${label}-lc-h`.replace(/\W+/g, '-')} className="label">Lifecycle</h2>
      {names.length > 0 && <p className="chain" aria-label={`${label} lifecycle: ${names.join(' / ')}`}>{[...new Set(names)].map((n) => <span key={n}>{n}</span>)}</p>}
    </section>
  );
}

export function ContinueJourney({ links }: { links: { label: string; to: ModuleRoute }[] }) {
  return (
    <section className="panel-pad stack-12" aria-labelledby="journey-next-h">
      <h2 id="journey-next-h" className="label">Continue the journey</h2>
      <ul className="stack" role="list" style={{ margin: 0, padding: 0, alignItems: 'flex-start' }}>
        {links.map((l) => (
          <li key={l.label}><Link to={modulePath(l.to)} className="btn" aria-label={`${l.label} (${nav.modules[l.to].label})`}>{l.label}</Link></li>
        ))}
      </ul>
    </section>
  );
}

export function OperationReceipts({ module, bare }: { module?: string; bare?: boolean }) {
  const connected = useApp((s) => s.connection === 'connected');
  const { data } = useDeviceQuery(() => listJournal(module), [module], [] as JournalEntry[]);
  const [busy, setBusy] = useState<string | null>(null);
  const onReconcile = async (e: JournalEntry) => {
    setBusy(e.id);
    try {
      const next = await reconcile(e);
      toast({ tone: next.stage === 'Effective' ? 'success' : next.stage === 'Rejected' ? 'danger' : 'info', title: `${next.label}: ${next.stage}`, body: next.message, kind: 'operation' });
    } finally { setBusy(null); }
  };
  const body = data.length === 0 ? (
        <div className="panel-pad"><p className="caption">No operations recorded for this session scope.</p></div>
      ) : (
        <ul className="list" role="list" style={{ padding: 'var(--space-8)' }}>
          {data.slice(0, 50).map((e) => (
            <li key={e.id} className="receipt">
              <div className="row-between">
                <span className="label break">{e.label} · {e.resourceName}</span>
                <Badge>{e.stage}</Badge>
              </div>
              <Stages stage={e.stage} />
              <p className="caption">{e.message}</p>
              <p className="caption mono break">op {e.id} · {e.scope} · {relativeTime(e.updatedAt)}{e.evidence ? ` · evidence ${e.evidence}` : ''}</p>
              {(e.stage === 'Unknown' || e.stage === 'Received' || e.stage === 'Accepted') && (
                <div><Button compact icon="refresh" onClick={() => onReconcile(e)} disabled={busy === e.id}
                  blocked={connected ? undefined : 'Reconnect the same service scope to reconcile this operation.'}>Reconcile</Button></div>
              )}
            </li>
          ))}
        </ul>
      );
  if (bare) {
    return (
      <section className="receipts-band" aria-labelledby="receipts-h">
        <div className="panel-head"><h2 id="receipts-h">Operation receipts</h2><span className="caption">{data.length} recorded</span></div>
        {body}
      </section>
    );
  }
  return <Panel title="Operation receipts" actions={<span className="caption">{data.length} recorded</span>}>{body}</Panel>;
}

export function NotObserved({ what, headingLevel = 3 }: { what: string; headingLevel?: 2 | 3 }) {
  const connected = useApp((s) => s.connection === 'connected');
  return (
    <EmptyState icon="eye-off" headingLevel={headingLevel} title={connected ? `No ${what.toLowerCase()} returned` : 'Not observed'}>
      {connected ? `The service returned no ${what.toLowerCase()} for the selected resource.` : `${what} come from an authorized service session. Atlas shows nothing it has not received.`}
    </EmptyState>
  );
}
