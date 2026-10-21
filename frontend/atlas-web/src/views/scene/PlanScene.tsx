import { Badge, EmptyState, Panel } from '../../components/ui';
import { structuralRows, SceneFields, type SceneProps } from './parts';

export default function PlanScene({ scene }: SceneProps) {
  const rows = structuralRows(scene);
  return <div className="stack-16" data-scene-template="plan"><Panel title="Task dependencies"><div className="table-wrap"><table className="table scene-table"><caption className="sr-only">Task identities, dependencies and human checkpoints</caption><thead><tr>{['Task', 'Depends on', 'Checkpoint', 'Status'].map(k => <th key={k} scope="col">{k}</th>)}</tr></thead><tbody>{rows.length ? rows.map((r, i) => <tr key={i}><th scope="row">{__ATLAS_REVIEW__ ? r.label : r.prodLabel}</th><td className="break">{__ATLAS_REVIEW__ ? r.detail : 'Not observed'}</td><td>Not observed</td><td><Badge>{__ATLAS_REVIEW__ ? r.status : 'Not observed'}</Badge></td></tr>) : <tr><td colSpan={4}><EmptyState icon="workflow" headingLevel={3} title="No approved task plan loaded">The service must return the proposed DAG before a person can approve execution.</EmptyState></td></tr>}</tbody></table></div></Panel><SceneFields scene={scene} /></div>;
}
