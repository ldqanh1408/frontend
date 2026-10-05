import { useEffect, useState } from 'react';
import { onDeviceChange } from './storage';

/** Runs an async loader and re-runs it when device data changes in this or another tab. */
export function useDeviceQuery<T>(load: () => Promise<T>, deps: unknown[], initial: T): { data: T; loading: boolean; error: string | null; reload: () => void } {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { const off = onDeviceChange(() => setTick((t) => t + 1)); return () => { off(); }; }, []);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    load().then((d) => { if (alive) { setData(d); setError(null); } }).catch((e) => { if (alive) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [...deps, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, loading, error, reload: () => setTick((t) => t + 1) };
}

export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): { data: T | undefined; error: string | null; loading: boolean } {
  const [state, setState] = useState<{ data: T | undefined; error: string | null; loading: boolean }>({ data: undefined, error: null, loading: true });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    load().then((d) => alive && setState({ data: d, error: null, loading: false })).catch((e) => alive && setState({ data: undefined, error: e instanceof Error ? e.message : String(e), loading: false }));
    return () => { alive = false; };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}
