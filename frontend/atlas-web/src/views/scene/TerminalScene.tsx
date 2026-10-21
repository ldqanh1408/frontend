import { Button, EmptyState, Panel } from '../../components/ui';
import { sceneText, type SceneProps } from './parts';

export default function TerminalScene({ scene }: SceneProps) {
  const reason = scene.disabled[0];
  const blocked = reason ? (__ATLAS_REVIEW__ ? reason.reason : reason.prodReason) : 'Interactive commands require an authorized sandbox session.';
  return <Panel title="Read-only terminal"><div className="panel-pad stack-16" data-scene-template="terminal"><div className="terminal-replay" tabIndex={0} role="region" aria-label={`${sceneText(scene).title} output`}>{__ATLAS_REVIEW__ ? <ol>{scene.rows.map((r, i) => <li key={i}><span className="muted">{i + 1}</span><span className="break">{r.detail}</span></li>)}</ol> : <EmptyState icon="terminal" headingLevel={3} title="No stream received">Not observed — output is scoped to the exact run, task and attempt.</EmptyState>}</div><label className="field-label" htmlFor="terminal-command">Terminal command</label><input id="terminal-command" className="input mono" disabled placeholder="No interactive session" aria-describedby="terminal-blocked" /><Button icon="send" blocked={blocked} reasonId="terminal-blocked">Send terminal command</Button><p id="terminal-blocked" className="caption">{blocked}</p></div></Panel>;
}
