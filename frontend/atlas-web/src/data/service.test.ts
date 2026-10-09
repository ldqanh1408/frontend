import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from './app-store';
import { actionGate, connect, disconnect, loadCollection, reconcile, sendCommand, validateServiceUrl, type ServiceRecord } from './service';
import { get, type JournalEntry } from '../lib/storage';
import { sha256Hex, stableJson } from '../lib/hash';

const B = 'https://svc.example.test';
type Mode = 'Received' | 'Effective' | 'http500' | 'netfail' | 'mismatch' | 'Rejected';
let posts: { url: string; headers: Record<string, string>; body: Record<string, unknown> }[] = [];
let mode: Mode = 'Received';
let ops: Record<string, { fp: string; rid: string }> = {};
let unauthorized = false;
let sessionTtl = 3600e3;
let reason: string | undefined;
let effectEvidence = 'ev-1';
afterEach(() => { disconnect(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
const record = (): ServiceRecord => ({
  id: 'run-1', name: 'Run one', revision: 3, scope: 'org:a/ws:b', observedAt: new Date().toISOString(), status: 'Active', etag: '"run-1-r3"',
  actions: [{ id: 'pause', grant: 'agent:control', label: 'Pause', href: `${B}/v1/execution/run-1/pause`, statusHref: `${B}/v1/ops/{operationId}`, effectHref: `${B}/v1/effects/run-1`, resourceId: 'run-1', expectedRevision: 3 }],
});

beforeEach(() => {
  posts = []; ops = {}; mode = 'Received'; unauthorized = false; sessionTtl = 3600e3;
  reason = undefined; effectEvidence = 'ev-1';
  app.set({ connection: 'disconnected', session: null, toasts: [], endReason: null });
  vi.stubGlobal('fetch', vi.fn(async (input: string, init: RequestInit = {}) => {
    const u = new URL(input);
    const method = (init.method || 'GET').toUpperCase();
    if (method === 'POST') {
      const body = JSON.parse(String(init.body));
      posts.push({ url: input, headers: init.headers as Record<string, string>, body });
      await new Promise((r) => setTimeout(r, 5));
      if (mode === 'http500') return json({ error: 'x' }, 500);
      if (mode === 'netfail') throw new TypeError('Failed to fetch');
      ops[body.operationId] = { fp: body.fingerprint, rid: body.resourceId };
      return json({ operationId: body.operationId, scope: body.scope, resourceId: body.resourceId, fingerprint: mode === 'mismatch' ? 'bad' : body.fingerprint, stage: mode === 'mismatch' ? 'Received' : mode, reason });
    }
    if (unauthorized && u.pathname !== '/v1/capabilities') return json({ error: 'unauthorized' }, 401);
    if (u.pathname === '/v1/capabilities') return json({ protocol: 'atlas-ui/v1', audience: u.searchParams.get('audience'), scope: 'org:a/ws:b', serviceSessionHref: `${B}/v1/session`, modules: { execution: { collectionHref: `${B}/v1/execution` } } });
    if (u.pathname === '/v1/session') return json({ subject: 'user@a', scope: 'org:a/ws:b', audience: 'workspace', grants: ['agent:control'], expiresAt: new Date(Date.now() + sessionTtl).toISOString(), csrfToken: 'csrf-value' });
    if (u.pathname === '/v1/execution') return json({ items: [record()], complete: true, observedAt: new Date().toISOString() });
    const op = u.pathname.match(/^\/v1\/ops\/(.+)$/);
    if (op) { const id = decodeURIComponent(op[1]); const o = ops[id]; return o ? json({ operationId: id, scope: 'org:a/ws:b', resourceId: o.rid, fingerprint: o.fp, stage: reason ? 'Rejected' : 'Accepted', reason }) : json({}, 404); }
    if (u.pathname === '/v1/effects/run-1') { const id = Object.keys(ops).pop()!; return json({ operationId: id, scope: 'org:a/ws:b', resourceId: 'run-1', fingerprint: ops[id].fp, revision: 4, evidenceId: effectEvidence }); }
    return json({}, 404);
  }));
});

describe('service URL policy', () => {
  it('rejects credentials, queries and plain http', () => {
    expect(validateServiceUrl('https://u:p@x.test')).toMatch(/credentials/);
    expect(validateServiceUrl('https://x.test/?token=1')).toMatch(/tokens/);
    expect(validateServiceUrl('http://x.test')).toMatch(/HTTPS/);
    expect(validateServiceUrl('http://localhost:8787')).toBeNull();
    expect(validateServiceUrl('https://atlas.example.com')).toBeNull();
  });
});

describe('atlas-ui/v1 adapter', () => {
  it('ends a session as its advertised lifetime elapses, without waiting for another request', async () => {
    vi.useFakeTimers(); sessionTtl = 1000;
    await connect(B, 'workspace');
    await vi.advanceTimersByTimeAsync(1001);
    expect(app.get().connection).toBe('ended');
    expect(app.get().session).toBeNull();
  });
  it('refuses a cross-origin advertised session link', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json({ protocol: 'atlas-ui/v1', audience: 'workspace', scope: 'org:a/ws:b', serviceSessionHref: 'https://other.example.test/session', modules: {} }));
    await expect(connect(B, 'workspace')).rejects.toThrow(/another origin/);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });
  it('discloses an out-of-scope response without displaying its records', async () => {
    await connect(B, 'workspace');
    vi.mocked(fetch).mockResolvedValueOnce(json({ items: [{ ...record(), scope: 'another-tenant' }], complete: true }));
    await expect(loadCollection('execution')).rejects.toThrow(/authorized tenant scope/);
  });
  it('discards a delayed collection when the session has changed', async () => {
    await connect(B, 'workspace');
    let finish!: (r: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(r => { finish = r; }));
    const pending = loadCollection('execution');
    const rejected = expect(pending).rejects.toThrow(/scope or session changed/);
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    app.set(s => ({ session: { ...s.session! } }));
    finish(json({ items: [record()], complete: true }));
    await rejected;
  });
  it('connects and gates actions by grant', async () => {
    await connect(B, 'workspace');
    expect(app.get().connection).toBe('connected');
    const col = await loadCollection('execution');
    expect(col.items).toHaveLength(1);
    expect(actionGate(null, undefined)).toMatch(/Select a resource/);
    expect(actionGate(col.items[0], col.items[0].actions![0])).toBeNull();
  });

  it('sends exactly one POST for a double activation, with idempotency, CSRF and If-Match', async () => {
    await connect(B, 'workspace');
    const r = record();
    const [a, b] = await Promise.all([sendCommand('execution', r, r.actions![0]), sendCommand('execution', r, r.actions![0])]);
    expect(posts).toHaveLength(1);
    expect(a.id).toBe(b.id);
    expect(a.stage).toBe('Received');
    expect(posts[0].headers['Idempotency-Key']).toBe(a.id);
    expect(posts[0].headers['X-CSRF-Token']).toBeTruthy();
    expect(posts[0].headers['If-Match']).toBe('"run-1-r3"');
    expect(Object.keys(posts[0].body).sort()).toEqual(['actionId', 'expectedRevision', 'fingerprint', 'input', 'operationId', 'resourceId', 'scope']);
  });

  it.each([['http500'], ['netfail'], ['mismatch']] as const)('records Unknown (never resends) on %s', async (m) => {
    await connect(B, 'workspace');
    mode = m;
    const r = record();
    const e = await sendCommand('execution', r, r.actions![0]);
    expect(e.stage).toBe('Unknown');
    expect(posts).toHaveLength(1);
  });

  it('shows Effective only after a matching effect readback', async () => {
    await connect(B, 'workspace');
    mode = 'Effective';
    const r = record();
    const e = await sendCommand('execution', r, r.actions![0]);
    expect(e.stage).toBe('Effective');
    expect(e.evidence).toBe('ev-1');
  });

  it('reconciles by reading status, without a new POST', async () => {
    await connect(B, 'workspace');
    const r = record();
    const e = await sendCommand('execution', r, r.actions![0]);
    const next = await reconcile(e);
    expect(next.stage).toBe('Accepted');
    expect(posts).toHaveLength(1);
  });

  it('ends the session on 401 and withdraws service feedback (FND-005)', async () => {
    await connect(B, 'workspace');
    app.set({ toasts: [{ id: 't1', tone: 'success', title: 'Pause: Effective', kind: 'operation' }] });
    unauthorized = true;
    await expect(loadCollection('execution')).rejects.toThrow();
    expect(app.get().connection).toBe('ended');
    expect(app.get().session).toBeNull();
    const toasts = app.get().toasts;
    expect(toasts.some((t) => t.kind === 'operation')).toBe(false);
    expect(toasts.filter((t) => /session ended/i.test(t.title))).toHaveLength(1);
  });

  it('binds different secrets to different exact-payload fingerprints without storing inputs', async () => {
    await connect(B, 'workspace');
    const r = record(); const action = { ...r.actions![0], inputs: [{ key: 'apiKey', label: 'API key', secret: true }] };
    const a = await sendCommand('execution', r, action, { apiKey: 'synthetic-secret-a' });
    const b = await sendCommand('execution', r, action, { apiKey: 'synthetic-secret-b' });
    expect(a.fingerprint).not.toBe(b.fingerprint);
    for (let i = 0; i < posts.length; i++) {
      const { operationId: _id, fingerprint, ...payload } = posts[i].body;
      expect(fingerprint).toBe(await sha256Hex(stableJson(payload)));
    }
    expect(JSON.stringify(await get('journal', a.id))).not.toContain('synthetic-secret-a');
    expect(a).not.toHaveProperty('input');
  });

  it('does not retain echoed secret reasons in acknowledgements or reconciliation after reload', async () => {
    await connect(B, 'workspace'); mode = 'Rejected'; reason = 'Invalid synthetic-secret-a';
    const r = record(); const action = { ...r.actions![0], inputs: [{ key: 'apiKey', label: 'API key', secret: true }] };
    const entry = await sendCommand('execution', r, action, { apiKey: 'synthetic-secret-a' });
    expect(entry.stage).toBe('Rejected');
    const restored = (await get<JournalEntry>('journal', entry.id))!;
    const next = await reconcile(restored);
    expect(next.stage).toBe('Rejected'); expect(posts).toHaveLength(1);
    expect(JSON.stringify(await get('journal', entry.id))).not.toContain('synthetic-secret-a');
  });

  it('discards echoed secret evidence even after a matching effect readback', async () => {
    await connect(B, 'workspace'); mode = 'Effective'; effectEvidence = 'synthetic-secret-a';
    const r = record(); const action = { ...r.actions![0], inputs: [{ key: 'apiKey', label: 'API key', secret: true }] };
    const entry = await sendCommand('execution', r, action, { apiKey: 'synthetic-secret-a' });
    expect(entry.stage).toBe('Effective'); expect(entry.evidence).toBeNull();
    expect(JSON.stringify(await get('journal', entry.id))).not.toContain('synthetic-secret-a');
  });

  it('refuses commands from an observer session', async () => {
    await connect(B, 'workspace');
    app.set((s) => ({ session: { ...s.session!, audience: 'observer' } }));
    const r = record();
    expect(actionGate(r, r.actions![0])).toMatch(/Observer/);
  });
});
