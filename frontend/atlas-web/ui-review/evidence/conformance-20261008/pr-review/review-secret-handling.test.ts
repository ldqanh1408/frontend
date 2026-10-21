import { afterEach, expect, test, vi } from 'vitest';
import schemas from './generated/schemas.json';
import type { SchemaSpec } from './data/types';
import { validateField } from './views/definitions/validate';
import { importDefinition } from './lib/definitions';
import { fingerprintPayload, sendCommand, listJournal, type ServiceAction } from './data/service';
import { sha256Hex, stableJson } from './lib/hash';
import { app } from './data/app-store';

const schema = (schemas as unknown as SchemaSpec[]).find(s => s.id === 'mcp-resource')!;
const env = schema.groups.flatMap(g => g.fields).find(f => f.key === 'environmentRefs')!;
const action: ServiceAction = { id: 'rotate', grant: 'credentials.write', label: 'Rotate key', href: 'https://svc.example.test/rotate', resourceId: 'key-1', expectedRevision: 1, inputs: [{ key: 'apiKey', label: 'API key', secret: true }] };
afterEach(() => { vi.unstubAllGlobals(); app.set({ connection: 'disconnected', session: null }); });

test('environment map KEY rejects literal secret values', () => {
  expect(validateField(env, JSON.stringify({ KEY: 'review-only-secret-value' }), false)).not.toBeNull();
});
test('different secret values produce different input commitments', async () => {
  const payload = { scope: 'org:a/ws:b', resourceId: 'key-1', actionId: 'rotate', expectedRevision: 1, input: { apiKey: 'review-value-A' } };
  const other = { ...payload, input: { apiKey: 'review-value-B' } };
  expect(await sha256Hex(stableJson(fingerprintPayload(payload, action)))).not.toBe(await sha256Hex(stableJson(fingerprintPayload(other, action))));
});
test('import rejects secret-bearing known fields before persisting', async () => {
  await expect(importDefinition(schema, JSON.stringify({ environmentRefs: { API_KEY: 'review-only-secret-value' } }))).rejects.toThrow();
});
test('write-only service input is absent from persisted rejection messages', async () => {
  const secret = 'review-only-secret-value';
  app.set({ connection: 'connected', session: { serviceUrl: 'https://svc.example.test', audience: 'workspace', actor: { id: 'review-user', name: 'Review user' }, scope: { org: null, workspace: null, project: null, label: 'org:a/ws:b' }, grants: ['credentials.write'], expiresAt: null, collections: {}, logoutHref: null, capabilityVersion: 'atlas-ui/v1' } });
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ operationId: body.operationId, scope: body.scope, resourceId: body.resourceId, fingerprint: body.fingerprint, stage: 'Rejected', reason: `Invalid API key ${secret}` }), { headers: { 'content-type': 'application/json' } });
  }));
  const entry = await sendCommand('gateway', { id: 'key-1', name: 'Test key', revision: 1, scope: 'org:a/ws:b', status: 'Active', observedAt: new Date().toISOString() }, action, { apiKey: secret });
  expect(JSON.stringify(entry)).not.toContain(secret);
  expect(JSON.stringify(await listJournal())).not.toContain(secret);
});
