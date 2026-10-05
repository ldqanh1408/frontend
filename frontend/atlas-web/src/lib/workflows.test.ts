import { describe, expect, it } from 'vitest';
import { findCycles, layers, nextTaskId, validateWorkflow, type WfTask } from './workflows';

const pin = { id: 'def-1', kind: 'agent', rev: 1, hash: 'a'.repeat(64) };
const t = (id: string, deps: string[] = [], extra: Partial<WfTask> = {}): WfTask => ({ id, title: id, agent: pin, dependsOn: deps, checkpoint: false, instructions: '', output: 'out', ...extra });

describe('workflow validation', () => {
  it('detects cycles and missing dependencies', () => {
    const tasks = [t('T-01', ['T-03']), t('T-02', ['T-01']), t('T-03', ['T-02']), t('T-04', ['T-09'])];
    expect(findCycles(tasks)).toHaveLength(1);
    const msgs = validateWorkflow(tasks).map((i) => i.message).join('\n');
    expect(msgs).toMatch(/Cycle: T-01 → T-03 → T-02 → T-01|Cycle/);
    expect(msgs).toMatch(/missing task T-09/);
  });
  it('requires pinned agents and reports unconnected tasks', () => {
    const issues = validateWorkflow([t('T-01'), t('T-02', [], { agent: null })]);
    expect(issues.some((i) => i.level === 'error' && /pinned agent/.test(i.message))).toBe(true);
    expect(issues.filter((i) => /not connected/.test(i.message))).toHaveLength(2);
  });
  it('layers a DAG by longest path and numbers tasks', () => {
    const l = layers([t('T-01'), t('T-02', ['T-01']), t('T-03', ['T-01', 'T-02'])]);
    expect([l.get('T-01'), l.get('T-02'), l.get('T-03')]).toEqual([0, 1, 2]);
    expect(nextTaskId([t('T-01'), t('T-07')])).toBe('T-08');
  });
});
