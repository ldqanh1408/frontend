import { useState } from 'react';
import { nav } from '../../data/catalog';
import { connect, disconnect, validateServiceUrl, type Audience } from '../../data/service';
import { toast, useApp } from '../../data/app-store';
import { getAll, type DefinitionRecord, type DocumentRecord, type RevisionRecord } from '../../lib/storage';
import { downloadJson } from '../../lib/definitions';
import { isoUtc } from '../../lib/format';
import { Badge, Banner, Button, EmptyState, KeyValue, PageHeader, Panel } from '../../components/ui';
import { ProvenanceBanner } from '../shared';
import { usePageMeta } from '../../shell/page-meta';
import { ModuleViews, OperationReceipts } from './common';

export async function exportDeviceDrafts() {
  const [definitions, revisions, documents] = await Promise.all([getAll<DefinitionRecord>('definitions'), getAll<RevisionRecord>('revisions'), getAll<DocumentRecord>('documents')]);
  downloadJson(`atlas-device-drafts-${new Date().toISOString().slice(0, 10)}.json`, {
    format: 'atlas-device-export/v1', authority: 'DEVICE_ONLY', exportedAt: new Date().toISOString(), definitions, revisions, documents,
  });
  toast({ tone: 'success', title: 'Device drafts exported', body: `${definitions.length} definitions · ${documents.length} documents. The file contains no credentials.` });
}

/** Connection & operation receipts (Figma connection frame): connect a service session and reconcile uncertain effects. */
export default function ConnectionPage() {
  const m = nav.modules.connection;
  usePageMeta(m.title, [{ label: m.label }]);
  const connection = useApp((s) => s.connection);
  const session = useApp((s) => s.session);
  const endReason = useApp((s) => s.endReason);
  const saved = useApp((s) => s.serviceUrl);
  const [url, setUrl] = useState(saved);
  const [audience, setAudience] = useState<Audience>('workspace');
  const [err, setErr] = useState<string | null>(null);
  const busy = connection === 'connecting';
  const onConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validateServiceUrl(url);
    if (v) { setErr(v); document.getElementById('service-endpoint')?.focus(); return; }
    setErr(null);
    try {
      await connect(url, audience);
      toast({ tone: 'success', title: 'Service connected', body: 'Authorized records and capabilities now come from the service.', kind: 'session' });
    } catch (x) { setErr(x instanceof Error ? x.message : String(x)); }
  };
  const status = connection === 'connected' ? 'Connected' : connection === 'connecting' ? 'Connecting' : connection === 'ended' ? 'Session ended' : 'Disconnected';
  return (
    <div className="page">
      <PageHeader title={m.title} purpose={m.purpose} actions={<Button icon="download" onClick={exportDeviceDrafts}>Export device drafts</Button>} />
      <ProvenanceBanner detail="The service adapter contract (atlas-ui/v1) is proposed; verify availability against your actual backend." />
      {connection === 'ended' && endReason && <Banner tone="warning" title="Service session ended" role="status">{endReason} Reconnect to load authorized records. Device drafts are unchanged.</Banner>}
      {connection === 'disconnected' && endReason && <Banner tone="info" title="Not connected" role="status">{endReason}</Banner>}
      <div className="split">
        <Panel title="Service connection">
          <div className="panel-pad" style={{ paddingBottom: 0 }}><Badge tone={connection === 'connected' ? 'success' : 'warning'}>{status}</Badge></div>
          {connection === 'connected' && session ? (
            <div className="panel-pad stack-12">
              <KeyValue items={[
                ['Service', <span key="u" className="mono break">{session.serviceUrl}</span>], ['Audience', session.audience === 'observer' ? 'Observer' : 'Workspace'],
                ['Signed in as', <span key="a" className="break">{session.actor.name}</span>], ['Scope', <span key="s" className="break">{session.scope.label}</span>],
                ['Grants', `${session.grants.length}`], ['Expires', session.expiresAt ? isoUtc(session.expiresAt) : 'Not stated'], ['Protocol', session.capabilityVersion],
              ]} />
              <div className="row"><Button icon="unplug" onClick={disconnect}>Disconnect</Button></div>
            </div>
          ) : (
            <form className="panel-pad stack-12" onSubmit={onConnect} noValidate>
              <div className="field">
                <label className="field-label" htmlFor="service-audience">Audience</label>
                <select id="service-audience" className="select" value={audience} onChange={(e) => setAudience(e.target.value as Audience)} aria-describedby="service-audience-hint">
                  <option value="workspace">Workspace</option><option value="observer">Observer</option>
                </select>
                <small id="service-audience-hint" className="field-hint">Observer uses a separate session.</small>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="service-endpoint">Service URL<span className="req" aria-hidden="true"> *</span></label>
                <input id="service-endpoint" className="input" type="url" inputMode="url" autoComplete="url" spellCheck={false} required value={url}
                  onChange={(e) => setUrl(e.target.value)} aria-invalid={err ? true : undefined} aria-describedby="service-endpoint-hint" placeholder="https://atlas.example.com" />
                <small id="service-endpoint-hint" className={err ? 'field-error' : 'field-hint'} role={err ? 'alert' : undefined}>{err ?? 'No credentials in the URL.'}</small>
              </div>
              <p className="secondary">The service must expose compatible capabilities and an audience-bound session. No admin role is created by this frontend.</p>
              <div className="row"><Button type="submit" variant="primary" disabled={busy}>{busy ? 'Connecting…' : 'Connect'}</Button></div>
            </form>
          )}
        </Panel>
        <Panel title="Session & operation receipts">
          {connection !== 'connected' && (
            <EmptyState icon="link" headingLevel={3} title="No authenticated session">
              Device drafts have no tenant authority. Existing operations can be reconciled only in their original scope.
            </EmptyState>
          )}
          <dl className="panel-pad outcome-defs">
            <div><dt className="outcome-info">Received / Accepted</dt><dd className="caption">Acknowledgement only. The effect is not yet verified.</dd></div>
            <div><dt className="outcome-accent">Effective</dt><dd className="caption">Requires a matched operation, scope, input fingerprint and effect readback.</dd></div>
            <div><dt className="outcome-warning">Unknown</dt><dd className="caption">Preserve the original operation ID and reconcile before retrying.</dd></div>
          </dl>
        </Panel>
      </div>
      <OperationReceipts />
      <ModuleViews module="connection" />
    </div>
  );
}
