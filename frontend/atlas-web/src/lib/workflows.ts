import { isValidName, newId } from './ids';
import { getAll, putVersioned } from './storage';
import type { Pin } from '../views/definitions/PinPicker';

/** Device-local workflow drafts: a versioned task graph. Local validation is not admission (no grants, budget or runtime checked). */
export interface WfTask { id: string; title: string; agent: Pin | null; dependsOn: string[]; checkpoint: boolean; instructions: string; output: string }
export interface WfInput { name: string; type: 'text' | 'number' | 'boolean' | 'document' | 'repository'; required: boolean }
export interface WorkflowRecord { id: string; name: string; rev: number; archived: boolean; tasks: WfTask[]; inputs: WfInput[]; createdAt: string; updatedAt: string }

export const listWorkflows = async () => (await getAll<WorkflowRecord>('workflows')).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

export async function createWorkflow(name: string): Promise<WorkflowRecord> {
  const err = isValidName(name);
  if (err) throw new Error(err);
  const now = new Date().toISOString();
  const rec: WorkflowRecord = { id: newId('wf'), name: name.trim(), rev: 1, archived: false, tasks: [], inputs: [], createdAt: now, updatedAt: now };
  return putVersioned('workflows', rec, 0);
}

export async function saveWorkflow(rec: WorkflowRecord, patch: Partial<Pick<WorkflowRecord, 'name' | 'tasks' | 'inputs' | 'archived'>>): Promise<WorkflowRecord> {
  if (patch.name !== undefined) { const err = isValidName(patch.name); if (err) throw new Error(err); }
  const next = { ...rec, ...patch, name: patch.name?.trim() ?? rec.name, rev: rec.rev + 1, updatedAt: new Date().toISOString() };
  return putVersioned('workflows', next, rec.rev);
}

export function nextTaskId(tasks: WfTask[]) {
  const n = tasks.reduce((m, t) => Math.max(m, Number(t.id.replace(/\D/g, '')) || 0), 0) + 1;
  return `T-${String(n).padStart(2, '0')}`;
}

export interface Issue { level: 'error' | 'warning'; task: string | null; message: string }

/** Local graph validation: structure only. */
export function validateWorkflow(tasks: WfTask[], inputs: WfInput[] = []): Issue[] {
  const issues: Issue[] = [];
  if (!tasks.length) issues.push({ level: 'error', task: null, message: 'Add at least one task.' });
  const ids = new Set(tasks.map((t) => t.id));
  const titles = new Map<string, number>();
  for (const t of tasks) {
    if (!t.title.trim()) issues.push({ level: 'error', task: t.id, message: `${t.id} needs a title.` });
    titles.set(t.title.trim().toLowerCase(), (titles.get(t.title.trim().toLowerCase()) ?? 0) + 1);
    if (!t.agent) issues.push({ level: 'error', task: t.id, message: `${t.id} has no pinned agent revision.` });
    for (const d of t.dependsOn) {
      if (d === t.id) issues.push({ level: 'error', task: t.id, message: `${t.id} depends on itself.` });
      else if (!ids.has(d)) issues.push({ level: 'error', task: t.id, message: `${t.id} depends on missing task ${d}.` });
    }
    if (!t.output.trim()) issues.push({ level: 'warning', task: t.id, message: `${t.id} has no output contract; downstream tasks cannot verify its result.` });
    if (t.checkpoint && !t.instructions.trim()) issues.push({ level: 'warning', task: t.id, message: `${t.id} is a human checkpoint without reviewer instructions.` });
  }
  for (const [title, n] of titles) if (title && n > 1) issues.push({ level: 'warning', task: null, message: `${n} tasks share the title “${title}”.` });
  for (const cycle of findCycles(tasks)) issues.push({ level: 'error', task: cycle[0], message: `Cycle: ${[...cycle, cycle[0]].join(' → ')}.` });
  if (tasks.length > 1) {
    const used = new Set(tasks.flatMap((t) => t.dependsOn));
    for (const t of tasks) if (!t.dependsOn.length && !used.has(t.id)) issues.push({ level: 'warning', task: t.id, message: `${t.id} is not connected to any other task.` });
  }
  const names = new Set<string>();
  for (const i of inputs) {
    if (!/^[a-zA-Z][\w-]{0,63}$/.test(i.name)) issues.push({ level: 'error', task: null, message: `Input “${i.name}” needs a name of letters, digits, - or _.` });
    if (names.has(i.name)) issues.push({ level: 'error', task: null, message: `Input “${i.name}” is defined twice.` });
    names.add(i.name);
  }
  return issues;
}

export function findCycles(tasks: WfTask[]): string[][] {
  const deps = new Map(tasks.map((t) => [t.id, t.dependsOn.filter((d) => d !== t.id)]));
  const state = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  const visit = (id: string) => {
    state.set(id, 1); stack.push(id);
    for (const d of deps.get(id) ?? []) {
      if (!deps.has(d)) continue;
      if (state.get(d) === 1) cycles.push(stack.slice(stack.indexOf(d)));
      else if (!state.get(d)) visit(d);
    }
    stack.pop(); state.set(id, 2);
  };
  for (const t of tasks) if (!state.get(t.id)) visit(t.id);
  return cycles;
}

/** Longest-path layering for the graph view; tasks in a cycle stay on the level where the cycle was detected. */
export function layers(tasks: WfTask[]): Map<string, number> {
  const level = new Map<string, number>();
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const visiting = new Set<string>();
  const depth = (id: string): number => {
    if (level.has(id)) return level.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const t = byId.get(id);
    const l = t && t.dependsOn.length ? Math.max(...t.dependsOn.filter((d) => byId.has(d)).map((d) => depth(d) + 1), 0) : 0;
    visiting.delete(id);
    level.set(id, l);
    return l;
  };
  tasks.forEach((t) => depth(t.id));
  return level;
}
