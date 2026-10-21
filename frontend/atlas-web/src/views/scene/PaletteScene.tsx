import { Button, Panel } from '../../components/ui';
import { RowsList, type SceneProps } from './parts';

export default function PaletteScene({ scene, onAction }: SceneProps) {
  return <Panel title="Search workspace"><div className="panel-pad stack-12" data-scene-template="palette"><label className="field-label" htmlFor="scene-search">Search authorized resources</label><input id="scene-search" className="input" readOnly value="" placeholder="Open the command palette to search" /><Button icon="search" onClick={() => window.dispatchEvent(new CustomEvent('atlas:open-search'))}>Open command palette</Button><p className="caption">Ctrl K / ⌘ K opens the same workspace search.</p></div><RowsList scene={scene} onAction={onAction} /></Panel>;
}
