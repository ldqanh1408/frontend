import { app, capability, type ServiceSession, type StreamKind } from './app-store';

export interface StreamFrame { protocol: 'atlas-stream/v1'; scope: string; resourceId: string; seq: number; type: string; payload: unknown }
export interface StreamStatus { state: 'unavailable' | 'connecting' | 'live' | 'ended' | 'error'; reason: string }
const MAX_FRAME_BYTES = 64 * 1024;

/** Cookie-authenticated WebSocket stays on the advertised service origin, never carries a URL token. */
export function streamUrl(href: string, session: ServiceSession): string {
  const service = new URL(session.serviceUrl);
  const u = new URL(href, service);
  if (u.protocol === 'https:') u.protocol = 'wss:';
  if (u.protocol === 'http:') u.protocol = 'ws:';
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  if (u.protocol !== 'wss:' && !(local && u.protocol === 'ws:')) throw new Error('Live endpoints require WSS.');
  if (u.host !== service.host || (u.protocol === 'wss:') !== (service.protocol === 'https:') || u.username || u.password || u.search || u.hash) throw new Error('The live endpoint must stay on the service origin without credentials or query parameters.');
  return u.toString();
}
export function validateFrame(raw: string, session: ServiceSession, resourceId: string, previous: number | null): StreamFrame {
  if (new TextEncoder().encode(raw).length > MAX_FRAME_BYTES) throw new Error('Live frame exceeds the 64 KiB limit. Reconnect for a fresh snapshot.');
  const f = JSON.parse(raw) as StreamFrame;
  if (!f || f.protocol !== 'atlas-stream/v1' || f.scope !== session.scope.label || f.resourceId !== resourceId || !Number.isSafeInteger(f.seq) || f.seq < 0 || typeof f.type !== 'string') throw new Error('Live frame identity, scope or sequence is invalid.');
  if (previous != null && f.seq !== previous + 1) throw new Error('Live sequence changed. Refresh the authoritative snapshot before reconnecting.');
  return f;
}

/** Reads only. Commands always use REST sendCommand; stream reconnect never repeats a mutation. */
export function openStream(kind: StreamKind, resourceId: string, receive: (frame: StreamFrame) => void, status: (s: StreamStatus) => void): { close: () => void; consumed: (bytes: number) => void } {
  const session = app.get().session;
  const endpoint = session?.streams?.[kind];
  const unavailable = (reason: string) => { status({ state: 'unavailable', reason }); return { close() {}, consumed() {} }; };
  if (!resourceId.trim()) return unavailable('Select a scoped resource before joining a live stream.');
  if (!session || app.get().connection !== 'connected' || !endpoint) return unavailable('Not observed — this session does not advertise an authorized live endpoint.');
  if (endpoint.protocol !== 'atlas-stream/v1') return unavailable('The live protocol is incompatible.');
  if (session.audience !== 'workspace') return unavailable('Observer sessions cannot join workspace streams.');
  const gate = capability(endpoint.grant);
  if (!gate.ok) return unavailable(gate.reason);
  let url: string;
  try { url = streamUrl(endpoint.href, session); } catch (e) { return unavailable((e as Error).message); }
  let socket: WebSocket;
  try { socket = new WebSocket(url, 'atlas-stream.v1'); } catch { return unavailable('The live endpoint could not be opened.'); }
  let closed = false;
  let previous: number | null = null;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  const send = (data: object) => { if (!closed && socket.readyState === WebSocket.OPEN && socket.bufferedAmount < 64 * 1024) socket.send(JSON.stringify(data)); };
  const close = () => { if (closed) return; closed = true; clearTimeout(expiry); off(); window.removeEventListener('pagehide', close); socket.close(1000); };
  const fail = (reason: string) => { status({ state: 'error', reason }); close(); };
  const off = app.subscribe(() => { if (app.get().session !== session || app.get().connection !== 'connected') { status({ state: 'ended', reason: 'The session or scope changed. Live data was cleared.' }); close(); } });
  status({ state: 'connecting', reason: 'Connecting to the authorized live endpoint…' });
  socket.onopen = () => {
    if (closed || app.get().session !== session || !capability(endpoint.grant).ok) { close(); return; }
    send({ type: 'subscribe', protocol: 'atlas-stream/v1', kind, resourceId, scope: session.scope.label });
    status({ state: 'live', reason: 'Live · authorized scoped stream' });
  };
  socket.onmessage = event => {
    if (closed) return;
    if (app.get().session !== session || !capability(endpoint.grant).ok) { fail('Live authorization ended.'); return; }
    try {
      if (typeof event.data !== 'string') throw new Error('The live endpoint returned an unsupported frame.');
      const frame = validateFrame(event.data, session, resourceId, previous);
      previous = frame.seq;
      receive(frame);
    } catch (e) { fail(e instanceof Error ? e.message : 'Invalid live frame.'); }
  };
  socket.onerror = () => fail('Live connection failed. Refresh the snapshot; no command was repeated.');
  socket.onclose = () => { if (!closed) { status({ state: 'ended', reason: 'Live connection ended. Reconnect after inspecting the current snapshot.' }); close(); } };
  if (session.expiresAt) expiry = setTimeout(() => { status({ state: 'ended', reason: 'The service session expired.' }); close(); }, Math.max(0, Math.min(2 ** 31 - 1, Date.parse(session.expiresAt) - Date.now())));
  window.addEventListener('pagehide', close);
  return { close, consumed: bytes => send({ type: 'consumed', bytes, seq: previous, resourceId, scope: session.scope.label }) };
}
