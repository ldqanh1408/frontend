import { clearObserver, observer, type ObserverSession } from './store';
let attempt = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const link = (href: string, base: string) => {
  const u = new URL(href, base);
  if (u.origin !== new URL(base).origin || u.username || u.password) throw new Error('Observer links must stay on the telemetry service origin.');
  return u.toString();
};
async function read<T>(href: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(href, { credentials: 'include', cache: 'no-store', redirect: 'error', headers: { Accept: 'application/json' }, signal: signal ?? AbortSignal.timeout(15_000) });
  if (r.status === 401) { clearObserver('Observer authentication ended.'); throw new Error('Sign in to the Observer provider, then connect again.'); }
  if (!r.ok) throw new Error(`Telemetry service returned ${r.status}.`);
  return r.json() as Promise<T>;
}
export async function connectObserver(raw: string): Promise<void> {
  const url = new URL(raw.trim()); const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash) throw new Error('Use an HTTPS telemetry service URL without credentials, query or fragment.');
  const base = url.toString().replace(/\/+$/, ''); const n = ++attempt;
  clearTimeout(timer); observer.setState({ session: null, connecting: true, error: null });
  try {
    const caps = await read<{ protocol: string; audience: string; scope: string; serviceSessionHref: string; modules: Record<string, { collectionHref: string }> }>(`${base}/v1/capabilities?audience=observer`);
    if (caps.protocol !== 'atlas-ui/v1' || caps.audience !== 'observer') throw new Error('This entry accepts only an Observer audience.');
    const s = await read<{ subject: string; scope: string; audience: string; grants: string[]; expiresAt: string | null }>(link(caps.serviceSessionHref, base));
    if (s.audience !== 'observer' || !s.subject || !s.scope || s.scope !== caps.scope || !Array.isArray(s.grants) || s.grants.some(g => typeof g !== 'string') || (s.expiresAt && (!Number.isFinite(Date.parse(s.expiresAt)) || Date.parse(s.expiresAt) <= Date.now()))) throw new Error('The Observer session identity, scope, grants or expiry is invalid.');
    if (n !== attempt) return;
    const session: ObserverSession = { serviceUrl: base, subject: s.subject, scope: s.scope, grants: s.grants.filter(g => /^obs:/.test(g)), expiresAt: s.expiresAt, collections: Object.fromEntries(Object.entries(caps.modules ?? {}).filter(([k]) => /^(observer|metrics|traces|profiles|logs|telemetry|infra|saturation|audit|exports)$/.test(k)).map(([k,v]) => [k,link(v.collectionHref, base)])) };
    observer.setState({ session, connecting: false });
    if (s.expiresAt) timer = setTimeout(() => { clearObserver('Observer session expired.'); }, Math.min(2 ** 31 - 1, Date.parse(s.expiresAt) - Date.now()));
  } catch (e) { if (n === attempt) clearObserver(e instanceof Error ? e.message : 'Observer connection failed.'); throw e; }
}
export function disconnectObserver() { attempt++; clearTimeout(timer); clearObserver(); }
export interface TelemetryRecord { id: string; name: string; status: string; scope: string; revision: number; observedAt: string; fields?: Record<string, unknown> }
export async function observerRecords(section: string): Promise<TelemetryRecord[]> {
  const session = observer.getState().session;
  const grant = section === 'profiles' ? 'obs:view_profiler' : section === 'exports' ? 'obs:export_telemetry' : 'obs:view_advanced';
  if (!session || !session.grants.includes(grant) || (session.expiresAt && Date.parse(session.expiresAt) <= Date.now())) throw new Error(`Requires an independent Observer session with ${grant}.`);
  const href = session.collections[section] ?? session.collections.observer;
  if (!href) throw new Error('The telemetry service does not advertise this section.');
  const data = await read<{ items: TelemetryRecord[] }>(href);
  if (observer.getState().session !== session) throw new Error('Observer scope changed; stale results were discarded.');
  if (!data || !Array.isArray(data.items) || data.items.some(r => !r || typeof r.id !== 'string' || typeof r.name !== 'string' || r.scope !== session.scope || !Number.isSafeInteger(r.revision))) throw new Error('Telemetry returned an invalid or out-of-scope record.');
  return data.items;
}
