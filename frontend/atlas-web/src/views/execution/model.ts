import { DOMAIN_STATES } from '../../data/states';
export const NODE_TYPES = ['AGENT', 'TOOL', 'MCP', 'SANDBOX', 'TEST', 'CONDITION', 'PARALLEL', 'HUMAN_GATE', 'GOVERNANCE_GATE', 'MEMORY_PREP'] as const;
export type NodeType = typeof NODE_TYPES[number];
export interface ExecutionNode {
  id: string; name: string; type: NodeType; status: string; dependencies: string[];
  agent?: string; attempt?: string; duration?: string; heartbeat?: string; worker?: string; tool?: string; output?: string;
  fileScope?: string[]; snapshot?: string; memory?: string; budget?: string;
}
/** Optional presentation payload from the proposed adapter. Malformed graphs are disclosed, never repaired by guessing. */
export function readExecutionNodes(raw: unknown): { nodes: ExecutionNode[]; error: string | null } {
  if (raw == null) return { nodes: [], error: null };
  if (!Array.isArray(raw) || raw.length > 300) return { nodes: [], error: 'The service graph must contain at most 300 tasks. No graph was inferred.' };
  const nodes: ExecutionNode[] = [];
  for (const value of raw) {
    if (!value || typeof value !== 'object') return { nodes: [], error: 'The service returned an invalid task.' };
    const n = value as Record<string, unknown>;
    if (typeof n.id !== 'string' || !n.id || typeof n.name !== 'string' || typeof n.status !== 'string' || !NODE_TYPES.includes(n.type as NodeType) || !Array.isArray(n.dependencies) || n.dependencies.some(d => typeof d !== 'string')) return { nodes: [], error: 'Task identity, type, state or dependencies are missing.' };
    if (!(DOMAIN_STATES.SubTask as readonly string[]).includes(n.status)) return { nodes: [], error: 'The service returned an unsupported SubTask state. No state was inferred.' };
    const node: ExecutionNode = { id: n.id, name: n.name, type: n.type as NodeType, status: n.status, dependencies: n.dependencies as string[] };
    for (const key of ['agent', 'attempt', 'duration', 'heartbeat', 'worker', 'tool', 'output', 'snapshot', 'memory', 'budget'] as const) if (typeof n[key] === 'string') node[key] = n[key];
    if (Array.isArray(n.fileScope) && n.fileScope.every(p => typeof p === 'string')) node.fileScope = n.fileScope as string[];
    nodes.push(node);
  }
  const ids = new Set(nodes.map(n => n.id));
  if (ids.size !== nodes.length || nodes.some(n => n.dependencies.some(d => !ids.has(d)))) return { nodes: [], error: 'Task identities are duplicate or a dependency is missing.' };
  const sorted: ExecutionNode[] = [];
  const waiting = new Map(nodes.map(n => [n.id, n]));
  while (waiting.size) {
    const ready = [...waiting.values()].filter(n => n.dependencies.every(d => sorted.some(p => p.id === d)));
    if (!ready.length) return { nodes: [], error: 'The service returned cyclic task dependencies.' };
    for (const n of ready) { sorted.push(n); waiting.delete(n.id); }
  }
  return { nodes: sorted, error: null };
}
export function graphLayout(nodes: ExecutionNode[]) {
  // Keep branches and gates readable in the Archive's three-column canvas. Long chains fold down;
  // only presentation positions change, while edges and keyboard order retain the authoritative DAG.
  const placed = new Map<string, { column: number; row: number }>();
  const occupied = new Set<string>();
  return nodes.map(n => {
    const parents = n.dependencies.map(d => placed.get(d)).filter((p): p is { column: number; row: number } => !!p);
    const parentIsGate = n.dependencies.length === 1 && nodes.find(p => p.id === n.dependencies[0])?.type === 'HUMAN_GATE';
    let column = parents.length ? Math.max(...parents.map(p => p.column)) + 1 : 0;
    let row = parents.length ? Math.floor(parents.reduce((sum, p) => sum + p.row, 0) / parents.length) : 0;
    if (parents.length && (n.type === 'HUMAN_GATE' || parentIsGate)) { column = Math.min(...parents.map(p => p.column)); row = Math.max(...parents.map(p => p.row)) + 1; }
    if (column > 2) { column = 2; row = Math.max(...parents.map(p => p.row)) + 1; }
    while (occupied.has(`${column}:${row}`)) row++;
    occupied.add(`${column}:${row}`); placed.set(n.id, { column, row });
    return { node: n, x: column * 248 + 24, y: row * 190 + 24 };
  });
}
