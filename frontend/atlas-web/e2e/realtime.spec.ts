import { test, expect, type BrowserContext, type Page, type WebSocketRoute } from '@playwright/test';
import * as Y from 'yjs';
import * as sync from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { axe } from './helpers';

// Test-only protocol peers. They exercise the bundled production clients, not built-in success handlers.
const B = 'https://svc.atlas.test', S = 'org:fixture/ws:engineering/prj:app';
const now = () => new Date().toISOString();
const record = (id: string, name: string, fields: object = {}) => ({ id, name, fields, scope: S, revision: 4, observedAt: now(), status: 'Running' });
async function service(context: BrowserContext, extra: object = {}, grants = ['agent:control','collab:edit_realtime','obs:view_advanced']) {
  const requests: string[] = [];
  await context.route(`${B}/**`, async route => {
    const u = new URL(route.request().url()); requests.push(u.pathname + u.search);
    const audience = u.searchParams.get('audience');
    const headers = { 'access-control-allow-origin': route.request().headers().origin || '*', 'access-control-allow-credentials': 'true' };
    const json = (data: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(data) });
    if (u.pathname === '/v1/capabilities') return json({ protocol:'atlas-ui/v1',audience,scope:S,serviceSessionHref:`${B}/session/${audience}`,modules:Object.fromEntries(['tenancy','execution','collaboration','notifications','configuration','gateway','governance','observer','metrics','traces','logs','profiles'].map(k=>[k,{collectionHref:`${B}/records/${k}`} ])),configurationHref:`${B}/config`,...extra });
    if (u.pathname.startsWith('/session/')) return json({ audience:u.pathname.split('/').at(-1),subject:'fixture-reader',scope:S,scopeContext:{org:'Fixture org',workspace:'Engineering',project:'App'},grants,expiresAt:new Date(Date.now()+3600e3).toISOString(),csrfToken:'test-only-csrf' });
    if (u.pathname === '/config') return json({ scope:S,revision:8,layers:{Project:{risk_high_threshold:0.6,budget_warning_threshold:0.75},Workspace:{presence_timeout_seconds:0.2},System:{risk_low_threshold:0.3,risk_high_threshold:0.7,budget_warning_threshold:0.8,budget_block_threshold:1}} });
    const kind = u.pathname.split('/').at(-1);
    const items = kind === 'execution' ? [record('run', 'Verified stream run')]
      : kind === 'collaboration' ? [record('doc','Shared document',{document_id:'immutable-doc',branch_id:'branch-a',content:'server truth\n'})]
      : kind === 'notifications' ? [record('notice','Review required',{resource:'Specification',owner:'Engineering',route:'/specifications'})]
      : kind === 'governance' ? [record('gate','Gate risk',{composite_risk_score:0.65,hard_veto_triggered:false})]
      : kind === 'gateway' ? [record('budget','Budget envelope',{key_budget:{used:75,limit:100},project_budget:{used:100,limit:100},subtask_budget:{used:10,limit:100}})]
      : kind === 'observer' || kind === 'metrics' ? [record('measurement','Scoped measurement',{source:'test protocol peer'})] : [];
    return json({complete:true,observedAt:now(),items});
  });
  return requests;
}
async function connect(page: Page) {
  await page.goto('/connection', {waitUntil:'networkidle'}); if(await page.getByText('fixture-reader',{exact:true}).isVisible()) return; await page.fill('#service-endpoint',B);
  await page.getByRole('button',{name:'Connect',exact:true}).click();
  await expect(page.getByText('fixture-reader',{exact:true})).toBeVisible();
}
const endpoint = (kind: string) => ({href:`wss://svc.atlas.test/stream/${kind}`,protocol:'atlas-stream/v1',grant:'agent:control'});

test('presence arrives through its scoped endpoint and expires from resolved policy', async ({ context, page }) => {
  await service(context, { streams: { presence: { ...endpoint('presence'), grant: 'collab:edit_realtime' } } });
  let socket: WebSocketRoute | undefined;
  await context.routeWebSocket('wss://svc.atlas.test/stream/presence', ws => { ws.onMessage(raw => { if (JSON.parse(String(raw)).type === 'subscribe') socket = ws; }); });
  await connect(page);
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('link', { name: 'Collaboration', exact: true }).click();
  await page.getByRole('button', { name: 'Shared document', exact: true }).click();
  await expect.poll(() => Boolean(socket)).toBe(true);
  const sent = Date.now();
  socket!.send(JSON.stringify({ protocol: 'atlas-stream/v1', scope: S, resourceId: 'doc', seq: 1, type: 'presence', payload: [{ id: 'peer', name: 'Observed peer', file: 'scope/document.md', status: 'Online', heartbeat: now() }] }));
  const peers = page.getByRole('list', { name: 'Workspace presence' });
  await expect(peers).toContainText('Observed peer');
  console.log(`REALTIME ${JSON.stringify({ presenceObservedMs: Date.now() - sent, environment: 'local protocol peer' })}`);
  await expect(peers).toContainText('Offline');
  socket!.send(JSON.stringify({ protocol: 'atlas-stream/v1', scope: 'foreign', resourceId: 'doc', seq: 2, type: 'presence', payload: [{ id: 'foreign', name: 'Foreign peer', file: 'private', status: 'Online', heartbeat: now() }] }));
  await expect(page.locator('body')).not.toContainText('Foreign peer');
  await expect(page.getByText(/Live frame identity, scope or sequence is invalid/).first()).toBeVisible();
});

