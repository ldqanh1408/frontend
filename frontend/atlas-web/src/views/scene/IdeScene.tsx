import type { ReactNode } from 'react';
import { Badge, EmptyState, Panel } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { EvidenceTabs, SceneFields, sceneText, type SceneProps } from './parts';

export default function IdeScene({ scene, onAction, inspector }: SceneProps & { inspector: ReactNode }) {
  const t = sceneText(scene);
  return <div className="ide scene-ide" data-scene-template="ide">
    <Panel title="Explorer" className="ide-side"><div className="panel-pad stack-12">{__ATLAS_REVIEW__ && scene.pins.length ? <ul className="scene-paths" role="list">{scene.pins.map((p, i) => <li key={i}><Icon name="file" /><span className="mono break">{p}</span></li>)}</ul> : <EmptyState icon="folder" headingLevel={3} title="No source tree loaded">Not observed — the source tree comes from the authorized service.</EmptyState>}</div></Panel>
    <div className="ide-main stack-16"><Panel title={<span className="row"><Icon name="file-text" /><span className="break">{t.entity}</span></span>} actions={<Badge>{t.state}</Badge>}><div className="scene-editor" role="region" aria-label="Read-only source"><div className="scene-gutter" aria-hidden="true">{__ATLAS_REVIEW__ ? '1\n2\n3\n4\n5\n6' : '—'}</div><div className="scene-editor-content">{__ATLAS_REVIEW__ ? <div className="stack-16"><Badge tone="warning">Illustrative</Badge><p>{t.copy}</p></div> : <EmptyState icon="code" headingLevel={3} title="No source received">Not observed — select an authorized revision to inspect its source.</EmptyState>}</div></div></Panel><SceneFields scene={scene} /><EvidenceTabs scene={scene} onAction={onAction} /></div>
    {inspector}
  </div>;
}
