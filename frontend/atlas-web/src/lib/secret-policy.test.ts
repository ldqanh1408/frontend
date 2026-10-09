import { describe, expect, it } from 'vitest';
import schemas from '../generated/schemas.json';
import type { SchemaSpec } from '../data/types';
import { validateField } from '../views/definitions/validate';
import { createDefinition, downloadJson, duplicateDefinition, exportDefinition, importDefinition, saveDefinition } from './definitions';
import { getAll } from './storage';
import { secretFieldError } from './secret-policy';

const schema = (schemas as unknown as SchemaSpec[]).find(s => s.id === 'mcp-resource')!;
const environment = schema.groups.flatMap(g => g.fields).find(f => f.key === 'environmentRefs')!;
const synthetic = 'review-only-secret-value';

describe('secret policy at the device persistence boundary', () => {
  it.each(['KEY', 'name', 'key', 'env', 'variable', 'API_KEY'])('rejects the environment map key %s without echoing its value', key => {
    expect(validateField(environment, JSON.stringify({ [key]: synthetic }), false)).toMatch(/vault/);
  });
  it('allows vault maps and explicit reference descriptors', () => {
    for (const value of [{ KEY: 'vault://org/key' }, [{ name: 'API_KEY', valueRef: 'vault://org/key' }]]) {
      expect(validateField(environment, JSON.stringify(value), false)).toBeNull();
    }
  });
  it.each([
    { credentialReference: synthetic }, { replacementCredentialRef: synthetic },
    { environmentRefs: { KEY: synthetic } }, { args: ['--apiKey', synthetic] },
    { args: ['--password=review-only-secret-value'] }, { nested: { apiKey: synthetic } },
    { args: ['--key:review-only-secret-value'] }, { endpoint: 'https://user:pass@svc.example.test' },
  ])('rejects imports before either draft or revision storage changes: %j', async data => {
    const before = [await getAll('definitions'), await getAll('revisions')];
    await expect(importDefinition(schema, JSON.stringify(data))).rejects.toThrow(/vault/);
    expect([await getAll('definitions'), await getAll('revisions')]).toEqual(before);
  });
  it('blocks create/save/duplicate/export and preserved-field import, including legacy drafts', async () => {
    await expect(createDefinition(schema, {}, undefined, { password: synthetic })).rejects.toThrow(/vault/);
    const rec = await createDefinition(schema, { environmentRefs: { KEY: 'vault://org/key' } });
    const before = [await getAll('definitions'), await getAll('revisions')];
    await expect(saveDefinition(rec, { data: { environmentRefs: { KEY: synthetic } } })).rejects.toThrow(/vault/);
    const legacy = { ...rec, preserved: { password: synthetic } };
    await expect(duplicateDefinition(schema, legacy)).rejects.toThrow(/vault/);
    await expect(exportDefinition(legacy)).rejects.toThrow(/vault/);
    await expect(importDefinition(schema, JSON.stringify({ format: 'atlas-definition/v1', data: {}, preserved: { password: synthetic } }))).rejects.toThrow(/vault/);
    expect([await getAll('definitions'), await getAll('revisions')]).toEqual(before);
  });
  it('round-trips safe unknown fields and vault references', async () => {
    const rec = await createDefinition(schema, { environmentRefs: { KEY: 'vault://org/key' }, args: ['--port', '8080', '--api-key=vault://org/key'] }, 'Safe MCP', { futureFlag: true });
    const packet = await exportDefinition(rec);
    const imported = await importDefinition(schema, JSON.stringify(packet));
    expect(imported.data).toEqual(rec.data);
    expect(imported.preserved).toEqual(rec.preserved);
    expect((await duplicateDefinition(schema, imported)).preserved).toEqual(rec.preserved);
    expect(secretFieldError('args', ['--port', '8080'])).toBeNull();
    expect(secretFieldError('args', ['--keyboard', 'us'])).toBeNull();
  });
  it('blocks unsaved and recovery exports before creating a download', () => {
    expect(() => downloadJson('recovery.json', { format: 'atlas-recovery/v1', data: { environmentRefs: { KEY: synthetic } } })).toThrow(/vault/);
    expect(() => downloadJson('draft.json', { format: 'atlas-definition/v1', data: {}, unsaved: { password: synthetic } })).toThrow(/vault/);
  });
});
