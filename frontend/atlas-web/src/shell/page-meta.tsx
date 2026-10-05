import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';

export interface Crumb { label: string; to?: string }
interface Meta { title: string; crumbs: Crumb[] }
const Ctx = createContext<{ meta: Meta; set: (m: Meta) => void } | null>(null);

export function PageMetaProvider({ children }: { children: ReactNode }) {
  const [meta, set] = useState<Meta>({ title: 'Atlas', crumbs: [] });
  return <Ctx.Provider value={{ meta, set }}>{children}</Ctx.Provider>;
}
export function usePageMetaValue() {
  return useContext(Ctx)!.meta;
}

/** Each page declares its title and breadcrumb. The document title names the current view (WCAG 2.4.2, fixes FND-017). */
export function usePageMeta(title: string, crumbs: Crumb[] = []) {
  const ctx = useContext(Ctx);
  const key = JSON.stringify([title, crumbs]);
  useEffect(() => {
    ctx?.set({ title, crumbs });
    document.title = title === 'Atlas' ? 'Atlas' : `${title} · Atlas`;
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * After client-side navigation: reset the main scroller to the top and move focus to the page heading without scrolling
 * (preventScroll), then announce the new view. The content scrolls inside <main>, so the app bar can never cover the
 * breadcrumb or heading (fixes FND-018). Initial load keeps focus at the document start so the skip link comes first.
 */
export function useRouteFocus(mainRef: React.RefObject<HTMLElement | null>, announce: (msg: string) => void) {
  const loc = useLocation();
  const first = useRef(true);
  const meta = usePageMetaValue();
  const pending = useRef(false);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    pending.current = true;
    const main = mainRef.current;
    if (main) main.scrollTop = 0;
    const t = setTimeout(() => {
      const h = main?.querySelector<HTMLElement>('[data-page-title]');
      (h ?? main)?.focus({ preventScroll: true });
    }, 30);
    return () => clearTimeout(t);
  }, [loc.pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (pending.current && meta.title) { announce(`${meta.title} view`); pending.current = false; }
  }, [meta.title]); // eslint-disable-line react-hooks/exhaustive-deps
}
