import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import states from '../generated/native-states.json';
import { NativeStatePanels } from '../components/NativeStatePanels';
import { Banner, Button, PageHeader } from '../components/ui';
import { useObserver } from './store';
import { observerRecords, type TelemetryRecord } from './service';

const definition = states.find(s => s.key === 'OB-Stale')!;
export default function NativeState() {
  const session = useObserver(s => s.session);
  const [records, setRecords] = useState<TelemetryRecord[]>([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    document.title = `${definition.title} · Atlas`;
    setRecords([]); setSelected(''); setError(null);
    if (!session) return;
    let active = true;
    void observerRecords('observer').then(r => { if (active) setRecords(r); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [session, refresh]);
  const record = records.find(r => r.id === selected);
  const value = (label: string, example: string) => {
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_$/, '');
    const observed = record?.fields?.[key];
    return observed == null ? __ATLAS_REVIEW__ && !record ? example : 'Not observed' : typeof observed === 'string' ? observed : JSON.stringify(observed);
  };
  const reason = session ? 'Observer sessions are read-only. A separate operational service and grant are required for effects.' : 'Connect an independent Observer session; workspace authority cannot enable these controls.';
  return <div className="page native-state" data-native-state={definition.key}>
    <PageHeader title={definition.title} purpose={definition.purpose} />
    <Banner tone={__ATLAS_REVIEW__ && !record ? 'warning' : 'info'} title={__ATLAS_REVIEW__ && !record ? 'Illustrative' : 'Service evidence'}>
      {__ATLAS_REVIEW__ && !record ? 'Design example · no live telemetry or recovery evidence.' : 'Only independent scoped telemetry is displayed.'}
    </Banner>
    {error && <Banner tone="danger" title="State evidence unavailable" role="alert">{error}</Banner>}
    {records.length > 0 && <div className="field"><label htmlFor="observer-state-resource" className="field-label">Resource</label><select className="select" id="observer-state-resource" value={selected} onChange={e => setSelected(e.target.value)}><option value="">Select a resource</option>{records.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>}
    <NativeStatePanels definition={definition} value={value} actions={<>
      <div className="row">{definition.actions.map(label => label === 'Connect observer' ? <Link key={label} className="btn" to="/observer/sign-in">{label}</Link> : label === 'Refresh snapshot' ? <Button key={label} onClick={() => setRefresh(n => n + 1)} blocked={session ? undefined : reason} reasonId="observer-state-reason">{label}</Button> : <Button key={label} blocked={reason} reasonId="observer-state-reason">{label}</Button>)}</div>
      <p id="observer-state-reason" className="caption">{reason}</p>
    </>} back={<Link className="btn" to="/observer">Back to Observer</Link>} />
  </div>;
}
