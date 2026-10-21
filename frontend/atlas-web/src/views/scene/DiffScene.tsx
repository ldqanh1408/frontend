import { EmptyState, Panel } from '../../components/ui';
import { SceneFields, type SceneProps } from './parts';

export default function DiffScene({ scene }: SceneProps) {
  return <div className="stack-16" data-scene-template={scene.kind}><div className={`diff-panes ${scene.kind === 'merge' ? 'diff-three' : ''}`}>{(scene.kind === 'merge' ? ['Base', 'Current', 'Incoming'] : ['Base', 'Current']).map(k => <Panel key={k} title={k}><div className="diff-source"><EmptyState icon="compare" headingLevel={3} title="Not observed">An immutable revision and exact file path are required to load this pane.</EmptyState></div></Panel>)}</div><SceneFields scene={scene} /></div>;
}
