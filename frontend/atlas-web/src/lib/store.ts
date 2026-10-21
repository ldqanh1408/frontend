import { useSyncExternalStore } from 'react';
import { createStore as createZustandStore } from 'zustand/vanilla';

export interface Store<T> {
  get: () => T;
  set: (patch: Partial<T> | ((s: T) => Partial<T>)) => void;
  subscribe: (fn: () => void) => () => void;
}

/** Zustand's vanilla store behind the existing API; stores remain scoped to their SPA. */
export function createStore<T extends object>(initial: T): Store<T> {
  const state = createZustandStore<T>(() => initial);
  return {
    get: state.getState,
    set: (patch) => state.setState(patch),
    subscribe: state.subscribe,
  };
}

export function useStore<T extends object, S>(store: Store<T>, select: (s: T) => S): S {
  return useSyncExternalStore(store.subscribe, () => select(store.get()), () => select(store.get()));
}
