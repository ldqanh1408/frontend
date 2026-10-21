import { HubPanel, MemoryPanel } from './ArchivePanels';
import { ConfigurationResolution } from './ConfigurationResolution';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { ModuleRoute } from '../../data/types';
import { loadSchemas, nav } from '../../data/catalog';
import { DRAFT_MODULES } from '../../data/module-specs';
import { toast } from '../../data/app-store';
import { createDefinition } from '../../lib/definitions';
import { useAsync } from '../../lib/hooks';
import { Button, PageHeader, Spinner } from '../../components/ui';
import { usePageMeta } from '../../shell/page-meta';
import { ProvenanceBanner, NotFound } from '../shared';
import { DraftWorkbench } from './DraftWorkbench';
import { LifecycleChain, ModuleViews, OperationReceipts } from './common';

/** Device-draft module (Figma Atlas/<Theme>/agents|resources|memory|configuration). */
export default function DraftModulePage({ module }: { module: ModuleRoute }) {
  const m = nav.modules[module];
  const spec = DRAFT_MODULES[module]!;
  const navigate = useNavigate();
  const { schemaId = spec.schemas[0], defId } = useParams();
  const { data } = useAsync(loadSchemas, []);
  const schema = data?.byId.get(schemaId);
  const [busy, setBusy] = useState(false);
  usePageMeta(m.title, [{ label: m.label, to: `/${module}` }, ...(schema && spec.schemas.length > 1 ? [{ label: schema.title }] : [])]);
  if (data && (!schema || !spec.schemas.includes(schemaId))) return <NotFound />;
  const basePath = `/${module}/drafts/${schemaId}`;
  const onCreate = async () => {
    if (!schema) return;
    setBusy(true);
    try {
      const rec = await createDefinition(schema);
      toast({ tone: 'success', title: 'Device draft created', body: `${rec.name} · device revision 1. Not published to any service.` });
      navigate(`${basePath}/${rec.id}`);
    } catch (e) {
      toast({ tone: 'danger', title: 'Could not create the draft', body: e instanceof Error ? e.message : String(e) });
    } finally { setBusy(false); }
  };
  return (
    <div className="page">
      <PageHeader title={m.title} purpose={m.purpose} actions={<>
        <a className="btn" href="#service-lifecycle">Service lifecycle</a>
        <Button variant="primary" icon="plus" onClick={onCreate} disabled={busy || !schema}>{spec.newLabel}</Button>
      </>} />
      <ProvenanceBanner detail={spec.note} />
      {spec.schemas.length > 1 && data && (
        <nav aria-label={`${m.label} types`} className="chip-row">
          {spec.schemas.map((id) => <Link key={id} to={`/${module}/drafts/${id}`} className="chip" aria-current={id === schemaId ? 'page' : undefined}>{data.byId.get(id)!.title}</Link>)}
        </nav>
      )}
      {!schema ? <div className="workbench-placeholder"><Spinner label="Loading definition type" /></div> : (
        <DraftWorkbench key={schema.id} module={module} spec={spec} schema={schema} defId={defId} basePath={basePath} onCreate={onCreate} busy={busy} />
      )}
      <div className="split" id="service-lifecycle">
        <LifecycleChain states={null} ids={spec.lifecycleIds} label={m.title} />
        <OperationReceipts module={module} />
      </div>
      {module === 'configuration' && <ConfigurationResolution />}
      {(module === 'resources' || module === 'agents') && <HubPanel/>}
      {module === 'memory' && <MemoryPanel/>}
      <ModuleViews module={module} />
    </div>
  );
}
