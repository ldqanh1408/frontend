import { describe, expect, it } from 'vitest';
import type { FieldSpec, SchemaSpec } from '../../data/types';
import schemas from '../../generated/schemas.json';
import { initialValues, toData, validateAll, validateField } from './validate';

const list = schemas as unknown as SchemaSpec[];
const base: FieldSpec = { key: 'k', label: 'K', required: false, control: 'text', type: 'string', format: null, hint: '', unit: null, enum: null, minimum: null, maximum: null, minLength: null, maxLength: null, pattern: null, maxItems: null, uniqueItems: false, itemConstraints: null, nullable: false };

describe('field validation', () => {
  it('checks numbers with units and ranges', () => {
    const f = { ...base, control: 'number' as const, type: 'integer', minimum: 1, maximum: 10, unit: 'ms' };
    expect(validateField(f, '0', false)).toMatch(/at least 1 ms/);
    expect(validateField(f, '2.5', false)).toMatch(/whole number/);
    expect(validateField(f, '5', false)).toBeNull();
  });
  it('requires timezone on datetimes', () => {
    const f = { ...base, control: 'datetime' as const };
    expect(validateField(f, '2026-10-03T09:00', false)).toMatch(/timezone/);
    expect(validateField(f, '2026-10-03T09:00:00Z', false)).toBeNull();
  });
  it('requires exact pins', () => {
    const f = { ...base, control: 'pins' as const };
    expect(validateField(f, '[{"id":"a","kind":"agent","rev":1,"hash":"abc"}]', false)).toMatch(/SHA-256/);
    expect(validateField(f, JSON.stringify([{ id: 'a', kind: 'agent', rev: 1, hash: 'a'.repeat(64) }]), false)).toBeNull();
  });
  it('rejects secrets in place of vault references and credentials in URLs', () => {
    expect(validateField({ ...base, key: 'credentialReference' }, 'sk-live-123', false)).toMatch(/vault/);
    expect(validateField({ ...base, key: 'endpoint' }, 'https://u:p@x.test', false)).toMatch(/credentials/);
  });
  it('only enforces required fields for complete validation', () => {
    const f = { ...base, required: true };
    expect(validateField(f, '', false)).toBeNull();
    expect(validateField(f, '', true)).toMatch(/required/);
  });
});


describe('secret policy', () => {
  const env = { ...base, key: 'environmentRefs', control: 'json' as const, type: ['object', 'array'] };
  const args = { ...base, key: 'args', control: 'list' as const, type: 'array' };

  it('requires vault:// for every credential reference key, including replacementCredentialRef', () => {
    expect(validateField({ ...base, key: 'replacementCredentialRef' }, 'sk-live-123', false)).toMatch(/vault/);
    expect(validateField({ ...base, key: 'replacementCredentialRef' }, 'vault://a/b', false)).toBeNull();
    expect(validateField({ ...base, key: 'ownerRef' }, 'user:alex', false)).toBeNull();
  });
  it('rejects literal values in environmentRefs', () => {
    expect(validateField(env, '{"API_KEY":"sk-live-abcdef123"}', false)).toMatch(/vault reference/);
    expect(validateField(env, '{"API_KEY":"vault://team/k"}', false)).toBeNull();
    expect(validateField(env, '[{"name":"API_KEY","valueRef":"vault://t/k"}]', false)).toBeNull();
    expect(validateField(env, '[{"name":"API_KEY","valueRef":"abc"}]', false)).toMatch(/valueRef/);
  });
  it('flags inline secrets in args without flagging ordinary flags', () => {
    expect(validateField(args, '--api-key=abc123', false)).toMatch(/secret/);
    expect(validateField(args, '--token\nabc123', false)).toMatch(/secret/);
    expect(validateField(args, 'ghp_abcdefghijklmnopqrstuv', false)).toMatch(/secret/);
    expect(validateField(args, '--token=vault://t/x', false)).toBeNull();
    expect(validateField(args, '-y\n@modelcontextprotocol/server-github\n--port=8080\n--keyboard=us', false)).toBeNull();
  });
});


describe('every schema', () => {
  it('round-trips defaults without shape errors', () => {
    for (const s of list) {
      const v = initialValues(s);
      expect(validateAll(s, v, false), s.id).toEqual({});
      const data = toData(s, v);
      expect(validateAll(s, initialValues(s, data), false), s.id).toEqual({});
    }
  });
});
