import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import states from '../generated/native-states.json';
import { capability, useApp } from '../data/app-store';
import { actionPermission } from '../data/permissions';
import { Badge, Banner, Button, ButtonLink, PageHeader, Panel, Stages } from '../components/ui';
import { NativeStatePanels } from '../components/NativeStatePanels';
import { loadCollection, actionGate, type ServiceRecord, type ServiceAction } from '../data/service';
import { CommandDialog } from './modules/ServiceModulePage';
import { usePageMeta } from '../shell/page-meta';
import { NotFound } from './shared';

/** The 18 Current state frames are distinct screens. Illustrative values never become authoritative data. */
export default function NativeStatePage() {
  const { stateKey } = useParams(); const definition = states.find(s=>s.key===stateKey);
  const session = useApp(s=>s.session); const [records,setRecords]=useState<ServiceRecord[]>([]); const [selected,setSelected]=useState<string>(''); const [pending,setPending]=useState<ServiceAction|null>(null); const [error,setError]=useState<string|null>(null);
  usePageMeta(definition?.title || 'State not found', definition ? [{label:'State detail'},{label:definition.key}] : []);
  useEffect(()=>{setRecords([]);setSelected('');setPending(null);setError(null);if(!session||!definition||definition.module==='observer')return;let active=true;void loadCollection(definition.module).then(col=>{if(active)setRecords(col.items);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[session,definition]);
  useEffect(()=>{if(definition?.module==='observer') window.location.replace(import.meta.env.VITE_OBSERVER_URL ? `${import.meta.env.VITE_OBSERVER_URL.replace(/\/+$/,'')}/states/OB-Stale` : '/observer/states/OB-Stale');},[definition]);
  if(!definition)return <NotFound/>;
  if(definition.module==='observer')return <div className="page"><ButtonLink to="/observer/states/OB-Stale">Open independent Observer state</ButtonLink></div>;
  const record=records.find(r=>r.id===selected)??null;
  const value=(label:string,example:string)=> {
    const key=label.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/_$/,'');
    const observed=record?.fields?.[key];
    return observed!=null ? (typeof observed==='string'?observed:JSON.stringify(observed)) : __ATLAS_REVIEW__ && !record ? example : 'Not observed';
  };
  return <div className="page native-state" data-native-state={definition.key}><PageHeader title={definition.title} purpose={definition.purpose} /><Banner tone={__ATLAS_REVIEW__?'warning':'info'} title={__ATLAS_REVIEW__&&!record?'Illustrative':'Service evidence'}>{__ATLAS_REVIEW__&&!record?'Design example · no live service, provider, run, CI, delivery or cleanup evidence.':'Values require an authorized scoped response; no result has been inferred.'}</Banner>{error&&<Banner tone="danger" title="State evidence unavailable" role="alert">{error}</Banner>}{records.length>0&&<div className="field"><label className="field-label" htmlFor="state-resource">Resource</label><select id="state-resource" className="select" value={selected} onChange={e=>{setPending(null);setSelected(e.target.value);}}><option value="">Select a resource</option>{records.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></div>}
    <NativeStatePanels definition={definition} value={value} scopeExtra={record&&<Badge>{record.status}</Badge>} progress={['EX-TaskAttempt','CMD-Unknown'].includes(definition.key)&&<Panel title={definition.key==='CMD-Unknown'?'Command progress':'Attempt progress'}><div className="panel-pad"><Stages stage={__ATLAS_REVIEW__&&definition.key==='CMD-Unknown'?'Unknown':'Not observed'}/><p className="caption">Acknowledgement is distinct from effective state. Inspect the original operation before repeating a command.</p></div></Panel>} actions={<><div className="row">{definition.actions.map(label=>{const action=record?.actions?.find(a=>a.label.toLowerCase()===label.toLowerCase());const permission=actionPermission(label);const grant=permission?capability(permission,label):null;const blocked=grant&&!grant.ok?grant.reason:actionGate(record,action);return <Button key={label} variant={/reject|cancel|revoke|discard/i.test(label)?'danger':'secondary'} blocked={blocked??undefined} reasonId={!session?'state-action-reason':undefined} onClick={()=>action&&setPending(action)}>{label}</Button>;})}</div>{!session&&<p id="state-action-reason" className="caption">An authenticated session, current scope, granted permission and an offered action at the exact revision are required.</p>}</>} back={<ButtonLink to={`/${definition.module}`}>Back to workspace</ButtonLink>} />{pending&&record&&<CommandDialog module={definition.module} record={record} action={pending} onClose={()=>setPending(null)} onDone={()=>{}}/>}<p className="caption">Actual effects require service receipts and matching readback.</p></div>;
}
