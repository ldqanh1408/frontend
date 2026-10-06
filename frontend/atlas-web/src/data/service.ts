import { app, endSession, toast, type ServiceSession } from './app-store';
import { sha256Hex, stableJson } from '../lib/hash';
import { uuid } from '../lib/ids';
import { getAll, put, safeLocal, type JournalEntry } from '../lib/storage';

/**
 * Atlas UI service adapter — protocol `atlas-ui/v1` (PROPOSED; not an approved DTO, see BE-01).
 *   GET  {base}/v1/capabilities?audience=…  → { protocol, audience, scope, serviceSessionHref, modules: { m: { collectionHref } } }
 *   GET  serviceSessionHref                  → { subject, scope, audience, grants[], expiresAt, csrfToken?, logoutHref? }
 *   GET  collectionHref                      → { items: ServiceRecord[], complete, observedAt }
 *   POST action.href  (Idempotency-Key, X-CSRF-Token, If-Match) { operationId, scope, resourceId, actionId, expectedRevision, fingerprint, input }
 *   GET  statusHref / effectHref             → operation stage / effect readback
 * Rules: one POST per activation; any failure after a send is Unknown (never auto-resent); 401 or expiry ends the session;
 * an Effective claim is shown only after an effect readback matches operation, scope, resource and input fingerprint.
 */
export type Audience = 'workspace' | 'observer';
export type Stage = 'Requested' | 'Received' | 'Accepted' | 'Effective' | 'Rejected' | 'Unknown';

export interface ServiceActionInput { key: string; label: string; type?: string; required?: boolean; secret?: boolean }
export interface ServiceAction {
  id: string; grant: string; label: string; href: string; statusHref?: string; effectHref?: string; resourceId: string; expectedRevision: number;
  inputs?: ServiceActionInput[]; blockedReason?: string;
}
export interface ServiceRecord {
  id: string; name: string; revision: number; scope: string; observedAt: string; status: string; etag?: string;
  fields?: Record<string, unknown>; actions?: ServiceAction[];
}
export interface Collection { items: ServiceRecord[]; complete: boolean; observedAt: string }

export class ServiceError extends Error {
  constructor(message: string, public kind: 'network' | 'timeout' | 'http' | 'protocol' | 'session' | 'policy', public status?: number) { super(message); }
}

let csrf: string | null = null; // memory only; never persisted or rendered
let expiryTimer: ReturnType<typeof setTimeout> | null = null;
const TIMEOUT_MS = 15000;

export function validateServiceUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return 'Enter the service URL.';
  let u: URL;
  try { u = new URL(s); } catch { return 'Enter a full URL, e.g. https://atlas.example.com.'; }
  if (u.username || u.password) return 'Remove credentials from the URL. Sign-in happens with your identity provider.';
  if (u.search || u.hash) return 'Remove query strings and fragments; tokens never belong in the URL.';
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) return 'Use HTTPS (HTTP is allowed only for localhost development).';
  return null;
}
const base = (s: string) => s.trim().replace(/\/+$/, '');

/** Service-provided links must stay on the service origin so the session cookie and CSRF token never go elsewhere. */
function sameOrigin(href: string): string {
  const session = app.get().session;
  const origin = session ? new URL(session.serviceUrl).origin : null;
  const u = new URL(href, session?.serviceUrl);
  if (origin && u.origin !== origin) throw new ServiceError('The service returned a link to another origin; it was not followed.', 'policy');
  return u.toString();
}

async function request(url: string, init: RequestInit = {}, opts: { session?: boolean } = { session: true }): Promise<Response> {
  if (opts.session) {
    const s = app.get().session;
    if (!s || app.get().connection !== 'connected') throw new ServiceError('No service session.', 'session');
    if (s.expiresAt && Date.parse(s.expiresAt) <= Date.now()) {
      endSession('The service session expired.');
      throw new ServiceError('The service session expired.', 'session');
    }
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { credentials: 'include', cache: 'no-store', redirect: 'error', ...init, signal: ctrl.signal, headers: { Accept: 'application/json', ...((init.headers as Record<string, string>) || {}) } });
  } catch (e) {
    throw new ServiceError(ctrl.signal.aborted ? 'The service did not respond in time.' : 'The service could not be reached (network or CORS).', ctrl.signal.aborted ? 'timeout' : 'network');
  } finally { clearTimeout(t); }
  if (res.status === 401 && opts.session) {
    endSession('The service rejected the session (401).');
    throw new ServiceError('The service rejected the session.', 'session', 401);
  }
  return res;
}
async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new ServiceError(`The service answered ${res.status}.`, 'http', res.status);
  try { return (await res.json()) as T; } catch { throw new ServiceError('The service response is not valid JSON.', 'protocol'); }
}

