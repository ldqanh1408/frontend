import * as RD from '@radix-ui/react-dialog';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { NavContent, Sidebar } from './Sidebar';
import { StatusBar, TenantContext, TopBar } from './TopBar';
import { CommandPalette } from './CommandPalette';
import { HelpDialog, PreferencesDialog } from './dialogs';
import { focusPageHeading, useRouteFocus } from './page-meta';
import { Toaster } from '../components/overlays';
import { Button, PageSkeleton } from '../components/ui';
import { useStore } from '../lib/store';
import { persistence } from '../lib/storage';
import { Banner } from '../components/ui';

function isTypingTarget(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || !!el.closest('.monaco-editor'));
}

export function AppShell() {
  const mainRef = useRef<HTMLElement>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [search, setSearch] = useState(false);
  const [help, setHelp] = useState(false);
  const [prefs, setPrefs] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const loc = useLocation();
  const p = useStore(persistence, (s) => s.mode);
  const announce = useCallback((m: string) => { setAnnouncement(''); requestAnimationFrame(() => setAnnouncement(m)); }, []);
  useRouteFocus(mainRef, announce);
  useEffect(() => { setNavOpen(false); }, [loc.pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'k' || (e.shiftKey && e.key.toLowerCase() === 'p'))) { e.preventDefault(); setSearch((v) => !v); }
      else if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTypingTarget(e.target)) { e.preventDefault(); setHelp(true); }
    };
    window.addEventListener('keydown', onKey);
    const openSearch = () => setSearch(true);
    window.addEventListener('atlas:open-search', openSearch);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('atlas:open-search', openSearch); };
  }, []);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); focusPageHeading(mainRef.current, false); }}>Skip to workspace</a>
      <Sidebar />
      <TopBar navOpen={navOpen} onOpenNav={() => setNavOpen(true)} onOpenSearch={() => setSearch(true)} onOpenHelp={() => setHelp(true)} onOpenPrefs={() => setPrefs(true)} />
      <main id="main" ref={mainRef} className="app-main" tabIndex={-1}>
        <TenantContext />
        {p === 'memory' && (
          <div style={{ padding: 'var(--space-16) var(--space-24) 0' }}>
            <Banner tone="warning" title="Local persistence unavailable">This browser blocks IndexedDB. Drafts you create are kept only until this tab closes; export them to keep a copy.</Banner>
          </div>
        )}
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
      <StatusBar />
      <RD.Root open={navOpen} onOpenChange={setNavOpen}>
        <RD.Portal>
          <RD.Overlay className="scrim" />
          <RD.Content className="drawer" aria-label="Workspace navigation">
            <RD.Title className="sr-only">Workspace navigation</RD.Title>
            <RD.Description className="sr-only">Choose a workspace module.</RD.Description>
            <div className="row-between" style={{ padding: 'var(--space-8) var(--space-8) 0 var(--space-16)' }}>
              <span className="caption">Navigation</span>
              <RD.Close asChild><Button variant="quiet" iconOnly icon="close">Close navigation</Button></RD.Close>
            </div>
            <NavContent onNavigate={() => setNavOpen(false)} />
          </RD.Content>
        </RD.Portal>
      </RD.Root>
      <CommandPalette open={search} onOpenChange={setSearch} onOpenHelp={() => setHelp(true)} onOpenPrefs={() => setPrefs(true)} />
      <HelpDialog open={help} onOpenChange={setHelp} />
      <PreferencesDialog open={prefs} onOpenChange={setPrefs} />
      <Toaster />
      <div className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</div>
    </div>
  );
}
