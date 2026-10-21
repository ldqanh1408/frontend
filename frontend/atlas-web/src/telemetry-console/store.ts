import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
export interface ObserverSession { serviceUrl: string; subject: string; scope: string; grants: string[]; expiresAt: string | null; collections: Record<string, string> }
interface ObserverState { session: ObserverSession | null; error: string | null; connecting: boolean; theme: 'dark' | 'light' }
export const observer = createStore<ObserverState>(() => ({ session: null, error: null, connecting: false, theme: document.documentElement.dataset.theme === 'light' ? 'light' : 'dark' }));
export const useObserver = <T,>(selector: (s: ObserverState) => T) => useStore(observer, selector);
export function observerTheme(theme: 'dark' | 'light') { observer.setState({ theme }); document.documentElement.dataset.theme = theme; try { localStorage.setItem('atlas.observer.theme', theme); } catch {} }
export function clearObserver(reason: string | null = null) { observer.setState({ session: null, error: reason, connecting: false }); }
