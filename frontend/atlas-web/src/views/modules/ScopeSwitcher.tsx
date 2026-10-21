import { useEffect, useState } from 'react';
import { app, useApp } from '../../data/app-store';
import { actionGate, loadCollection, sendCommand, connect, disconnect, type ServiceRecord } from '../../data/service';
import { Banner, Button, KeyValue } from '../../components/ui';
import { Dialog } from '../../components/overlays';
/** Scope options are service records with an offered switch command, never a role-derived list. */
export function ScopeSwitcher() {
  const session=useApp(s=>s.session);const [open,setOpen]=useState(false);const [options,setOptions]=useState<ServiceRecord[]>([]);const [selection,setSelection]=useState('');const [error,setError]=useState<string|null>(null);const [busy,setBusy]=useState(false);
  useEffect(()=>{setOptions([]);setSelection('');setOpen(false);setError(null);},[session]);
  useEffect(()=>{if(!open||!session)return;let active=true;void loadCollection('tenancy').then(c=>{if(active)setOptions(c.items.filter(r=>typeof r.fields?.target_scope==='string' && r.actions?.some(a=>a.label==='Switch scope')));}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[open,session]);
  const choice=options.find(r=>r.id===selection)??null;const action=choice?.actions?.find(a=>a.label==='Switch scope');
  const switchScope=async()=>{
    if(!session||!choice||!action||busy)return;setBusy(true);setError(null);
    try { const result=await sendCommand('tenancy',choice,action,{targetScope:choice.fields!.target_scope});if(result.stage!=='Effective'){setError(`${result.stage}: ${result.message}`);return;}await connect(session.serviceUrl,'workspace');if(app.get().session?.scope.label!==choice.fields!.target_scope){disconnect();throw new Error('The new session did not match the selected scope. Reconnect before viewing records.');}setOpen(false); }
    catch(e){setError(e instanceof Error?e.message:'Scope change failed.');}finally{setBusy(false);}
  };
  return <><Button compact onClick={()=>setOpen(true)} blocked={session?undefined:'Connect a workspace service to load authorized organization and project choices.'}>Switch organization</Button><Dialog open={open} onOpenChange={setOpen} title="Switch organization and project" description="The service checks membership. Current scoped data and live connections are cleared when the new session is established." footer={<><Button onClick={()=>setOpen(false)} disabled={busy}>Cancel</Button><Button variant="primary" onClick={()=>void switchScope()} disabled={busy} blocked={actionGate(choice,action)??undefined}>{busy?'Switching…':'Switch scope'}</Button></>}><div className="stack-16"><KeyValue items={[['Current scope',session?.scope.label??'Not observed']]} /><div className="field"><label className="field-label" htmlFor="scope-option">Authorized scope</label><select id="scope-option" className="select" value={selection} onChange={e=>setSelection(e.target.value)}><option value="">Select an organization / workspace / project</option>{options.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></div>{!options.length&&<p className="caption">No authorized scope choices received.</p>}{error&&<Banner tone="danger" title="Scope change not verified" role="alert">{error}</Banner>}</div></Dialog></>;
}
