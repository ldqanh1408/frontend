import { useState } from 'react';
import type { ThoughtEntry } from './useRunStream';
import { Badge } from '../../components/ui';
import { statePresentation } from '../../data/states';
export function ThoughtList({ entries }: { entries: ThoughtEntry[] }) {
  const [top,setTop]=useState(0); const start=Math.max(0,Math.floor(top/52)-3);const visible=entries.slice(start,start+14);
  return <div className="thought-window" role="region" aria-label="Structured thought states" tabIndex={0} onScroll={e=>setTop(e.currentTarget.scrollTop)}><div role="list" aria-label="Task, tool and checkpoint state updates" style={{height:entries.length*52,position:'relative'}}>{visible.map((e,i)=><div role="listitem" aria-setsize={entries.length} aria-posinset={start+i+1} key={e.id} className="thought-row" style={{position:'absolute',top:(start+i)*52,height:52,left:0,right:0}}><span className="mono break">{e.id}</span><span>{e.kind.replaceAll('_',' ')}</span><Badge>{statePresentation(e.state).label}</Badge><span className="caption break">{e.parentId?`Parent: ${e.parentId}`:'Task root'}{e.tool?` · ${e.tool}`:''}</span></div>)}</div></div>;
}