export async function connect(url: string, audience: Audience): Promise<void> {
  const err = validateServiceUrl(url);
  if (err) throw new ServiceError(err, 'policy');
  const b = base(url);
  safeLocal.set('atlas.serviceUrl', b);
  app.set((s) => ({ connection: 'connecting', serviceUrl: b, endReason: null, toasts: s.toasts.filter((x) => x.kind === 'local') }));
  try {
    const capsRes = await request(`${b}/v1/capabilities?audience=${audience}`, {}, { session: false });
    if (capsRes.status === 401) throw new ServiceError('Sign in to the service first, then connect again.', 'session', 401);
    const caps = await json<{ protocol: string; audience: string; scope: string; serviceSessionHref: string; modules: Record<string, { collectionHref: string }> }>(capsRes);
    if (caps.protocol !== 'atlas-ui/v1') throw new ServiceError(`Unsupported protocol “${String(caps.protocol)}”. Atlas expects atlas-ui/v1.`, 'protocol');
    if (caps.audience !== audience) throw new ServiceError(`The service offered a ${caps.audience} session instead of ${audience}.`, 'protocol');
    const origin = new URL(b).origin;
    const check = (h: string) => { const u = new URL(h, b); if (u.origin !== origin) throw new ServiceError('The service advertised links on another origin.', 'policy'); return u.toString(); };
    const sesRes = await request(check(caps.serviceSessionHref), {}, { session: false });
    if (sesRes.status === 401) throw new ServiceError('No authenticated session. Sign in with your identity provider, then connect.', 'session', 401);
    const ses = await json<{ subject: string; scope: string; audience: string; grants: string[]; expiresAt: string | null; csrfToken?: string; logoutHref?: string; displayName?: string }>(sesRes);
    if (ses.audience !== audience) throw new ServiceError('Session audience does not match the requested audience.', 'protocol');
    if (ses.scope !== caps.scope) throw new ServiceError('Session scope does not match the advertised scope.', 'protocol');
    if (ses.expiresAt && Date.parse(ses.expiresAt) <= Date.now()) throw new ServiceError('The service returned an expired session.', 'session');
    csrf = ses.csrfToken ?? null;
    const session: ServiceSession = {
      serviceUrl: b, audience, actor: { id: ses.subject, name: ses.displayName ?? ses.subject },
      scope: { org: null, workspace: null, project: null, label: ses.scope }, grants: Array.isArray(ses.grants) ? ses.grants.map(String) : [],
      expiresAt: ses.expiresAt, collections: Object.fromEntries(Object.entries(caps.modules ?? {}).map(([m, v]) => [m, check(v.collectionHref)])),
      logoutHref: ses.logoutHref ? check(ses.logoutHref) : null, capabilityVersion: caps.protocol,
    };
    app.set({ connection: 'connected', session });
    armExpiry(session.expiresAt);
    safeLocal.set('atlas.serviceRestore', audience);
  } catch (e) {
    app.set({ connection: 'disconnected', session: null });
    csrf = null;
    throw e;
  }
}

function armExpiry(expiresAt: string | null) {
  if (expiryTimer) clearTimeout(expiryTimer);
  expiryTimer = null;
  if (!expiresAt) return;
  const ms = Date.parse(expiresAt) - Date.now();
  if (ms > 0 && ms < 2 ** 31 - 1) expiryTimer = setTimeout(() => { csrf = null; endSession('The service session expired.'); }, ms);
}

export function disconnect() {
  safeLocal.set('atlas.serviceRestore', '');
  if (expiryTimer) clearTimeout(expiryTimer);
  csrf = null;
  app.set((s) => ({ connection: 'disconnected', session: null, endReason: null, toasts: s.toasts.filter((t) => t.kind === 'local') }));
  toast({ tone: 'info', title: 'Disconnected', body: 'Service records were cleared from this view. Device drafts are unchanged.' });
}

