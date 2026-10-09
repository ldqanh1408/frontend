import { Badge, Panel } from '../../components/ui';
import { SceneFields, EvidenceTabs, sceneText, type SceneProps } from './parts';
import { statePresentation } from '../../data/states';

export default function ReviewScene({ scene, onAction }: SceneProps) {
  const t = sceneText(scene);
  return <div className="stack-16" data-scene-template="review"><Panel title="Decision summary"><div className="panel-pad stack-12"><div className="row-between"><strong className="break">{t.entity}</strong><Badge>{t.state}</Badge></div><p className="secondary">{t.copy}</p><p className="caption">Safe next step: {statePresentation(t.state).next}</p>{scene.selectedTask != null && <div className="scene-selected"><span className="eyebrow">Selected task</span><p className="mono break">{__ATLAS_REVIEW__ ? JSON.stringify(scene.selectedTask) : 'Not observed'}</p></div>}</div></Panel><SceneFields scene={scene} /><EvidenceTabs scene={scene} onAction={onAction} /></div>;
}
