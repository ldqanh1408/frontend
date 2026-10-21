import { useEffect, useState } from 'react';
import { useApp } from '../../data/app-store';
import { openStream } from '../../data/stream';
import { readExecutionNodes, type ExecutionNode } from '../execution/model';
import type { ServiceRecord } from '../../data/service';
import { DOMAIN_STATES } from '../../data/states';
export interface ThoughtEntry { id: string; parentId: string | null; kind: 'TASK' | 'TOOL' | 'CHECKPOINT' | 'ARTIFACT'; state: string; tool?: string }
export function parseThought(raw: unknown, existing: ThoughtEntry[]): ThoughtEntry {
  const p = raw as ThoughtEntry;
  if (!p || typeof p.id !== 'string' || p.id.length > 200 || !['TASK','TOOL','CHECKPOINT','ARTIFACT'].includes(p.kind) || typeof p.state !== 'string' || !(DOMAIN_STATES.SubTask as readonly string[]).includes(p.state) || (p.parentId !== null && (typeof p.parentId !== 'string' || p.parentId === p.id || !existing.some(e=>e.id===p.parentId)))) throw new Error('Structured thought identity, parent or state is invalid.');
  // Drop unknown payload fields, especially free-form reasoning or raw chain-of-thought.
  return { id:p.id,parentId:p.parentId,kind:p.kind,state:p.state,...(typeof p.tool==='string'&&p.tool.length<200?{tool:p.tool}:{}) };
}
export function useRunStream(record: ServiceRecord | null | undefined) {
  const session=useApp(s=>s.session);
  const [nodes,setNodes]=useState<ExecutionNode[]|null>(null); const [thoughts,setThoughts]=useState<ThoughtEntry[]>([]); const [revision,setRevision]=useState<number|null>(null); const [reason,setReason]=useState('Not observed — no authorized live endpoint.');
  useEffect(()=>{
    setNodes(null);setThoughts([]);setRevision(null);setReason('Not observed — no authorized live endpoint.');
    if(!record||!session)return;
    let entries:ThoughtEntry[]=[];
    const dag=openStream('dag',record.id,f=>{
      const p=f.payload as {tasks?:unknown;revision?:unknown};
      if(f.type!=='dag'||!p||!Number.isSafeInteger(p.revision)||(p.revision as number)<record.revision)throw new Error('Live DAG revision is invalid.');
      const graph=readExecutionNodes(p.tasks);if(graph.error)throw new Error(graph.error);
      setNodes(graph.nodes);setRevision(p.revision as number);
    },s=>setReason(s.reason));
    const thought=openStream('thought',record.id,f=>{
      if(f.type!=='thought')throw new Error('Unsupported thought frame.');
      const next=parseThought(f.payload,entries);const i=entries.findIndex(t=>t.id===next.id);
      if(i>=0){ if(entries[i].parentId!==next.parentId)throw new Error('Thought parent identity changed.'); entries=entries.map((t,index)=>index===i?next:t); }
      else { if(entries.length>=10_000)throw new Error('Thought window limit reached. Reload the server snapshot.');entries=[...entries,next]; }
      setThoughts(entries);
    },()=>{});
    return()=>{dag.close();thought.close();};
  },[record,session]);
  return {nodes,thoughts,revision,reason};
}
