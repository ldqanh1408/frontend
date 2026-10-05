import { useEffect, useMemo, useState } from 'react';
import { Dialog } from '../../components/overlays';
import { Badge, Button } from '../../components/ui';
import { getAll, type DefinitionRecord, type RevisionRecord } from '../../lib/storage';
import { loadSchemas } from '../../data/catalog';

export interface Pin { id: string; kind: string; rev: number; hash: string }
interface Option { pin: Pin; name: string; kindTitle: string }

/** Picks exact saved revisions (id + kind + rev + sha256). Only saved device revisions can be pinned — never an unsaved draft. */
export function PinPicker({ open, onOpenChange, onPick, excludeId }: { open: boolean; onOpenChange: (o: boolean) => void; onPick: (pins: Pin[]) => void; excludeId?: string }) {
  const [options, setOptions] = useState<Option[] | null>(null);
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      const [defs, revs, schemas] = await Promise.all([getAll<DefinitionRecord>('definitions'), getAll<RevisionRecord>('revisions'), loadSchemas()]);
      const latest = new Map(revs.map((r) => [`${r.defId}@${r.rev}`, r]));
      const out: Option[] = [];
      for (const d of defs) {
        if (d.id === excludeId || d.archived) continue;
        const r = latest.get(`${d.id}@${d.rev}`);
        if (!r) continue;
        out.push({ pin: { id: d.id, kind: d.schemaId, rev: r.rev, hash: r.hash }, name: d.name, kindTitle: schemas.byId.get(d.schemaId)?.title ?? d.schemaId });
      }
      out.sort((a, b) => a.kindTitle.localeCompare(b.kindTitle) || a.name.localeCompare(b.name));
      if (alive) setOptions(out);
    })();
    return () => { alive = false; };
  }, [open, excludeId]);
  const kinds = useMemo(() => [...new Map((options ?? []).map((o) => [o.pin.kind, o.kindTitle])).entries()], [options]);
  const visible = (options ?? []).filter((o) => (!kind || o.pin.kind === kind) && o.name.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} wide title="Select saved revisions"
      description="Pins reference an exact saved device revision by id, type, revision and SHA-256. Later edits do not change a pin."
      footer={<>
        <Button onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button variant="primary" disabled={sel.size === 0} onClick={() => onPick((options ?? []).filter((o) => sel.has(o.pin.id)).map((o) => o.pin))}>
          Pin {sel.size || ''} {sel.size === 1 ? 'revision' : 'revisions'}
        </Button>
      </>}>
      <div className="stack-12">
        <div className="row">
          <div className="field grow">
            <label className="field-label" htmlFor="pin-find">Find</label>
            <input id="pin-find" className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="field grow">
            <label className="field-label" htmlFor="pin-kind">Definition type</label>
            <select id="pin-kind" className="select" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">All types</option>
              {kinds.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
          </div>
        </div>
        {options === null ? <p className="caption" role="status">Loading saved revisions…</p> : visible.length === 0 ? (
          <p className="caption">{options.length === 0 ? 'No saved definitions on this device yet. Save a definition first, then pin its revision.' : 'No saved revision matches.'}</p>
        ) : (
          <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="sr-only">Saved revisions</legend>
            {visible.map((o) => (
              <label key={o.pin.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                <input type="checkbox" checked={sel.has(o.pin.id)} onChange={() => toggle(o.pin.id)} />
                <span className="grow stack" style={{ gap: 2 }}>
                  <span className="label break">{o.name}</span>
                  <span className="caption mono break">r{o.pin.rev} · {o.pin.hash.slice(0, 16)}…</span>
                </span>
                <Badge>{o.kindTitle}</Badge>
              </label>
            ))}
          </fieldset>
        )}
      </div>
    </Dialog>
  );
}
