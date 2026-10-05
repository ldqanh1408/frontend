import { Link, useParams } from 'react-router';
import type { ModuleRoute } from '../../data/types';
import { loadSchemas, nav } from '../../data/catalog';
import { DRAFT_MODULES } from '../../data/module-specs';
import { useAsync } from '../../lib/hooks';
import { PageHeader, Spinner } from '../../components/ui';
import { usePageMeta } from '../../shell/page-meta';
import { ProvenanceBanner, NotFound } from '../shared';
import { DefinitionWorkspace } from '../definitions/DefinitionWorkspace';
import { LifecycleChain, ModuleViews, OperationReceipts } from './common';

/** Device-draft module (Figma agents/resources/memory/configuration): local drafts with complete field checks; lifecycle via service. */
export default function DraftModulePage({ module }: { module: ModuleRoute }) {
  const m = nav.modules[module];
  const spec = DRAFT_MODULES[module]!;
  const { schemaId = spec.schemas[0], defId } = useParams();
  const { data } = useAsync(loadSchemas, []);
  const schema = data?.byId.get(schemaId);
  usePageMeta(m.title, [{ label: m.label, to: `/${module}` }, ...(schema && spec.schemas.length > 1 ? [{ label: schema.title }] : [])]);
  if (data && (!schema || !spec.schemas.includes(schemaId))) return <NotFound />;
  return (
    <div className="page">
      <PageHeader eyebrow={m.label} title={m.title} purpose={m.purpose} />
      <ProvenanceBanner detail={spec.note} />
      {spec.schemas.length > 1 && data && (
        <nav aria-label={`${m.label} types`} className="chip-row">
          {spec.schemas.map((id) => {
            const s = data.byId.get(id)!;
            return <Link key={id} to={`/${module}/drafts/${id}`} className="chip" aria-current={id === schemaId ? 'page' : undefined}>{s.title}</Link>;
          })}
        </nav>
      )}
      {!schema ? <Spinner label="Loading definition type" /> : (
        <DefinitionWorkspace key={schema.id} schema={schema} defId={defId} basePath={`/${module}/drafts/${schema.id}`} embedded />
      )}
      <div className="split">
        <LifecycleChain states={null} ids={spec.lifecycleIds} label={m.title} />
        <OperationReceipts module={module} />
      </div>
      <ModuleViews module={module} />
    </div>
  );
}
