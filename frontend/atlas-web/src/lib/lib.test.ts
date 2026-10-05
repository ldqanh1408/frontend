import { describe, expect, it } from 'vitest';
import { defaultName, isValidName } from './ids';
import { stableJson } from './hash';
import { createDefinition, importDefinition, saveDefinition } from './definitions';
import { ConflictError } from './storage';
import type { SchemaSpec } from '../data/types';
import schemas from '../generated/schemas.json';

const list = schemas as unknown as SchemaSpec[];

describe('names (FND-004)', () => {
  it('derives a valid default name for every definition type', () => {
    for (const s of list) expect(isValidName(defaultName(s.title)), s.title).toBeNull();
    expect(defaultName('Retry / resume request', 'abcd1234')).toBe('Retry - resume request abcd1234');
  });
  it('rejects separators and control characters', () => {
    expect(isValidName('a/b')).toMatch(/separators/);
    expect(isValidName('a\u0007b')).toMatch(/control/);
    expect(isValidName('x'.repeat(181))).toMatch(/180/);
  });
});

describe('stable JSON', () => {
  it('is key-order independent', () => {
    expect(stableJson({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe(stableJson({ a: [2, { c: 2, d: 1 }], b: 1 }));
  });
});

describe('device definitions', () => {
  const schema = list.find((s) => s.id === 'agent')!;
  it('creates with defaults, saves revisions and refuses stale writes', async () => {
    const rec = await createDefinition(schema);
    expect(rec.rev).toBe(1);
    const next = await saveDefinition(rec, { name: 'Agent A' });
    expect(next.rev).toBe(2);
    await expect(saveDefinition(rec, { name: 'Stale' })).rejects.toBeInstanceOf(ConflictError);
  });
  it('preserves unknown fields on import', async () => {
    const rec = await importDefinition(schema, JSON.stringify({ format: 'atlas-definition/v1', schemaId: 'agent', name: 'Imported', data: { legacyField: 1 } }));
    expect(rec.preserved).toEqual({ legacyField: 1 });
    expect(rec.name).toBe('Imported');
  });
  it('rejects a file of another type', async () => {
    await expect(importDefinition(schema, JSON.stringify({ format: 'atlas-definition/v1', schemaId: 'memory', data: {} }))).rejects.toThrow(/memory/);
  });
});
