import { defaultName, isValidName, newId } from './ids';
import { sha256Hex, stableJson } from './hash';
import { getAll, get, put, putVersioned, type DefinitionRecord, type RevisionRecord } from './storage';
import type { SchemaSpec } from '../data/types';
import { assertDraftSecretPolicy } from './secret-policy';

/** Local definition drafts (device authority only). Every save creates an immutable local revision with a content hash. */
export async function listDefinitions(schemaId?: string): Promise<DefinitionRecord[]> {
  const all = await getAll<DefinitionRecord>('definitions', schemaId ? 'schemaId' : undefined, schemaId);
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createDefinition(schema: SchemaSpec, data: Record<string, unknown> = {}, name?: string, preserved: Record<string, unknown> = {}): Promise<DefinitionRecord> {
  const now = new Date().toISOString();
  const n = name ?? defaultName(schema.title);
  const err = isValidName(n);
  if (err) throw new Error(err);
  const defaults: Record<string, unknown> = {};
  for (const g of schema.groups) for (const f of g.fields) if (f.default !== undefined) defaults[f.key] = f.default;
  const rec: DefinitionRecord = { id: newId('def'), schemaId: schema.id, name: n, data: { ...defaults, ...data }, preserved, rev: 1, archived: false, createdAt: now, updatedAt: now };
  assertDraftSecretPolicy({ data: rec.data, preserved: rec.preserved });
  await putVersioned('definitions', rec, 0);
  await recordRevision(rec);
  return rec;
}

async function recordRevision(rec: DefinitionRecord) {
  const r: RevisionRecord = { id: `${rec.id}@${rec.rev}`, defId: rec.id, rev: rec.rev, name: rec.name, data: rec.data, hash: await sha256Hex(stableJson({ name: rec.name, data: rec.data })), savedAt: rec.updatedAt };
  await put('revisions', r);
}

export async function saveDefinition(rec: DefinitionRecord, patch: { name?: string; data?: Record<string, unknown>; archived?: boolean }): Promise<DefinitionRecord> {
  if (patch.name !== undefined) {
    const err = isValidName(patch.name);
    if (err) throw new Error(err);
  }
  const next: DefinitionRecord = { ...rec, ...patch, name: patch.name?.trim() ?? rec.name, rev: rec.rev + 1, updatedAt: new Date().toISOString() };
  assertDraftSecretPolicy({ data: next.data, preserved: next.preserved });
  await putVersioned('definitions', next, rec.rev);
  await recordRevision(next);
  return next;
}

export async function duplicateDefinition(schema: SchemaSpec, rec: DefinitionRecord): Promise<DefinitionRecord> {
  return createDefinition(schema, rec.data, `${rec.name.slice(0, 170)} copy`, rec.preserved);
}

export async function listRevisions(defId: string): Promise<RevisionRecord[]> {
  return (await getAll<RevisionRecord>('revisions', 'defId', defId)).sort((a, b) => b.rev - a.rev);
}

export const getDefinition = (id: string) => get<DefinitionRecord>('definitions', id);

export interface ExportPacket { format: 'atlas-definition/v1'; authority: 'DEVICE_ONLY'; schemaId: string; name: string; rev: number; hash: string; data: Record<string, unknown>; preserved: Record<string, unknown>; exportedAt: string }
export async function exportDefinition(rec: DefinitionRecord): Promise<ExportPacket> {
  assertDraftSecretPolicy({ data: rec.data, preserved: rec.preserved });
  return { format: 'atlas-definition/v1', authority: 'DEVICE_ONLY', schemaId: rec.schemaId, name: rec.name, rev: rec.rev,
    hash: await sha256Hex(stableJson({ name: rec.name, data: rec.data })), data: rec.data, preserved: rec.preserved, exportedAt: new Date().toISOString() };
}

/** Imports a definition JSON. Unknown fields are preserved (not dropped) and shown for review before publication. */
export async function importDefinition(schema: SchemaSpec, text: string): Promise<DefinitionRecord> {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error('The file is not valid JSON.'); }
  const obj = (parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null) as Record<string, unknown> | null;
  if (!obj) throw new Error('Expected a JSON object.');
  if (obj.format === 'atlas-definition/v1' && obj.schemaId && obj.schemaId !== schema.id) throw new Error(`This file is a ${String(obj.schemaId)} definition, not ${schema.title}.`);
  const data = (obj.format === 'atlas-definition/v1' ? obj.data : obj) as Record<string, unknown>;
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Expected a definition data object.');
  const packetPreserved = obj.format === 'atlas-definition/v1' ? obj.preserved : undefined;
  if (packetPreserved != null && (typeof packetPreserved !== 'object' || Array.isArray(packetPreserved))) throw new Error('Expected a preserved-fields object.');
  const known = new Set(schema.groups.flatMap((g) => g.fields.map((f) => f.key)));
  const kept: Record<string, unknown> = {};
  const preserved: Record<string, unknown> = { ...packetPreserved as Record<string, unknown> };
  for (const [k, v] of Object.entries(data || {})) (known.has(k) ? kept : preserved)[k] = v;
  return createDefinition(schema, kept, typeof obj.name === 'string' && !isValidName(obj.name) ? obj.name : undefined, preserved);
}

export function downloadJson(filename: string, value: unknown) {
  if (value && typeof value === 'object' && /^atlas-(?:definition|recovery|device-export)\//.test(String((value as { format?: unknown }).format))) assertDraftSecretPolicy(value);
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
