import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import { loadSchemas } from '../../data/catalog';
import { useAsync } from '../../lib/hooks';
import { Banner, Button, Panel, Spinner } from '../../components/ui';
import { DefinitionForm } from './DefinitionForm';
import { initialValues, validateAll, type Errors, type FormValue, type FormValues } from './validate';

/**
 * The typed input a scene asks for (e.g. run admission, checkpoint decision), rendered from the field dictionary.
 * Local checks only: sending the request requires an authorized service command, so nothing here is submitted.
 */
export default function SchemaSceneForm({ schemaId, sceneTitle }: { schemaId: string; sceneTitle: string }) {
  const { data, error } = useAsync(loadSchemas, []);
  const schema = data?.byId.get(schemaId);
  const [values, setValues] = useState<FormValues | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [checked, setChecked] = useState(false);
  const onChange = useCallback((k: string, v: FormValue) => setValues((s) => ({ ...(s ?? {}), [k]: v })), []);
  if (error) return <Banner tone="danger" title="Field schema unavailable" role="alert">{error}</Banner>;
  if (!schema) return data ? <Banner tone="warning" title="No field schema">This scene references {schemaId}, which is not in the field dictionary.</Banner> : <Spinner label="Loading fields" />;
  const vals = values ?? initialValues(schema);
  const open = Object.keys(errors).length;
  return (
    <Panel title={`${schema.title} input`} actions={<Link className="caption" to={`/definitions/${schema.id}`}>Save as device draft</Link>}>
      <div className="panel-pad stack-16">
        <p className="caption">Input for “{sceneTitle}”. Values are checked locally against the {schema.title.toLowerCase()} field dictionary and are not sent anywhere.</p>
        <DefinitionForm schema={schema} values={vals} errors={errors} onChange={onChange} prefix={`scene-${schema.id}`} showSummary={checked} />
        <div className="row">
          <Button icon="success" onClick={() => { setErrors(validateAll(schema, vals, true)); setChecked(true); }}>Check input</Button>
          {checked && <span role="status" className="caption">{open ? `${open} field${open === 1 ? '' : 's'} need attention.` : 'Local field checks passed. Service validation has not run.'}</span>}
        </div>
      </div>
    </Panel>
  );
}
