import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app, capability, type ServiceSession } from './app-store';
import { actionPermission, requiresServiceAction } from './permissions';
import { actionGate, type ServiceRecord } from './service';
import { DOMAIN_STATES, domainTone, statePresentation } from './states';

const session = (): ServiceSession => ({ serviceUrl: 'https://service.example.test', audience: 'workspace', actor: { id: 'reviewer', name: 'Tech Lead' }, scope: { org: 'org', workspace: 'ws', project: 'project', label: 'org/ws/project' }, grants: [], expiresAt: null, collections: {}, logoutHref: null, capabilityVersion: 'atlas-ui/v1' });
beforeEach(() => app.set({ connection: 'connected', session: session() }));
afterEach(() => { vi.useRealTimers(); app.set({ connection: 'disconnected', session: null }); });
describe('SRS capability boundary', () => {
  it('does not infer a grant from a role name', () => { expect(capability('spec:lock')).toMatchObject({ ok: false, kind: 'permission' }); });
  it('distinguishes grants, plans and resource limits, including missing evidence', () => {
    app.set(s => ({ session: { ...s.session!, grants: ['agent:control'], entitlements: { sandbox: false }, limits: { sandboxes: { used: 3, limit: 3 } } } }));
    expect(capability('spec:lock').reason).toContain('Requires spec:lock');
    expect(capability('agent:control', 'Run', { entitlement: 'sandbox' })).toMatchObject({ kind: 'entitlement', ok: false, reason: "Not included in your organization's plan." });
    expect(capability('agent:control', 'Run', { entitlement: 'unknown' }).ok).toBe(false);
    expect(capability('agent:control', 'Run', { resource: 'sandboxes' })).toMatchObject({ kind: 'quota', ok: false, reason: 'Limit reached: sandboxes.' });
    expect(capability('agent:control', 'Run', { resource: 'unknown' }).ok).toBe(false);
  });
  it('checks elapsed expiry, tenant context and Observer isolation', () => {
    vi.useFakeTimers();
    app.set(s => ({ session: { ...s.session!, grants: ['*'], expiresAt: new Date(Date.now() + 1000).toISOString() } }));
    expect(capability('agent:control').ok).toBe(true);
    vi.advanceTimersByTime(1001);
    expect(capability('agent:control')).toMatchObject({ ok: false, kind: 'session' });
    app.set(s => ({ session: { ...s.session!, expiresAt: null, audience: 'observer' } }));
    expect(capability('agent:control').reason).toMatch(/Observer sessions are read-only/);
    app.set(s => ({ session: { ...s.session!, audience: 'workspace', scope: { ...s.session!.scope, label: '' } } }));
    expect(capability('agent:control').reason).toMatch(/tenant context/);
  });
  it('maps the required run and specification controls to atomic grants', () => {
    expect(actionPermission('Lock')).toBe('spec:lock');
    expect(actionPermission('Submit to AI')).toBe('spec:submit_to_ai');
    expect(actionPermission('Approve plan')).toBe('dag:plan_approve');
    expect(actionPermission('Review checkpoint')).toBe('dag:milestone_approve');
    for (const label of ['Pause', 'Resume', 'Retry task', 'Retry failed', 'Cancel run']) expect(actionPermission(label)).toBe('agent:control');
    expect(actionPermission('Force release')).toBe('lock:force_release');
    expect(requiresServiceAction('Approve plan')).toBe(true);
    expect(requiresServiceAction('Lock exact cut')).toBe(true);
    expect(requiresServiceAction('Inspect approved plan')).toBe(false);
  });
  it('blocks wrong scope, stale revision, misleading grant and self-approval', () => {
    app.set(s => ({ session: { ...s.session!, grants: ['*'] } }));
    const r: ServiceRecord = { id: 'change', name: 'Change', revision: 4, scope: 'org/ws/project', observedAt: new Date().toISOString(), status: 'Pending_Single_Sig', fields: { author_id: 'reviewer' } };
    const action = { id: 'approve', label: 'Approve', grant: 'gov:approve_medium', resourceId: r.id, expectedRevision: 4, href: '/approve' };
    expect(actionGate(r, action)).toMatch(/Authors cannot approve/);
    expect(actionGate({ ...r, scope: 'other' }, action)).toMatch(/scope/);
    expect(actionGate(r, { ...action, expectedRevision: 3 })).toMatch(/stale/);
    expect(actionGate(r, { ...action, label: 'Pause', grant: 'execution:write' })).toMatch(/agent:control/);
  });
});
it('defines a tone, icon and safe next step for every canonical SRS state', () => {
  for (const state of Object.values(DOMAIN_STATES).flat()) {
    expect(domainTone(state), state).toBeDefined();
    expect(statePresentation(state).next, state).not.toBe('Inspect authoritative evidence before acting.');
  }
});
