import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { ReactFlow, Background, Handle, Position, MarkerType, type Node, type NodeProps, type ReactFlowInstance } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from './ui';
export interface GraphItem { id: string; label: string; x: number; y: number; dependencies: string[]; content: ReactNode; selected?: boolean; error?: boolean }
type TaskNode = Node<{ item: GraphItem; onOpen: (id: string) => void }, 'atlas'>;
function AtlasNode({ data }: NodeProps<TaskNode>) {
  return <>
    <Handle type="target" position={Position.Left} isConnectable={false} />
    <button className="execution-node nodrag" aria-label={data.item.label} aria-pressed={data.item.selected} data-error={data.item.error || undefined} onClick={() => data.onOpen(data.item.id)}>{data.item.content}</button>
    <Handle type="source" position={Position.Right} isConnectable={false} />
  </>;
}
const nodeTypes = { atlas: AtlasNode };
/** Presentation-only DAG. Editing dependencies and running commands use explicit dialogs, never drag gestures. */
export default function TaskGraph({ items, onOpen, label }: { items: GraphItem[]; onOpen: (id: string) => void; label: string }) {
  const api = useRef<ReactFlowInstance<TaskNode> | null>(null);
  const layoutKey = items.map(n => `${n.id}:${n.x}:${n.y}`).join('|');
  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => { void api.current?.fitView({ padding: 0.08, maxZoom: 1 }); }); });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [layoutKey]);
  const nodes = useMemo(() => items.map(item => ({ id: item.id, type: 'atlas' as const, data: { item, onOpen }, position: { x: item.x, y: item.y }, draggable: false, selectable: false, focusable: false, ariaRole: 'group' as const, style: { pointerEvents: 'all' as const } })), [items, onOpen]);
  const ids = new Set(items.map(n => n.id));
  const edges = items.flatMap(n => n.dependencies.filter(d => ids.has(d)).map(d => ({ id: `${d}-${n.id}`, source: d, target: n.id, type: 'smoothstep', focusable: false, markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--color-muted)' }, style: { stroke: 'var(--color-muted)', strokeWidth: 1.5 } })));
  return <div className="task-flow" role="region" aria-label={label} tabIndex={0}>
    <ReactFlow<TaskNode> nodes={nodes} edges={edges} nodeTypes={nodeTypes} nodesDraggable={false} nodesConnectable={false} edgesFocusable={false} nodesFocusable={false} elementsSelectable={false} onInit={flow => { api.current = flow; }} fitView fitViewOptions={{ padding: 0.08, maxZoom: 1 }} minZoom={0.25} maxZoom={1.5} preventScrolling={false} deleteKeyCode={null}>
      <Background color="var(--color-border)" gap={24} />
    </ReactFlow>
    <div className="execution-graph-controls"><Button compact iconOnly icon="minus" onClick={() => void api.current?.zoomOut()}>Zoom out</Button><Button compact iconOnly icon="plus" onClick={() => void api.current?.zoomIn()}>Zoom in</Button><Button compact onClick={() => void api.current?.fitView({ padding: 0.08, maxZoom: 1 })}>Fit graph</Button><span className="caption">Use List for complete keyboard review.</span></div>
  </div>;
}
