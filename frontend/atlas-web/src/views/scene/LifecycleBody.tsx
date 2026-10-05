import { Link } from 'react-router';
import type { Scene } from '../../data/types';
import { loadLifecycles } from '../../data/catalog';
import { useAsync } from '../../lib/hooks';
import { Badge, Banner, KeyValue, Panel, Spinner } from '../../components/ui';
import { modulePath } from '../../shell/Sidebar';
import { nav } from '../../data/catalog';
import type { ModuleRoute } from '../../data/types';

/** Lifecycle reference (LC-xx): proposed states, what is enabled/disabled and why, evidence, recovery and retirement rules. */
export default function LifecycleBody({ scene }: { scene: Scene }) {
  const id = scene.key.replace(/^lifecycle-/, '');
  const { data, error } = useAsync(loadLifecycles, []);
  if (error) return <Banner tone="danger" title="Lifecycle table unavailable" role="alert">{error}</Banner>;
  if (!data) return <Spinner label="Loading lifecycle" />;
  const lc = data[id];
  const states = lc?.states.map((s) => s.name) ?? (Array.isArray(scene.lifecycleStates) ? (scene.lifecycleStates as string[]) : []);
  const mod = lc && (lc.module in nav.modules) ? (lc.module as ModuleRoute) : null;
  return (
    <>
      <Panel title="Proposed states" actions={<Badge tone="warning">Contract review</Badge>}>
        <div className="panel-pad stack-12">
          <ol className="lifecycle-chain" aria-label={`${lc?.entity ?? scene.entity} states`}>
            {states.map((s, i) => <li key={`${s}-${i}`}><span className="badge">{s}</span></li>)}
          </ol>
          {lc && <p className="caption">{lc.chain}</p>}
          <p className="caption">State names are normalized design samples. Exact server enums, guard order and authority come from the service contract.</p>
        </div>
      </Panel>
      {lc && (
        <Panel title="Rules">
          <div className="panel-pad">
            <KeyValue items={[
              ['Enabled without service', lc.enabled],
              ['Requires service', lc.disabled],
              ['Why', lc.reason],
              ['Evidence', lc.evidence],
              ['Recovery', lc.recovery],
              ['Invalidated by', lc.invalidation],
              ['Retirement', lc.retirement],
              ['Module', mod ? <Link to={modulePath(mod)}>{nav.modules[mod].label}</Link> : lc.module],
            ]} />
          </div>
        </Panel>
      )}
    </>
  );
}
