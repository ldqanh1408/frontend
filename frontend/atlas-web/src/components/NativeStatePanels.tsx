import type { ReactNode } from 'react';
import { KeyValue, Panel } from './ui';

export interface StateDefinition {
  panels: { title: string; rows: { label: string; example: string }[] }[];
  scope: { label: string; example: string }[];
}

/** Design-only layout shared by the two entries; it has no session, data or command imports. */
export function NativeStatePanels({ definition, value, progress, scopeExtra, actions, back }: {
  definition: StateDefinition;
  value: (label: string, example: string) => string;
  progress?: ReactNode;
  scopeExtra?: ReactNode;
  actions: ReactNode;
  back: ReactNode;
}) {
  return <div className="native-state-grid">
    <div className="stack-12">{progress}{definition.panels.map(panel => <Panel key={panel.title} title={panel.title}>
      <div className="panel-pad"><KeyValue items={panel.rows.map(row => [row.label, value(row.label, row.example)])} /></div>
    </Panel>)}</div>
    <aside className="stack-12">
      <Panel title="Scope and lifecycle"><div className="panel-pad"><KeyValue items={definition.scope.map(row => [row.label, value(row.label, row.example)])} />{scopeExtra}</div></Panel>
      <Panel title="Available actions"><div className="panel-pad stack-12">{actions}</div></Panel>
      {back}
    </aside>
  </div>;
}
