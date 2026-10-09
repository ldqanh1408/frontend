import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useApp, app } from '../../data/app-store';
import { loadCollection, type ServiceRecord } from '../../data/service';
import { openStream } from '../../data/stream';
import { Badge, Banner, Button, EmptyState, Panel } from '../../components/ui';
export default function NotificationInbox() {
  const session=useApp(s=>s.session);const [items,setItems]=useState<ServiceRecord[]>([]);const [error,setError]=useState<string|null>(null);const [filter,setFilter]=useState('all');
  useEffect(()=>{
    setItems([]);setError(null);if(!session)return;let active=true;
    void loadCollection('notifications').then(c=>{if(active)setItems(c.items);}).catch(e=>{if(active)setError(e.message);});
    const socket=openStream('notifications',session.scope.label,f=>{const r=f.payload as ServiceRecord;if(f.type!=='notification'||!r||typeof r.id!=='string'||typeof r.name!=='string'||r.scope!==session.scope.label||!Number.isSafeInteger(r.revision))throw new Error('Invalid notification identity or scope.');if(active&&app.get().session===session)setItems(items=>[r,...items.filter(x=>x.id!==r.id)].slice(0,300));},()=>{});
    return()=>{active=false;socket.close();};
  },[session]);
  const visible=items.filter(r=>filter!=='unread'||r.status==='Unread');
  return <Panel title="Your inbox"><div className="panel-pad stack-12"><p className="caption">Reading a notification does not resolve the business action behind it.</p><div className="row"><Button aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>All notifications</Button><Button aria-pressed={filter==='unread'} onClick={()=>setFilter('unread')}>Unread</Button><Button blocked="The service must offer a scoped acknowledgement action. Reading does not grant approval authority.">Mark all read</Button></div>{error&&<Banner tone="warning" title="Notifications unavailable">{error}</Banner>}<div className="table-wrap"><table className="table"><caption className="sr-only">Actionable notifications</caption><thead><tr>{['Action','Resource','Owner','Progress','Next step'].map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{visible.length?visible.map(r=>{const path=typeof r.fields?.route==='string'&&/^\/(specifications|execution|governance|memory|workflow|gateway|collaboration)(\/|$)/.test(r.fields.route)&&!r.fields.route.includes('://')?r.fields.route:null;return <tr key={r.id}><th scope="row">{r.name}</th><td className="break">{String(r.fields?.resource??'Not observed')}</td><td>{String(r.fields?.owner??'Not observed')}</td><td><Badge>{r.status}</Badge></td><td>{path?<Link to={path}>Review current revision</Link>:'Not observed'}</td></tr>;}):<tr><td colSpan={5}><EmptyState title={filter==='unread'?'No unread notifications received':'No authorized notifications received'} headingLevel={3}>Connect the current workspace service to load your inbox.</EmptyState></td></tr>}</tbody></table></div><p className="caption">Links recheck current scope, grants and resource revision before any business action.</p></div></Panel>;
}
