import { Badge, Button, EmptyState, Panel } from '../../components/ui';
import { SceneFields, structuralRows, sceneText, type SceneProps } from './parts';

export default function TableScene({ scene, onAction }: SceneProps) {
  const rows = structuralRows(scene);
  return <div className="stack-16" data-scene-template="table"><SceneFields scene={scene} /><Panel title="Records"><div className="table-wrap"><table className="table scene-table"><caption className="sr-only">{sceneText(scene).title} records</caption><thead><tr>{['Item', 'Detail', 'Status', 'Open'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{rows.length ? rows.map((r, i) => <tr key={i}><th scope="row" className="break">{__ATLAS_REVIEW__ ? r.label : r.prodLabel}</th><td className="break">{__ATLAS_REVIEW__ ? r.detail : 'Not observed'}</td><td><Badge>{__ATLAS_REVIEW__ ? r.status : 'Not observed'}</Badge></td><td>{__ATLAS_REVIEW__ && r.target ? <Button compact onClick={() => onAction(r.target!, 'scene')}>Open</Button> : <span className="caption">Not observed</span>}</td></tr>) : <tr><td colSpan={4}><EmptyState headingLevel={3} title="No authorized records loaded">Connect a service to load records for the selected scope.</EmptyState></td></tr>}</tbody></table></div></Panel></div>;
}
