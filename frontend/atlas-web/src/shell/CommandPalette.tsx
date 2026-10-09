import { Command, defaultFilter } from 'cmdk';
import * as RD from '@radix-ui/react-dialog';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { loadSchemas, nav, routes } from '../data/catalog';
import { getAll, type DefinitionRecord, type DocumentRecord } from '../lib/storage';
import type { WorkflowRecord } from '../lib/workflows';
import { setTheme, app } from '../data/app-store';
import { Icon } from '../components/Icon';
import { modulePath } from './Sidebar';
import type { SchemaSpec } from '../data/types';

// Filter the entire device collection before bounding rendered rows. Filtering a
// sliced collection makes records after the first 50 impossible to find.
function searchItems<T>(items: T[], query: string, value: (item: T) => string): T[] {
  const search = query.trim();
  if (!search) return items.slice(0, 50);
  return items.map(item => ({ item, score: defaultFilter(value(item), search) }))
    .filter(result => result.score > 0).sort((a, b) => b.score - a.score)
    .slice(0, 50).map(result => result.item);
}
const draftValue = (d: DefinitionRecord) => `draft ${d.name} ${d.schemaId} ${d.id}`;
const documentValue = (d: DocumentRecord) => `document ${d.name} ${d.id}`;
const workflowValue = (w: WorkflowRecord) => `workflow ${w.name} ${w.id}`;

