import { useMemo } from 'react';
import { createStore, useStore } from '../lib/store';
import { safeLocal } from '../lib/storage';
import { uuid } from '../lib/ids';

export type Theme = 'dark' | 'light';
export type Tone = 'info' | 'success' | 'warning' | 'danger';
/** `session` and `operation` toasts describe service state; they are withdrawn when the session ends (FND-005). */
export interface Toast { id: string; tone: Tone; title: string; body?: string; kind: 'local' | 'session' | 'operation'; sticky?: boolean }

export interface ServiceScope { org: string | null; workspace: string | null; project: string | null; label: string }
export type StreamKind = 'presence' | 'dag' | 'terminal' | 'thought' | 'notifications';
export interface StreamEndpoint { href: string; grant: string; protocol: 'atlas-stream/v1' }
export interface ServiceSession {
  serviceUrl: string; audience: 'workspace' | 'observer'; actor: { id: string; name: string }; scope: ServiceScope;
  grants: string[]; expiresAt: string | null; collections: Record<string, string>; logoutHref: string | null; capabilityVersion: string;
  entitlements?: Record<string, boolean>; limits?: Record<string, { used: number; limit: number }>;
  streams?: Partial<Record<StreamKind, StreamEndpoint>>;
  collaboration?: { href: string; grant: 'collab:edit_realtime'; protocol: 'y-websocket'; roomPrefix: string };
  scopeSwitchHref?: string;
  configurationHref?: string;
}
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'ended';

interface AppState {
  theme: Theme; density: 'comfortable' | 'compact'; reducedMotion: boolean; toasts: Toast[];
  connection: ConnectionStatus; session: ServiceSession | null; endReason: string | null; serviceUrl: string;
}

const storedTheme = safeLocal.get('atlas.theme');
export const app = createStore<AppState>({
  theme: storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : (document.documentElement.dataset.theme as Theme) || 'dark',
  density: (safeLocal.get('atlas.density') as AppState['density']) || 'comfortable',
  reducedMotion: false,
  toasts: [],
  connection: 'disconnected',
  session: null,
  endReason: null,
  serviceUrl: safeLocal.get('atlas.serviceUrl') || '',
});
export const useApp = <S,>(sel: (s: AppState) => S) => useStore(app, sel);

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  safeLocal.set('atlas.theme', theme);
  app.set({ theme });
}
export function setDensity(density: AppState['density']) {
  document.documentElement.dataset.density = density;
  safeLocal.set('atlas.density', density);
  app.set({ density });
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();
/** At most three notifications are visible; the oldest gives way. */
export const MAX_TOASTS = 3;
/** Reading time scales with severity; errors stay longer. Hover or focus pauses the timer (WCAG 2.2.1). */
const toastMs = (t: Toast) => (t.tone === 'danger' ? 10000 : t.tone === 'warning' ? 8000 : 5000);
function arm(t: Toast) { if (!t.sticky) timers.set(t.id, setTimeout(() => dismissToast(t.id), toastMs(t))); }
export function toast(t: Omit<Toast, 'id' | 'kind'> & { kind?: Toast['kind'] }) {
  const item: Toast = { id: uuid(), kind: 'local', ...t };
  const dropped = app.get().toasts.slice(0, Math.max(0, app.get().toasts.length - (MAX_TOASTS - 1)));
  for (const d of dropped) { clearTimeout(timers.get(d.id)); timers.delete(d.id); }
  app.set((s) => ({ toasts: [...s.toasts.slice(-(MAX_TOASTS - 1)), item] }));
  arm(item);
  return item.id;
}
export function holdToast(id: string) { clearTimeout(timers.get(id)); timers.delete(id); }
export function releaseToast(id: string) { const t = app.get().toasts.find((x) => x.id === id); if (t && !timers.has(id)) arm(t); }
export function dismissToast(id: string) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  app.set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
}

/** Ends the service session: clears service-derived feedback and announces a single reconnect message. */
export function endSession(reason: string) {
  const had = app.get().connection === 'connected';
  app.set((s) => ({ connection: 'ended', session: null, endReason: reason, toasts: s.toasts.filter((t) => t.kind === 'local') }));
  if (had) toast({ tone: 'warning', title: 'Service session ended', body: `${reason} Reconnect to load authorized records.`, kind: 'local', sticky: true });
}

export interface Capability { ok: boolean; reason: string; kind: 'permission' | 'entitlement' | 'quota' | 'session' }
/**
 * Capability gate. Roles never authorize by name (RBAC matrix): an action is enabled only when the current service session
 * explicitly grants it. Disconnected or ended sessions always yield a visible, specific reason.
 */
export function capability(grant: string, what = 'this action', options: { entitlement?: string; resource?: string } = {}): Capability {
  const { connection, session } = app.get();
  if (connection !== 'connected' || !session) {
    return { ok: false, kind: 'session', reason: `Requires an authorized service session with ${grant}. ${connection === 'ended' ? 'The previous session ended.' : 'No service is connected.'}` };
  }
  if (session.expiresAt && Date.parse(session.expiresAt) <= Date.now()) return { ok: false, kind: 'session', reason: 'The service session expired. Reconnect before acting.' };
  if (!session.scope.label.trim()) return { ok: false, kind: 'session', reason: 'No authorized tenant context. Select a scope through the service.' };
  if (session.audience === 'observer' && !/^(obs:|observer:)/.test(grant)) return { ok: false, kind: 'permission', reason: 'Observer sessions are read-only. Workspace actions are unavailable.' };
  if (!session.grants.includes(grant) && !session.grants.includes('*')) return { ok: false, kind: 'permission', reason: `Requires ${grant} in ${session.scope.label || 'the current scope'} for ${what}.` };
  if (options.entitlement && session.entitlements?.[options.entitlement] !== true) return { ok: false, kind: 'entitlement', reason: session.entitlements?.[options.entitlement] === false ? "Not included in your organization's plan." : 'Plan entitlement not observed. Refresh before acting.' };
  const quota = options.resource ? session.limits?.[options.resource] : null;
  if (options.resource && !quota) return { ok: false, kind: 'quota', reason: `Limit not observed: ${options.resource}. Refresh before acting.` };
  if (quota && quota.used >= quota.limit) return { ok: false, kind: 'quota', reason: `Limit reached: ${options.resource}.` };
  return { ok: true, kind: 'permission', reason: '' };
}
export function useCapability(grant: string, what?: string): Capability {
  const session = useApp((s) => s.session);
  const connection = useApp((s) => s.connection);
  return useMemo(() => capability(grant, what), [session, connection, grant, what]);
}