test('scoped DAG, terminal and structured thoughts reject gaps without replaying commands', async ({ context,page }) => {
  await service(context,{streams:{dag:endpoint('dag'),thought:endpoint('thought'),terminal:endpoint('terminal')}});
  const sockets = new Map<string,WebSocketRoute>(); const acknowledgements: object[] = [];
  await context.routeWebSocket('wss://svc.atlas.test/stream/**', ws => {
    const kind = new URL(ws.url()).pathname.split('/').at(-1)!;
    ws.onMessage(raw => {const m=JSON.parse(String(raw));if(m.type==='subscribe')sockets.set(kind,ws);else acknowledgements.push(m);});
  });
  await connect(page); await page.getByRole('navigation',{name:'Workspace'}).getByRole('link',{name:'Runs & activity'}).click();
  await page.getByRole('button',{name:'Verified stream run'}).click();
  await expect.poll(()=>sockets.has('dag')&&sockets.has('thought')).toBe(true);
  const frame = (type:string,seq:number,payload:unknown,scope=S) => JSON.stringify({protocol:'atlas-stream/v1',scope,resourceId:'run',type,seq,payload});
  const tasks=[{id:'task',name:'Scoped task',type:'AGENT',status:'Running',dependencies:[]}];
  sockets.get('dag')!.send(frame('dag',1,{revision:5,tasks}));
  await expect(page.getByRole('button',{name:/task: Scoped task/})).toBeVisible();
  await expect(page.getByRole('button',{name:'Pause',exact:true})).toHaveAttribute('aria-disabled','true');
  await expect(page.getByText('Live revision changed. Refresh the resource and current action preconditions before acting.').first()).toBeVisible();
  for(let i=0;i<500;i++)sockets.get('thought')!.send(frame('thought',i,{id:`event-${i}`,parentId:i?'event-0':null,kind:i?'TOOL':'TASK',state:'Running',tool:'safe.tool',rawReasoning:'private reasoning must be discarded'}));
  await page.getByRole('tab',{name:'Thought tree',exact:true}).click();
  const thought=page.getByRole('region',{name:'Structured thought states'});
  await expect(thought.getByRole('listitem').first()).toHaveAttribute('aria-setsize','500');
  expect(await thought.getByRole('listitem').count()).toBeLessThanOrEqual(14);
  await expect(page.locator('body')).not.toContainText('private reasoning');
  await thought.focus(); await page.keyboard.press('End');
  await expect.poll(()=>thought.evaluate(e=>e.scrollTop)).toBeGreaterThan(0);
  await page.getByRole('tab',{name:'Terminal',exact:true}).click();
  await expect.poll(()=>sockets.has('terminal')).toBe(true);
  sockets.get('terminal')!.send(frame('terminal',0,{text:'Authenticated output\r\n'}));
  await expect(page.locator('.xterm-accessibility')).toContainText('Authenticated output');
  await expect.poll(()=>acknowledgements.some((m: any)=>m.type==='consumed'&&m.bytes===22)).toBe(true);
  sockets.get('dag')!.send(frame('dag',3,{revision:6,tasks}));
  await expect(page.getByText(/Live sequence changed/).first()).toBeVisible();
  await axe(page,'authorized stream terminal');
});