/** Global search and go-to (APG combobox + listbox via cmdk). Enter opens; Escape restores focus to the invoker. */
export function CommandPalette({ open, onOpenChange, onOpenHelp, onOpenPrefs }: { open: boolean; onOpenChange: (o: boolean) => void; onOpenHelp: () => void; onOpenPrefs: () => void }) {
  const navigate = useNavigate();
  const [schemas, setSchemas] = useState<SchemaSpec[]>([]);
  const [drafts, setDrafts] = useState<DefinitionRecord[]>([]);
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [wfs, setWfs] = useState<WorkflowRecord[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [incomplete, setIncomplete] = useState(false);
  const invoker = useRef<HTMLElement | null>(null);
  const restoreFocus = useRef(true);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setQ('');
    setSchemas([]); setDrafts([]); setDocs([]); setWfs([]);
    setLoading(true); setIncomplete(false);
    Promise.allSettled([
      loadSchemas(), getAll<DefinitionRecord>('definitions'),
      getAll<DocumentRecord>('documents'), getAll<WorkflowRecord>('workflows'),
    ]).then(([schemaResult, draftResult, docResult, workflowResult]) => {
      if (cancelled) return;
      if (schemaResult.status === 'fulfilled') setSchemas(schemaResult.value.list);
      if (draftResult.status === 'fulfilled') setDrafts(draftResult.value.filter(x => !x.archived));
      if (docResult.status === 'fulfilled') setDocs(docResult.value.filter(x => x.kind === 'document' && !x.archived));
      if (workflowResult.status === 'fulfilled') setWfs(workflowResult.value.filter(x => !x.archived));
      setIncomplete([schemaResult, draftResult, docResult, workflowResult].some(result => result.status === 'rejected'));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open]);
  const matchingDrafts = useMemo(() => searchItems(drafts, q, draftValue), [drafts, q]);
  const matchingDocs = useMemo(() => searchItems(docs, q, documentValue), [docs, q]);
  const matchingWorkflows = useMemo(() => searchItems(wfs, q, workflowValue), [wfs, q]);
  const go = (to: string) => { restoreFocus.current = false; onOpenChange(false); navigate(to); };
  const run = (fn: () => void, transfersFocus = false) => { restoreFocus.current = !transfersFocus; onOpenChange(false); fn(); };
  const views = routes.filter((r) => !r.bare);
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="scrim" />
        <RD.Content className="dialog dialog-wide palette" aria-label="Search workspace"
          onOpenAutoFocus={() => { invoker.current = document.activeElement as HTMLElement | null; restoreFocus.current = true; }}
          onCloseAutoFocus={event => {
            event.preventDefault();
            if (restoreFocus.current && invoker.current?.isConnected) invoker.current.focus();
          }}>
          <RD.Title className="sr-only">Search workspace</RD.Title>
          <RD.Description className="sr-only">Type to search views, definitions, documents and commands. Use arrow keys to choose and Enter to open.</RD.Description>
          <Command label="Search workspace" loop>
            <Command.Input value={q} onValueChange={setQ} placeholder="Search views, definitions, documents and commands…" aria-label="Search workspace" />
            <div className="palette-scope">Workspace views and device drafts · up to 50 matches per collection</div>
            <div className="palette-feedback" role="status">
              {loading ? 'Loading device drafts…' : incomplete ? 'Some local items could not be loaded. Navigation and commands are still available.' : null}
            </div>
            <Command.List aria-busy={loading}>
              {!loading && <Command.Empty>
                <p>No matching result. Try a view, document or draft name.</p>
                <p className="caption">Service records require an authorized session.</p>
                {q && <button className="btn btn-quiet" onClick={() => setQ('')}>Clear search</button>}
              </Command.Empty>}
              <Command.Group heading="Modules">
                {Object.values(nav.modules).map((m) => (
                  <Command.Item key={m.route} value={`module ${m.label} ${m.title}`} onSelect={() => go(modulePath(m.route))}>
                    <Icon name={m.icon} />{m.label}<span className="palette-detail">{m.title}</span>
                  </Command.Item>
                ))}
              </Command.Group>
              {q.length > 0 && (
                <Command.Group heading="Views">
                  {views.map((r) => (
                    <Command.Item key={r.id} value={`view ${r.title} ${r.id}`} onSelect={() => go(r.route)}>
                      <Icon name={nav.modules[r.module]?.icon ?? 'file'} />{r.title}<span className="palette-detail">{nav.modules[r.module]?.label}{r.kind === 'state' ? ' · state' : ''}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {q.length > 0 && schemas.length > 0 && (
                <Command.Group heading="Definition types">
                  {schemas.map((s) => (
                    <Command.Item key={s.id} value={`definition ${s.title} ${s.id}`} onSelect={() => go(`/definitions/${s.id}`)}>
                      <Icon name="layers" />{s.title}<span className="palette-detail">{nav.modules[s.route]?.label} · {s.fieldCount} fields</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {drafts.length > 0 && (
                <Command.Group heading="Device drafts">
                  {matchingDrafts.map((d) => (
                    <Command.Item key={d.id} value={draftValue(d)} onSelect={() => go(`/definitions/${d.schemaId}/${d.id}`)}>
                      <Icon name="file" /><span className="palette-title">{d.name}</span><span className="palette-detail">device r{d.rev} · {d.id.slice(0, 8)}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {docs.length > 0 && (
                <Command.Group heading="Documents">
                  {matchingDocs.map((d) => (
                    <Command.Item key={d.id} value={documentValue(d)} onSelect={() => go(`/specifications?doc=${encodeURIComponent(d.id)}`)}>
                      <Icon name="file-text" /><span className="palette-title">{d.name}</span><span className="palette-detail">device r{d.rev} · {d.id.slice(0, 8)}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {wfs.length > 0 && (
                <Command.Group heading="Workflow drafts">
                  {matchingWorkflows.map((w) => (
                    <Command.Item key={w.id} value={workflowValue(w)} onSelect={() => go(`/workflow?wf=${encodeURIComponent(w.id)}`)}>
                      <Icon name="workflow" /><span className="palette-title">{w.name}</span><span className="palette-detail">{w.tasks.length} tasks · device r{w.rev} · {w.id.slice(0, 8)}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              <Command.Group heading="Commands">
                <Command.Item value="command switch theme" onSelect={() => run(() => setTheme(app.get().theme === 'dark' ? 'light' : 'dark'))}><Icon name="sun" />Switch theme</Command.Item>
                <Command.Item value="command connect service connection" onSelect={() => go('/connection')}><Icon name="plug" />Connect a service</Command.Item>
                <Command.Item value="command new definition browse" onSelect={() => go('/definitions')}><Icon name="plus" />Browse definitions</Command.Item>
                <Command.Item value="command preferences display" onSelect={() => run(onOpenPrefs, true)}><Icon name="sliders" />Display preferences</Command.Item>
                <Command.Item value="command help keyboard shortcuts" onSelect={() => run(onOpenHelp, true)}><Icon name="keyboard" />Help and keyboard shortcuts</Command.Item>
              </Command.Group>
            </Command.List>
            <div className="palette-shortcuts" aria-label="Search keyboard shortcuts">
              <span><kbd>↑ ↓</kbd> Choose</span><span><kbd>Enter</kbd> Open</span><span><kbd>Esc</kbd> Close</span>
            </div>
          </Command>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
