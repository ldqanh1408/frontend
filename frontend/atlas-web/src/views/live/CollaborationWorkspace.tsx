import { useConfiguration, numericConfiguration } from '../../data/configuration';
import { useEffect, useMemo, useState } from 'react';
import { LazyCodeEditor } from '../../components/LazyCodeEditor';
import { Badge, Button, EmptyState, Panel } from '../../components/ui';
import { capability, useApp } from '../../data/app-store';
import { openStream } from '../../data/stream';
import type { ServiceRecord } from '../../data/service';
export default function CollaborationWorkspace({ record }: { record: ServiceRecord | null }) {
  const {snapshot}=useConfiguration(); const timeout = numericConfiguration(snapshot,'presence_timeout_seconds');
  const session=useApp(s=>s.session); const [presence,setPresence]=useState<{id:string;name:string;file:string;status:string;heartbeat:number}[]>([]); const [reason,setReason]=useState('Not observed — no authorized presence endpoint.');
  const docId=typeof record?.fields?.document_id==='string'?record.fields.document_id:null; const branchId=typeof record?.fields?.branch_id==='string'?record.fields.branch_id:null;
  const target=useMemo(()=>docId&&branchId?{documentId:docId,branchId}:undefined,[docId,branchId]);
  const gate=capability('collab:edit_realtime');
  useEffect(()=>{
    setPresence([]);setReason('Not observed — no authorized presence endpoint.');if(!record||!session)return;
    const socket=openStream('presence',record.id,f=>{
      if(f.type!=='presence'||!Array.isArray(f.payload)||f.payload.length>200)throw new Error('Presence frame is invalid.');
      const p=f.payload.map(raw=>{const x=raw as {id:string;name:string;file:string;status:string;heartbeat:string};if(!x||typeof x.id!=='string'||typeof x.name!=='string'||typeof x.file!=='string'||!['Online','Idle','Offline'].includes(x.status)||!Number.isFinite(Date.parse(x.heartbeat)))throw new Error('Presence identity or heartbeat is invalid.');return {...x,heartbeat:Date.parse(x.heartbeat)};});setPresence(p);
    },s=>setReason(s.reason));
    const interval=setInterval(()=>setPresence(p=>p.map(x=>timeout && Date.now()-x.heartbeat>timeout.value*1000?{...x,status:'Offline'}:x)),1000);
    return()=>{socket.close();clearInterval(interval);};
  },[record,session,timeout?.value]);
  return <Panel title="Collaborative document & live presence"><div className="panel-pad stack-16"><div className="row"><Badge>{target?'Scoped document':'Not observed'}</Badge><p className="caption" role="status">{reason}</p></div>{presence.length?<ul aria-label="Workspace presence" className="list">{presence.map(p=><li key={p.id} className="row"><strong>{p.name}</strong><Badge>{p.status}</Badge><span className="caption break">{p.file}</span></li>)}</ul>:<p className="caption">No peer presence received.</p>}{target?<LazyCodeEditor value={typeof record?.fields?.content==='string'?record.fields.content:''} language="markdown" label="Collaborative specification" resetKey={`${docId}:${branchId}`} readOnly={!gate.ok} collaboration={target}/>:<EmptyState title="No shared document selected" icon="edit">The service must supply the document identity, branch and an authorized Yjs endpoint.</EmptyState>}<Button blocked={gate.ok?'The service must offer a current document action.':gate.reason}>Join room</Button><p className="caption">Sync acknowledgement is separate from a persisted snapshot or freeze receipt.</p></div></Panel>;
}
