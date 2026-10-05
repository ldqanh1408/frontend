import { useMemo } from 'react';
import { createStore, useStore } from '../lib/store';
import { safeLocal } from '../lib/storage';
import { uuid } from '../lib/ids';

export type Theme = 'dark' | 'light';
export type Tone = 'info' | 'success' | 'warning' | 'danger';
/** `session` and `operation` toasts describe service state; they are withdrawn when the session ends (FND-005). */
export interface Toast { id: string; tone: Tone; title: string; body?: string; kind: 'local' | 'session' | 'operation'; sticky?: boolean }

export interface ServiceScope { org: string | null; workspace: string | null; project: string | null; label: string }
export interface ServiceSession {
  serviceUrl: string; audience: 'workspace' | 'observer'; actor: { id: string; name: string }; scope: ServiceScope;
  grants: string[]; expiresAt: string | null; collections: Record<string, string>; logoutHref: string | null; capabilityVersion: string;
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
export function toast(t: Omit<Toast, 'id' | 'kind'> & { kind?: Toast['kind'] }) {
  const item: Toast = { id: uuid(), kind: 'local', ...t };
  app.set((s) => ({ toasts: [...s.toasts.slice(-3), item] }));
  if (!item.sticky) timers.set(item.id, setTimeout(() => dismissToast(item.id), item.tone === 'danger' ? 10000 : 6000));
  return item.id;
}
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

export interface Capability { ok: boolean; reason: string }
/**
 * Capability gate. Roles never authorize by name (RBAC matrix): an action is enabled only when the current service session
 * explicitly grants it. Disconnected or ended sessions always yield a visible, specific reason.
 */
export function capability(grant: string, what = 'this action'): Capability {
  const { connection, session } = app.get();
  if (connection !== 'connected' || !session) {
    return { ok: false, reason: `Requires an authorized service session with ${grant}. ${connection === 'ended' ? 'The previous session ended.' : 'No service is connected.'}` };
  }
  if (session.audience === 'observer' && !grant.startsWith('observer:')) return { ok: false, reason: 'Observer sessions cannot perform workspace actions.' };
  if (!session.grants.includes(grant) && !session.grants.includes('*')) return { ok: false, reason: `Requires ${grant} in ${session.scope.label || 'the current scope'} for ${what}.` };
  return { ok: true, reason: '' };
}
export function useCapability(grant: string, what?: string): Capability {
  // Select a primitive key (stable snapshot) and derive the object from it.
  const key = useApp((s) => `${s.connection}|${s.session?.audience ?? ''}|${s.session?.grants.join(',') ?? ''}`);
  return useMemo(() => capability(grant, what), [key, grant, what]); // eslint-disable-line react-hooks/exhaustive-deps
}
