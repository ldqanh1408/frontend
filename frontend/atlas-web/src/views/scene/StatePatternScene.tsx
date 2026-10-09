import { Badge, Panel } from '../../components/ui';
import { statePresentation } from '../../data/states';
import { sceneText, type SceneProps } from './parts';

export default function StatePatternScene({ scene }: SceneProps) {
  const t = sceneText(scene);
  const blocks = [{ title: 'State', content: <Badge>{t.state}</Badge> }, { title: 'Meaning', content: t.copy }, { title: 'Safe next step', content: statePresentation(t.state).next }, { title: 'Blocked', content: scene.disabled.length ? scene.disabled.map((d, i) => <p key={i}><strong>{__ATLAS_REVIEW__ ? d.label : d.prodLabel}:</strong> {__ATLAS_REVIEW__ ? d.reason : d.prodReason}</p>) : 'Protected actions require current grants and authoritative evidence.' }, { title: 'Recovery', content: 'Inspect the current state and reconcile the original operation before trying again.' }];
  return <div className="state-pattern-grid" data-scene-template="statepattern">{blocks.map(b => <Panel key={b.title} title={b.title}><div className="panel-pad secondary">{b.content}</div></Panel>)}</div>;
}
