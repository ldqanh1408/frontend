import { Dialog } from '../components/overlays';
import { Button, KeyValue, Kbd } from '../components/ui';
import { setDensity, setTheme, useApp } from '../data/app-store';
import { safeLocal, persistence } from '../lib/storage';
import { useStore } from '../lib/store';
import manifest from '../generated/manifest.json';

export function HelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const p = useStore(persistence, (s) => s);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Help and keyboard shortcuts" wide description="Atlas keeps device drafts, service records and command outcomes visibly separate.">
      <section className="stack-12" aria-labelledby="kb-h">
        <h3 id="kb-h">Keyboard</h3>
        <KeyValue items={[
          [<><Kbd>Ctrl</Kbd> <Kbd>K</Kbd> / <Kbd>⌘</Kbd> <Kbd>K</Kbd></>, 'Search views, definitions, documents and commands'],
          [<Kbd>?</Kbd>, 'Open this help'],
          [<><Kbd>Tab</Kbd> / <Kbd>Shift</Kbd> <Kbd>Tab</Kbd></>, 'Move between controls in visual order'],
          [<><Kbd>←</Kbd> <Kbd>→</Kbd> <Kbd>Home</Kbd> <Kbd>End</Kbd></>, 'Move between tabs; the focused tab opens its panel'],
          [<Kbd>Esc</Kbd>, 'Close a dialog or menu and return focus to the control that opened it'],
          [<><Kbd>Ctrl</Kbd> <Kbd>S</Kbd></>, 'Save the open document or definition (only while the editor has focus)'],
        ]} />
      </section>
      <section className="stack-12" aria-labelledby="ab-h">
        <h3 id="ab-h">Authority and evidence</h3>
        <KeyValue items={[
          ['Device drafts', 'Stored only in this browser (IndexedDB). They have no tenant authority and never change service state.'],
          ['Service records', 'Loaded from an explicitly connected, authorized service using the proposed Atlas UI v1 contract.'],
          ['Command stages', 'Requested → Received → Accepted are acknowledgements. Effective requires a matching effect readback; otherwise the outcome stays Unknown and must be reconciled.'],
          ['Permissions', 'Actions stay visible. A protected action is enabled only when the current session grants the exact capability; otherwise the reason is shown.'],
        ]} />
      </section>
      <section className="stack-12" aria-labelledby="bd-h">
        <h3 id="bd-h">This build</h3>
        <KeyValue items={[
          ['Version', `atlas-web ${__ATLAS_BUILD__}${__ATLAS_REVIEW__ ? ' · design review mode' : ''}`],
          ['Design source', `Figma ${manifest.figmaFile} · ${manifest.counts.views} views · ${manifest.counts.scenes} scenes · ${manifest.counts.schemas} definition types`],
          ['Local persistence', p.mode === 'indexeddb' ? 'IndexedDB available' : p.mode === 'memory' ? `Unavailable — drafts last only for this tab (${p.reason})` : 'Checking…'],
          ['Contract gates', 'API contracts, server enums, guards and role policies remain proposed (API TBD, D03, D04).'],
        ]} />
      </section>
    </Dialog>
  );
}

export function PreferencesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const theme = useApp((s) => s.theme);
  const density = useApp((s) => s.density);
  const stored = safeLocal.get('atlas.theme');
  const pref = stored === 'light' || stored === 'dark' ? stored : 'system';
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Display preferences" description="Saved on this device only."
      footer={<Button variant="primary" onClick={() => onOpenChange(false)}>Done</Button>}>
      <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field-label">Theme</legend>
        {(['system', 'dark', 'light'] as const).map((t) => (
          <label key={t} className="checkbox">
            <input type="radio" name="theme" checked={pref === t} onChange={() => {
              if (t === 'system') { try { localStorage.removeItem('atlas.theme'); } catch { /* ignore */ } setTheme(window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'); try { localStorage.removeItem('atlas.theme'); } catch { /* ignore */ } }
              else setTheme(t);
            }} />
            {t === 'system' ? `Match system (${theme})` : t === 'dark' ? 'Dark' : 'Light'}
          </label>
        ))}
      </fieldset>
      <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field-label">Density</legend>
        {(['comfortable', 'compact'] as const).map((d) => (
          <label key={d} className="checkbox"><input type="radio" name="density" checked={density === d} onChange={() => setDensity(d)} />{d === 'comfortable' ? 'Comfortable' : 'Compact'}</label>
        ))}
      </fieldset>
    </Dialog>
  );
}