test('Yjs synchronizes two Monaco editors and closes editing on disconnect', async ({ context,page }) => {
  await service(context,{collaboration:{href:'wss://svc.atlas.test/collab',protocol:'y-websocket',grant:'collab:edit_realtime',roomPrefix:'specs'}});
  const doc=new Y.Doc();doc.getText('content').insert(0,'server truth\n');
  const peers=new Set<WebSocketRoute>(); const rooms:string[]=[];
  doc.on('update',(update,origin)=>{const e=encoding.createEncoder();encoding.writeVarUint(e,0);sync.writeUpdate(e,update);for(const p of peers)if(p!==origin)p.send(Buffer.from(encoding.toUint8Array(e)));});
  await context.routeWebSocket('wss://svc.atlas.test/collab/**',ws=>{
    rooms.push(ws.url());peers.add(ws);
    ws.onClose(()=>peers.delete(ws));
    ws.onMessage(raw=>{if(typeof raw==='string')return;const d=decoding.createDecoder(new Uint8Array(raw));if(decoding.readVarUint(d)!==0)return;const e=encoding.createEncoder();encoding.writeVarUint(e,0);sync.readSyncMessage(d,e,doc,ws);if(encoding.length(e)>1)ws.send(Buffer.from(encoding.toUint8Array(e)));});
    const e=encoding.createEncoder();encoding.writeVarUint(e,0);sync.writeSyncStep1(e,doc);ws.send(Buffer.from(encoding.toUint8Array(e)));
  });
  const other=await context.newPage();
  try {
    for(const p of [page,other]){
      if(p===page)await connect(p);
      else {
        // This tab shares the first tab's restoration preference. Await the actual
        // restored session rather than racing a form that disappears during restore.
        await p.goto('/connection',{waitUntil:'networkidle'});
        await expect(p.getByText('fixture-reader',{exact:true})).toBeVisible();
      }
      await p.getByRole('navigation',{name:'Workspace'}).getByRole('link',{name:'Collaboration',exact:true}).click();await p.getByRole('button',{name:'Shared document',exact:true}).click();await expect(p.getByText(/Synced · shared document/)).toBeVisible();
    }
    expect(new Set(rooms).size).toBe(1);expect(rooms[0]).toContain('branch-a');expect(rooms[0]).toContain('immutable-doc');
    await page.locator('.monaco-editor').click();await page.keyboard.press('Control+End');await page.keyboard.type('peer one');
    const sent = Date.now(); await expect(other.locator('.monaco-editor')).toContainText('peer one'); console.log(`REALTIME ${JSON.stringify({crdtPeerObservedMs:Date.now()-sent,environment:'local protocol peer'})}`);
    await other.locator('.monaco-editor').click();await other.keyboard.press('Control+End');await other.keyboard.type(' peer two');
    await expect(page.locator('.monaco-editor')).toContainText('peer two');
    expect(doc.getText('content').toString()).toBe('server truth\npeer one peer two');
    await page.getByRole('navigation',{name:'Workspace'}).getByRole('link',{name:'Connection & receipts'}).click();
    await page.getByRole('button',{name:'Disconnect',exact:true}).click();
    await expect.poll(()=>peers.size).toBe(1);
    await axe(other,'synced Monaco collaboration');
  } finally {await other.close();doc.destroy();}
});

test('Observer does not restore workspace authority and has independent grants', async ({ context,page }) => {
  const requests=await service(context,{},['*','agent:control','obs:view_advanced']);
  await page.addInitScript(base=>{localStorage.setItem('atlas.serviceUrl',base);localStorage.setItem('atlas.serviceRestore','workspace');},B);
  await page.goto('/observer');await expect(page.getByText('Disconnected',{exact:true})).toBeVisible();
  expect(requests).toEqual([]);
  await page.getByRole('link',{name:'Connect service',exact:true}).click();await page.fill('#observer-service',B);
  await page.getByRole('button',{name:'Connect',exact:true}).click();await expect(page.getByRole('banner').getByText('Connected',{exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Open Observer',exact:true}).click();
  await page.getByRole('button',{name:'Scoped measurement'}).click();
  await expect(page.getByRole('button',{name:'Request recovery',exact:true})).toHaveAttribute('aria-disabled','true');
  await page.getByRole('group',{name:'Telemetry section'}).getByRole('button',{name:'Profiles',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('obs:view_profiler');
  expect(requests.some(r=>r.includes('audience=workspace'))).toBe(false);
  await axe(page,'independent Observer');
});

test('resolved policy overrides drive risk and three budget classifications', async ({context,page})=>{
  await service(context);await connect(page);
  await page.getByRole('navigation',{name:'Workspace'}).getByRole('link',{name:'Reviews & delivery'}).click();await page.getByRole('button',{name:'Gate risk'}).click();
  const risk=page.getByRole('region',{name:'Risk & independent approval'}).or(page.locator('section').filter({has:page.getByRole('heading',{name:'Risk & independent approval',exact:true})}));
  await expect(risk).toContainText('Multi-Sig');await expect(risk).toContainText('0.6 · Project · revision 8');
  await page.getByRole('navigation',{name:'Workspace'}).getByRole('link',{name:'AI access & budget'}).click();await page.getByRole('button',{name:'Budget envelope'}).click();
  const budget=page.locator('section').filter({has:page.getByRole('heading',{name:'Budget layers & resolved limits',exact:true})});
  await expect(budget).toContainText('75 / 100 · Warning');await expect(budget).toContainText('100 / 100 · Blocked_Budget');await expect(budget).toContainText('10 / 100 · Within budget');await expect(budget).toContainText('0.75 · Project · revision 8');
});
