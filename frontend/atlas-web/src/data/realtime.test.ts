import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app, type ServiceSession } from './app-store';
import { openStream, streamUrl, validateFrame } from './stream';
import { TerminalBatch } from './terminal-batch';
import { parseThought } from '../views/live/useRunStream';
import { resolveConfiguration, driftBand, riskBand } from './configuration';
const session = ():ServiceSession=>({serviceUrl:'https://api.atlas.test',audience:'workspace',actor:{id:'actor',name:'Actor'},scope:{org:'org',workspace:'workspace',project:'project',label:'org/workspace/project'},grants:['sandbox:view'],expiresAt:null,collections:{},logoutHref:null,capabilityVersion:'atlas-ui/v1',streams:{terminal:{href:'wss://api.atlas.test/ws/terminal',grant:'sandbox:view',protocol:'atlas-stream/v1'}}});
const frame=(scope='org/workspace/project',seq=1)=>JSON.stringify({protocol:'atlas-stream/v1',scope,resourceId:'run',seq,type:'terminal',payload:{text:'output'}});
class Socket {
  static OPEN=1;static instances:Socket[]=[];readyState=1;bufferedAmount=0;onopen:(()=>void)|null=null;onmessage:((e:{data:unknown})=>void)|null=null;onclose:(()=>void)|null=null;onerror:(()=>void)|null=null;sent:string[]=[];closed=false;
  constructor(public url:string,public protocol:string){Socket.instances.push(this);}
  send(s:string){this.sent.push(s);}close(){this.closed=true;this.readyState=3;}
}
beforeEach(()=>{vi.useFakeTimers();Socket.instances=[];vi.stubGlobal('WebSocket',Socket);app.set({session:session(),connection:'connected',toasts:[]});});
afterEach(()=>{app.set({session:null,connection:'disconnected'});vi.useRealTimers();vi.unstubAllGlobals();});
describe('bounded scoped live transport',()=>{
 it('never subscribes before a resource is selected',()=>{const status=vi.fn();openStream('terminal','',vi.fn(),status);expect(Socket.instances).toHaveLength(0);expect(status.mock.calls[0][0].reason).toContain('Select a scoped resource');});
 it('rejects foreign origins and URL credentials or tokens',()=>{
   for(const url of ['wss://foreign.test/ws','wss://api.atlas.test/ws?token=secret','wss://user:password@api.atlas.test/ws','ws://api.atlas.test/ws'])expect(()=>streamUrl(url,session())).toThrow();
   expect(streamUrl('/ws/terminal',session())).toBe('wss://api.atlas.test/ws/terminal');
 });
 it('rejects out-of-scope, duplicate, skipped and oversized frames',()=>{
   expect(validateFrame(frame(),session(),'run',null).seq).toBe(1);
   for(const f of [frame('foreign'),frame(undefined,2),frame(undefined,4),'{bad',JSON.stringify({data:'x'.repeat(65536)})])expect(()=>validateFrame(f,session(),'run',2)).toThrow();
 });
 it('subscribes, acknowledges bytes and closes on a changed identity without command writes',()=>{
   const receive=vi.fn(),status=vi.fn();const client=openStream('terminal','run',receive,status);const ws=Socket.instances[0];ws.onopen!();ws.onmessage!({data:frame()});client.consumed(8);
   expect(receive).toHaveBeenCalledOnce();expect(ws.sent.map(x=>JSON.parse(x).type)).toEqual(['subscribe','consumed']);
   app.set({session:{...session(),scope:{...session().scope,label:'new-scope'}}});expect(ws.closed).toBe(true);ws.onmessage!({data:frame(undefined,2)});expect(receive).toHaveBeenCalledOnce();client.close();
 });
 it('ends a socket when authorization expires, and never opens without the grant',async()=>{
   app.set({session:{...session(),expiresAt:new Date(Date.now()+500).toISOString()}});const receive=vi.fn();openStream('terminal','run',receive,vi.fn());await vi.advanceTimersByTimeAsync(501);expect(Socket.instances[0].closed).toBe(true);
   app.set({session:{...session(),grants:[]}});openStream('terminal','run',receive,vi.fn());expect(Socket.instances).toHaveLength(1);
 });
 it('fails closed on a sequence gap and never processes another frame',()=>{
   const receive=vi.fn(),status=vi.fn();openStream('terminal','run',receive,status);const ws=Socket.instances[0];ws.onmessage!({data:frame()});ws.onmessage!({data:frame(undefined,3)});ws.onmessage!({data:frame(undefined,2)});expect(receive).toHaveBeenCalledOnce();expect(ws.closed).toBe(true);expect(status.mock.calls.at(-1)![0].state).toBe('error');
 });
});
describe('terminal pacing and memory bounds',()=>{
 it('writes at 100 ms, at most 32 KiB per batch, waits for consumption and disposes pending data',async()=>{
   let done:(()=>void)|undefined;const write=vi.fn((_data:Uint8Array,cb:()=>void)=>{done=cb;});const consumed=vi.fn();const batch=new TerminalBatch(write,consumed,vi.fn());batch.push(new Uint8Array(40_000));await vi.advanceTimersByTimeAsync(49);expect(write).not.toHaveBeenCalled();await vi.advanceTimersByTimeAsync(1);expect(write.mock.calls[0][0].length).toBe(32768);await vi.advanceTimersByTimeAsync(200);expect(write).toHaveBeenCalledOnce();done!();expect(consumed).toHaveBeenCalledWith(32768);await vi.advanceTimersByTimeAsync(100);expect(write).toHaveBeenCalledTimes(2);batch.dispose();done!();await vi.advanceTimersByTimeAsync(500);expect(write).toHaveBeenCalledTimes(2);
 });
 it('stops producer growth at 256 KiB and drops queued buffers',async()=>{const fail=vi.fn(),write=vi.fn();const batch=new TerminalBatch(write,vi.fn(),fail);batch.push(new Uint8Array(256*1024));batch.push(new Uint8Array(1));await vi.advanceTimersByTimeAsync(500);expect(fail).toHaveBeenCalledOnce();expect(write).not.toHaveBeenCalled();});
});
describe('structured thought and dynamic thresholds',()=>{
 it('requires an existing parent and excludes raw reasoning fields',()=>{
   const root=parseThought({id:'root',parentId:null,kind:'TASK',state:'Running',reasoning:'private'},[]);expect(root).not.toHaveProperty('reasoning');
   expect(()=>parseThought({id:'child',parentId:'missing',kind:'TOOL',state:'Running'},[root])).toThrow();
   expect(parseThought({id:'child',parentId:'root',kind:'TOOL',state:'Completed'},[root]).parentId).toBe('root');
 });
 it('resolves a zero override and distinguishes each SRS threshold boundary',()=>{
   const snapshot={scope:'scope',revision:7,layers:{System:{limit:100},Org:{limit:80},Workspace:{limit:40},Project:{limit:0}}};expect(resolveConfiguration(snapshot,'limit')).toEqual({value:0,layer:'Project',revision:7});expect(resolveConfiguration(snapshot,'missing')).toBeNull();
   expect([0.3,0.5,0.7,0.71].map(v=>driftBand(v,0.3,0.7))).toEqual(['In-Sync','Warning','Warning','Drift-Blocked']);expect([0.29,0.3,0.69,0.7].map(v=>riskBand(v,0.3,0.7,false))).toEqual(['Low','Medium','Medium','Multi-Sig']);expect(riskBand(0,0.3,0.7,true)).toBe('Multi-Sig');
 });
 it('inherits null and absent overrides while retaining explicit false and zero (SRS 12.2)',()=>{
   const snapshot={scope:'scope',revision:8,layers:{System:{limit:100,enabled:true},Org:{limit:80},Workspace:{limit:40},Project:{limit:null,enabled:false}}};
   expect(resolveConfiguration(snapshot,'limit')).toEqual({value:40,layer:'Workspace',revision:8});
   expect(resolveConfiguration(snapshot,'enabled')).toEqual({value:false,layer:'Project',revision:8});
 });
});
