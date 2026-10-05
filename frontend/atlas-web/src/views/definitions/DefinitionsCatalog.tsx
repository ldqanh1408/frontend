import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { loadSchemas, nav } from '../../data/catalog';
import { getAll, type DefinitionRecord } from '../../lib/storage';
import { useAsync, useDeviceQuery } from '../../lib/hooks';
import { Badge, PageHeader, Panel, Spinner } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { usePageMeta } from '../../shell/page-meta';
import { ProvenanceBanner } from '../shared';
import type { ModuleRoute, SchemaSpec } from '../../data/types';

/** Unified definition catalogue (Figma "Unified definition catalogue"): every typed definition, grouped by owning module. */
export default function DefinitionsCatalog() {
  usePageMeta('Definitions', [{ label: 'Definitions' }]);
  const { data: schemas, error } = useAsync(loadSchemas, []);
  const { data: counts } = useDeviceQuery(async () => {
    const all = await getAll<DefinitionRecord>('definitions');
    const c: Record<string, number> = {};
    for (const d of all) if (!d.archived) c[d.schemaId] = (c[d.schemaId] ?? 0) + 1;
    return c;
  }, [], {} as Record<string, number>);
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    if (!schemas) return [];
    const needle = q.trim().toLowerCase();
    const order = nav.groups.flatMap((g) => g.routes);
    const by = new Map<ModuleRoute, SchemaSpec[]>();
    for (const s of schemas.list) {
      if (needle && !`${s.title} ${s.purpose} ${s.id}`.toLowerCase().includes(needle)) continue;
      by.set(s.route, [...(by.get(s.route) ?? []), s]);
    }
    return order.filter((r) => by.has(r)).map((r) => ({ route: r, items: by.get(r)! }));
  }, [schemas, q]);
  const total = schemas?.list.length ?? 0;
  const fields = schemas?.list.reduce((n, s) => n + s.fieldCount, 0) ?? 0;
  const drafts = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <div className="page">
      <PageHeader eyebrow="Workspace" title="Definitions" purpose={`${total} definition types · ${fields} typed fields. Author device drafts with complete field checks, then publish through a connected service.`} />
      <ProvenanceBanner />
      <div className="row-between">
        <div className="field" style={{ minWidth: 'min(100%, 360px)' }}>
          <label className="field-label" htmlFor="def-cat-find">Find a definition type</label>
          <input id="def-cat-find" className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Agent, routing, budget…" />
        </div>
        <Badge tone={drafts ? 'accent' : 'neutral'}>{drafts} local {drafts === 1 ? 'draft' : 'drafts'}</Badge>
      </div>
      {error ? <p role="alert">{error}</p> : !schemas ? <Spinner label="Loading definition types" /> : groups.length === 0 ? (
        <p className="secondary" role="status">No definition type matches “{q}”.</p>
      ) : groups.map((g) => (
        <Panel key={g.route} title={<span className="row" style={{ gap: 8 }}><Icon name={nav.modules[g.route].icon} />{nav.modules[g.route].label}</span>} actions={<span className="caption">{g.items.length} {g.items.length === 1 ? 'type' : 'types'}</span>}>
          <ul className="def-grid" role="list">
            {g.items.map((s) => (
              <li key={s.id}>
                <Link className="def-card" to={`/definitions/${s.id}`}>
                  <span className="row-between" style={{ gap: 8 }}>
                    <span className="label">{s.title}</span>
                    {counts[s.id] ? <Badge tone="accent">{counts[s.id]} {counts[s.id] === 1 ? 'draft' : 'drafts'}</Badge> : null}
                  </span>
                  <span className="caption clamp-2">{s.purpose}</span>
                  <span className="caption">{s.fieldCount} fields · {s.groups.length} sections</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ))}
    </div>
  );
}