export async function loadCollection(module: string): Promise<Collection> {
  const href = app.get().session?.collections[module];
  if (!href) throw new ServiceError('The connected service does not advertise this module.', 'protocol');
  const c = await json<Collection>(await request(sameOrigin(href)));
  if (!c || !Array.isArray(c.items)) throw new ServiceError('The collection response is missing items.', 'protocol');
  return { items: c.items.filter((r) => r && typeof r.id === 'string'), complete: c.complete !== false, observedAt: c.observedAt ?? new Date().toISOString() };
}

export function actionGate(record: ServiceRecord | null, action: ServiceAction | undefined): string | null {
  const { connection, session } = app.get();
  if (connection !== 'connected' || !session) return 'Connect a service session to inspect action preconditions.';
  if (session.audience === 'observer') return 'Observer sessions are read-only and cannot send workspace commands.';
  if (!record) return 'Select a resource. Grants and a resource revision are required before acting.';
  if (!action) return `The service did not offer this action for ${record.name} at revision ${record.revision}.`;
  if (action.blockedReason) return action.blockedReason;
  if (!session.grants.includes(action.grant) && !session.grants.includes('*')) return `Requires ${action.grant} in ${session.scope.label}.`;
  return null;
}


/**secret inputs are write-only**/
export function fingerprintPayload<P extends { input: Record<string, unknown> }>(payload: P, action: ServiceAction): P {
  const secret = new Set((action.inputs ?? []).filter((i) => i.secret).map((i) => i.key));
  if (!secret.size) return payload;
  return { ...payload, input: Object.fromEntries(Object.entries(payload.input).map(([k, v]) => [k, secret.has(k) ? '[secret]' : v])) };
}


const inflight = new Map<string, Promise<JournalEntry>>();

/** Sends one command. A second activation while the first is in flight returns the same operation (exactly one POST). */
export function sendCommand(module: string, record: ServiceRecord, action: ServiceAction, input: Record<string, unknown> = {}): Promise<JournalEntry> {
  const key = `${record.id}:${action.id}`;
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = doSend(module, record, action, input).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function doSend(module: string, record: ServiceRecord, action: ServiceAction, input: Record<string, unknown>): Promise<JournalEntry> {
  const gate = actionGate(record, action);
  if (gate) throw new ServiceError(gate, 'policy');
  const session = app.get().session!;
  const operationId = uuid();
  const payload = { scope: session.scope.label, resourceId: action.resourceId, actionId: action.id, expectedRevision: action.expectedRevision, input };
  const fingerprint = await sha256Hex(stableJson(fingerprintPayload(payload, action)));
  const now = new Date().toISOString();
  let entry: JournalEntry = {
    id: operationId, module, resourceId: action.resourceId, resourceName: record.name, actionId: action.id, label: action.label, stage: 'Requested',
    idempotencyKey: operationId, fingerprint, scope: session.scope.label, createdAt: now, updatedAt: now, message: 'Request prepared.', evidence: null,
    statusHref: action.statusHref ?? null, effectHref: action.effectHref ?? null, expectedRevision: action.expectedRevision,
  };
  await put('journal', entry);
  const update = async (patch: Partial<JournalEntry>) => { entry = { ...entry, ...patch, updatedAt: new Date().toISOString() }; await put('journal', entry); return entry; };
  let res: Response;
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Idempotency-Key': operationId };
    if (csrf) headers['X-CSRF-Token'] = csrf;
    if (record.etag) headers['If-Match'] = record.etag;
    res = await request(sameOrigin(action.href), { method: 'POST', headers, body: JSON.stringify({ operationId, ...payload, fingerprint }) });
  } catch (e) {
    const msg = e instanceof ServiceError && e.kind === 'policy' ? e.message : `${e instanceof Error ? e.message : 'Send failed.'} The outcome is unknown; reconcile with operation ${operationId} before retrying.`;
    return update({ stage: e instanceof ServiceError && e.kind === 'policy' ? 'Rejected' : 'Unknown', message: msg });
  }
  if (!res.ok) {
    return update({ stage: 'Unknown', message: `The service answered ${res.status}. The request may or may not have been applied; reconcile operation ${operationId} before retrying.` });
  }
  let body: { operationId?: string; scope?: string; resourceId?: string; fingerprint?: string; stage?: string; reason?: string };
  try { body = await res.json(); } catch { return update({ stage: 'Unknown', message: 'The acknowledgement was not valid JSON. Reconcile before retrying.' }); }
  if (body.operationId !== operationId || body.resourceId !== action.resourceId || body.scope !== session.scope.label || body.fingerprint !== fingerprint) {
    return update({ stage: 'Unknown', message: 'The acknowledgement does not match this operation, scope, resource or input fingerprint. Reconcile before retrying.' });
  }
  return applyStage(update, body.stage, body.reason, entry);
}

