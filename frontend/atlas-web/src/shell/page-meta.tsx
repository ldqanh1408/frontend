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

/** Transfer an explicit main focus to its lazy heading without stealing later user focus. */
export function focusPageHeading(main: HTMLElement | null, preventScroll: boolean) {
  if (!main) return () => {};
  const heading = main.querySelector<HTMLElement>('[data-page-title]');
  if (heading) { heading.focus({ preventScroll }); return () => {}; }
  main.focus({ preventScroll });
  let timer = 0;
  const stop = () => { observer.disconnect(); window.clearTimeout(timer); };
  const observer = new MutationObserver(() => {
    if (!main.isConnected || document.activeElement !== main) { stop(); return; }
    const ready = main.querySelector<HTMLElement>('[data-page-title]');
    if (ready) { ready.focus({ preventScroll }); stop(); }
  });
  observer.observe(main, { childList: true, subtree: true });
  timer = window.setTimeout(stop, 10_000);
  return stop;
}

/**
 * After client-side navigation: reset the main scroller to the top and move focus to the page heading without scrolling
 * (preventScroll), then announce the new view. The content scrolls inside <main>, so the app bar can never cover the
 * breadcrumb or heading (fixes FND-018). Initial load keeps focus at the document start so the skip link comes first.
 */
export function useRouteFocus(mainRef: React.RefObject<HTMLElement | null>, announce: (msg: string) => void) {
  const loc = useLocation();
  const previousPath = useRef(loc.pathname);
  const meta = usePageMetaValue();
  const pending = useRef(false);
  useEffect(() => {
    // StrictMode replays mount effects. Only a real pathname change may move focus.
    if (previousPath.current === loc.pathname) return;
    previousPath.current = loc.pathname;
    pending.current = true;
    const main = mainRef.current;
    if (main) main.scrollTop = 0;
    let stopFocus = () => {};
    const t = setTimeout(() => {
      const active = document.activeElement;
      // Navigation may settle after the user starts editing or opens a dialog.
      // A delayed route focus must never interrupt that interaction.
      if (active?.closest('[role="dialog"]') || (active && main?.contains(active) && active.closest('input,textarea,select,button,a,[role="tab"],[contenteditable="true"]'))) return;
      stopFocus = focusPageHeading(main, true);
    }, 30);
    return () => { clearTimeout(t); stopFocus(); };
  }, [loc.pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (pending.current && meta.title) { announce(`${meta.title} view`); pending.current = false; }
  }, [meta.title]); // eslint-disable-line react-hooks/exhaustive-deps
}
