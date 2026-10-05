import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { DocumentRecord } from '../../lib/storage';
import { Icon } from '../../components/Icon';

interface Node { rec: DocumentRecord; level: number; children: Node[] }

function build(all: DocumentRecord[], filter: string): Node[] {
  const kids = new Map<string | null, DocumentRecord[]>();
  for (const d of all) kids.set(d.parentId, [...(kids.get(d.parentId) ?? []), d]);
  const sort = (a: DocumentRecord, b: DocumentRecord) => (a.kind === b.kind ? a.name.localeCompare(b.name, undefined, { numeric: true }) : a.kind === 'folder' ? -1 : 1);
  const needle = filter.trim().toLowerCase();
  const walk = (pid: string | null, level: number): Node[] =>
    (kids.get(pid) ?? []).sort(sort).map((rec) => ({ rec, level, children: rec.kind === 'folder' ? walk(rec.id, level + 1) : [] }))
      .filter((n) => !needle || n.rec.name.toLowerCase().includes(needle) || n.children.length > 0);
  return walk(null, 1);
}

/** APG tree view: roving tabindex, ↑/↓, →/← expand/collapse, Home/End, Enter to open, F2 to rename, type-ahead. */
export function DocTree({ items, selectedId, onSelect, onOpen, onRename, label, filter = '' }: {
  items: DocumentRecord[]; selectedId: string | null; onSelect: (id: string) => void; onOpen: (rec: DocumentRecord) => void; onRename?: (rec: DocumentRecord) => void;
  label: string; filter?: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const tree = useMemo(() => build(items, filter), [items, filter]);
  const refs = useRef(new Map<string, HTMLLIElement>());
  const typed = useRef({ s: '', t: 0 });
  // Reveal the selected item (e.g. opened from search or deep link).
  useEffect(() => {
    if (!selectedId) return;
    const byId = new Map(items.map((d) => [d.id, d]));
    const open: string[] = [];
    for (let p = byId.get(selectedId)?.parentId; p; p = byId.get(p)?.parentId) open.push(p);
    if (open.some((id) => !expanded.has(id))) setExpanded((s) => new Set([...s, ...open]));
  }, [selectedId, items]); // eslint-disable-line react-hooks/exhaustive-deps
  const visible: Node[] = [];
  const parentOf = new Map<string, string | null>();
  const walk = (ns: Node[], pid: string | null) => ns.forEach((n) => { visible.push(n); parentOf.set(n.rec.id, pid); if (n.rec.kind === 'folder' && (expanded.has(n.rec.id) || filter)) walk(n.children, n.rec.id); });
  walk(tree, null);
  const focusId = selectedId && visible.some((n) => n.rec.id === selectedId) ? selectedId : visible[0]?.rec.id;
  const move = (id: string | undefined) => { if (!id) return; onSelect(id); requestAnimationFrame(() => refs.current.get(id)?.focus()); };
  const toggle = (id: string, open?: boolean) => setExpanded((s) => { const n = new Set(s); if (open ?? !n.has(id)) n.add(id); else n.delete(id); return n; });
  const onKey = (e: KeyboardEvent, n: Node) => {
    const i = visible.findIndex((v) => v.rec.id === n.rec.id);
    const isFolder = n.rec.kind === 'folder';
    const open = expanded.has(n.rec.id) || !!filter;
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); move(visible[i + 1]?.rec.id); break;
      case 'ArrowUp': e.preventDefault(); move(visible[i - 1]?.rec.id); break;
      case 'Home': e.preventDefault(); move(visible[0]?.rec.id); break;
      case 'End': e.preventDefault(); move(visible[visible.length - 1]?.rec.id); break;
      case 'ArrowRight':
        e.preventDefault();
        if (isFolder && !open) toggle(n.rec.id, true); else if (isFolder && n.children[0]) move(n.children[0].rec.id);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (isFolder && open && !filter) toggle(n.rec.id, false); else move(parentOf.get(n.rec.id) ?? undefined);
        break;
      case 'Enter': case ' ':
        e.preventDefault();
        if (isFolder) toggle(n.rec.id); else onOpen(n.rec);
        break;
      case 'F2': if (onRename) { e.preventDefault(); onRename(n.rec); } break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const now = Date.now();
          typed.current = { s: (now - typed.current.t < 600 ? typed.current.s : '') + e.key.toLowerCase(), t: now };
          const hit = [...visible.slice(i + 1), ...visible.slice(0, i + 1)].find((v) => v.rec.name.toLowerCase().startsWith(typed.current.s));
          if (hit) move(hit.rec.id);
        }
    }
  };
  if (!visible.length) return null;
  const render = (ns: Node[]) => ns.map((n) => {
    const isFolder = n.rec.kind === 'folder';
    const open = expanded.has(n.rec.id) || !!filter;
    return (
      <li key={n.rec.id} role="treeitem" aria-level={n.level} aria-selected={n.rec.id === selectedId} aria-expanded={isFolder ? open : undefined}
        tabIndex={n.rec.id === focusId ? 0 : -1} ref={(el) => { if (el) refs.current.set(n.rec.id, el); else refs.current.delete(n.rec.id); }}
        onKeyDown={(e) => { e.stopPropagation(); onKey(e, n); }} onFocus={(e) => { if (e.target === e.currentTarget && n.rec.id !== selectedId) onSelect(n.rec.id); }}
        className="tree-item">
        <div className="tree-row" style={{ paddingLeft: 8 + (n.level - 1) * 16 }}
          onClick={() => { onSelect(n.rec.id); if (isFolder) toggle(n.rec.id); else onOpen(n.rec); }}>
          {isFolder ? <Icon name={open ? 'chevron-down' : 'chevron-right'} /> : <span style={{ width: 16 }} aria-hidden="true" />}
          <Icon name={isFolder ? (open ? 'folder-open' : 'folder') : 'file-text'} />
          <span className="grow tree-name">{n.rec.name}</span>
          {n.rec.archived && <span className="caption">archived</span>}
        </div>
        {isFolder && open && n.children.length > 0 && <ul role="group">{render(n.children)}</ul>}
      </li>
    );
  });
  return <ul role="tree" aria-label={label} className="tree">{render(tree)}</ul>;
}
