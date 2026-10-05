import { useParams } from 'react-router';
import { loadSchemas, nav } from '../../data/catalog';
import { useAsync } from '../../lib/hooks';
import { usePageMeta } from '../../shell/page-meta';
import { Spinner } from '../../components/ui';
import { NotFound } from '../shared';
import { DefinitionWorkspace } from './DefinitionWorkspace';

export default function DefinitionTypePage() {
  const { schemaId = '', defId } = useParams();
  const { data, error } = useAsync(loadSchemas, []);
  const schema = data?.byId.get(schemaId);
  usePageMeta(schema?.title ?? 'Definitions', [{ label: 'Definitions', to: '/definitions' }, ...(schema ? [{ label: schema.title }] : [])]);
  if (error) return <div className="page"><p role="alert">{error}</p></div>;
  if (!data) return <div className="page"><Spinner label="Loading definition type" /></div>;
  if (!schema) return <NotFound />;
  return (
    <div className="page">
      <DefinitionWorkspace schema={schema} defId={defId} basePath={`/definitions/${schema.id}`} headingLevel={1} />
      <p className="caption">Owning module: {nav.modules[schema.route]?.label}. Figma {schema.figmaModule}.</p>
    </div>
  );
}