async function applyStage(update: (p: Partial<JournalEntry>) => Promise<JournalEntry>, stage: string | undefined, reason: string | undefined, entry: JournalEntry): Promise<JournalEntry> {
  switch (stage) {
    case 'Received': return update({ stage: 'Received', message: 'Received by the service. Acknowledgement only — the effect is not yet verified.' });
    case 'Accepted': return update({ stage: 'Accepted', message: 'Accepted for processing. Acknowledgement only — the effect is not yet verified.' });
    case 'Rejected': return update({ stage: 'Rejected', message: reason ? `Rejected: ${reason}` : 'Rejected by the service. Nothing was applied.' });
    case 'Effective': return verifyEffect(update, entry);
    default: return update({ stage: 'Unknown', message: `Unrecognized stage “${String(stage)}”. Reconcile before retrying.` });
  }
}

async function verifyEffect(update: (p: Partial<JournalEntry>) => Promise<JournalEntry>, entry: JournalEntry): Promise<JournalEntry> {
  if (!entry.effectHref) return update({ stage: 'Unknown', message: 'The service claimed an effect but offers no effect readback. Effective cannot be shown.' });
  try {
    const eff = await json<{ operationId?: string; scope?: string; resourceId?: string; fingerprint?: string; evidenceId?: string; revision?: number }>(await request(sameOrigin(entry.effectHref)));
    if (eff.operationId !== entry.id || eff.scope !== entry.scope || eff.resourceId !== entry.resourceId || eff.fingerprint !== entry.fingerprint) {
      return update({ stage: 'Unknown', message: 'The effect readback does not match this operation. Effective is not shown; reconcile.' });
    }
    return update({ stage: 'Effective', message: `Effect read back${eff.revision ? ` at revision ${eff.revision}` : ''}.`, evidence: eff.evidenceId ?? null });
  } catch (e) {
    return update({ stage: 'Unknown', message: `Effect readback failed: ${e instanceof Error ? e.message : String(e)} Reconcile before retrying.` });
  }
}

/** Re-reads an operation's status (never re-sends). */
export async function reconcile(entry: JournalEntry): Promise<JournalEntry> {
  let cur = entry;
  const update = async (patch: Partial<JournalEntry>) => { cur = { ...cur, ...patch, updatedAt: new Date().toISOString() }; await put('journal', cur); return cur; };
  if (!entry.statusHref) return update({ message: 'This service offers no status link for the operation. Inspect it in the service before retrying.' });
  try {
    const st = await json<{ operationId?: string; scope?: string; resourceId?: string; fingerprint?: string; stage?: string; reason?: string }>(
      await request(sameOrigin(entry.statusHref.replace('{operationId}', encodeURIComponent(entry.id)))),
    );
    if (st.operationId !== entry.id || st.fingerprint !== entry.fingerprint || st.resourceId !== entry.resourceId || st.scope !== entry.scope) {
      return update({ stage: 'Unknown', message: 'The status does not match this operation. Keep the operation ID and contact the service owner.' });
    }
    return applyStage(update, st.stage, st.reason, cur);
  } catch (e) {
    if (e instanceof ServiceError && e.status === 404) return update({ stage: 'Unknown', message: 'The service has no record of this operation. It was probably not received; confirm in the service before retrying.' });
    return update({ message: `Reconcile failed: ${e instanceof Error ? e.message : String(e)}` });
  }
}

export async function listJournal(module?: string): Promise<JournalEntry[]> {
  const all = await getAll<JournalEntry>('journal', module ? 'module' : undefined, module);
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * After a reload, re-establish a previously connected session from the service's own cookie session (no token is stored
 * in the browser). Failure leaves Atlas disconnected with the reason shown on the connection page.
 */
export async function restoreSession(): Promise<void> {
  const audience = safeLocal.get('atlas.serviceRestore');
  const url = app.get().serviceUrl;
  if (!url || (audience !== 'workspace' && audience !== 'observer')) return;
  try { await connect(url, audience); }
  catch (e) {
    safeLocal.set('atlas.serviceRestore', '');
    app.set({ connection: 'disconnected', endReason: `The previous service session could not be restored: ${e instanceof Error ? e.message : String(e)}` });
  }
}
