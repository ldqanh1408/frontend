import { Command } from 'cmdk';
import * as RD from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { loadSchemas, nav, routes } from '../data/catalog';
import { getAll, type DefinitionRecord, type DocumentRecord } from '../lib/storage';
import type { WorkflowRecord } from '../lib/workflows';
import { setTheme, app } from '../data/app-store';
import { Icon } from '../components/Icon';
import { modulePath } from './Sidebar';
import type { SchemaSpec } from '../data/types';

/** Global search and go-to (APG combobox + listbox via cmdk). Enter opens; Escape restores focus to the invoker. */
export function CommandPalette({ open, onOpenChange, onOpenHelp, onOpenPrefs }: { open: boolean; onOpenChange: (o: boolean) => void; onOpenHelp: () => void; onOpenPrefs: () => void }) {
  const navigate = useNavigate();
  const [schemas, setSchemas] = useState<SchemaSpec[]>([]);
  const [drafts, setDrafts] = useState<DefinitionRecord[]>([]);
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [wfs, setWfs] = useState<WorkflowRecord[]>([]);
  const [q, setQ] = useState('');
  useEffect(() => {
    if (!open) return;
    setQ('');
    loadSchemas().then((s) => setSchemas(s.list)).catch(() => {});
    getAll<DefinitionRecord>('definitions').then((d) => setDrafts(d.filter((x) => !x.archived))).catch(() => {});
    getAll<DocumentRecord>('documents').then((d) => setDocs(d.filter((x) => x.kind === 'document' && !x.archived))).catch(() => {});
    getAll<WorkflowRecord>('workflows').then((d) => setWfs(d.filter((x) => !x.archived))).catch(() => {});
  }, [open]);
  const go = (to: string) => { onOpenChange(false); navigate(to); };
  const run = (fn: () => void) => { onOpenChange(false); fn(); };
  const views = routes.filter((r) => !r.bare);
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="scrim" />
        <RD.Content className="dialog dialog-wide palette" aria-label="Search workspace">
          <RD.Title className="sr-only">Search workspace</RD.Title>
          <RD.Description className="sr-only">Type to search views, definitions, documents and commands. Use arrow keys to choose and Enter to open.</RD.Description>
          <Command label="Search workspace" loop>
            <Command.Input value={q} onValueChange={setQ} placeholder="Search views, definitions, documents and commands…" aria-label="Search workspace" />
            <Command.List>
              <Command.Empty>No matching result. Only device drafts and workspace views are searchable without a service session.</Command.Empty>
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
                  {drafts.slice(0, 50).map((d) => (
                    <Command.Item key={d.id} value={`draft ${d.name} ${d.schemaId}`} onSelect={() => go(`/definitions/${d.schemaId}/${d.id}`)}>
                      <Icon name="file" />{d.name}<span className="palette-detail">device r{d.rev}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {docs.length > 0 && (
                <Command.Group heading="Documents">
                  {docs.slice(0, 50).map((d) => (
                    <Command.Item key={d.id} value={`document ${d.name}`} onSelect={() => go(`/specifications?doc=${encodeURIComponent(d.id)}`)}>
                      <Icon name="file-text" />{d.name}<span className="palette-detail">device r{d.rev}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {wfs.length > 0 && (
                <Command.Group heading="Workflow drafts">
                  {wfs.slice(0, 50).map((w) => (
                    <Command.Item key={w.id} value={`workflow ${w.name}`} onSelect={() => go(`/workflow?wf=${encodeURIComponent(w.id)}`)}>
                      <Icon name="workflow" />{w.name}<span className="palette-detail">{w.tasks.length} tasks · device r{w.rev}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              <Command.Group heading="Commands">
                <Command.Item value="command switch theme" onSelect={() => run(() => setTheme(app.get().theme === 'dark' ? 'light' : 'dark'))}><Icon name="sun" />Switch theme</Command.Item>
                <Command.Item value="command connect service connection" onSelect={() => go('/connection')}><Icon name="plug" />Connect a service</Command.Item>
                <Command.Item value="command new definition browse" onSelect={() => go('/definitions')}><Icon name="plus" />Browse definitions</Command.Item>
                <Command.Item value="command preferences display" onSelect={() => run(onOpenPrefs)}><Icon name="sliders" />Display preferences</Command.Item>
                <Command.Item value="command help keyboard shortcuts" onSelect={() => run(onOpenHelp)}><Icon name="keyboard" />Help and keyboard shortcuts</Command.Item>
              </Command.Group>
            </Command.List>
          </Command>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
