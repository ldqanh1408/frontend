import { isValidName, newId } from './ids';
import { sha256Hex } from './hash';
import { del, getAll, kvGet, kvSet, put, putVersioned, type DocumentRecord } from './storage';

/** Device-local specification documents and folders. Folder catalog (tree) is separate from a document's outline. */
export interface DocRevision { id: string; docId: string; rev: number; name: string; content: string; hash: string; savedAt: string }
export interface DocDraft { content: string; baseRev: number; savedAt: string }

export const MAX_DOC_BYTES = 2_000_000;

export const listDocuments = () => getAll<DocumentRecord>('documents');

export function nameTaken(all: DocumentRecord[], parentId: string | null, name: string, exceptId?: string) {
  const n = name.trim().toLowerCase();
  return all.some((d) => d.parentId === parentId && d.id !== exceptId && !d.archived && d.name.trim().toLowerCase() === n);
}
function checkName(all: DocumentRecord[], parentId: string | null, name: string, exceptId?: string) {
  const err = isValidName(name);
  if (err) throw new Error(err);
  if (nameTaken(all, parentId, name, exceptId)) throw new Error(`“${name.trim()}” already exists in this folder.`);
}
export function uniqueName(all: DocumentRecord[], parentId: string | null, base: string) {
  if (!nameTaken(all, parentId, base)) return base;
  for (let i = 2; i < 1000; i++) { const c = `${base} ${i}`; if (!nameTaken(all, parentId, c)) return c; }
  return `${base} ${Date.now()}`;
}

export const template = (title: string) => `# ${title}

## Context

Describe the problem, users and constraints.

## Requirements

- REQ-1: …

## Acceptance criteria

Given …
When …
Then …
`;

async function record(rec: DocumentRecord) {
  if (rec.kind !== 'document') return;
  const r: DocRevision = { id: `${rec.id}@${rec.rev}`, docId: rec.id, rev: rec.rev, name: rec.name, content: rec.content, hash: await sha256Hex(rec.content), savedAt: rec.updatedAt };
  await put('docRevisions', r);
}

export async function createItem(all: DocumentRecord[], kind: 'document' | 'folder', name: string, parentId: string | null, content?: string): Promise<DocumentRecord> {
  checkName(all, parentId, name);
  if (content !== undefined && new Blob([content]).size > MAX_DOC_BYTES) throw new Error('The document is larger than 2 MB.');
  const now = new Date().toISOString();
  const rec: DocumentRecord = {
    id: newId(kind === 'folder' ? 'fld' : 'doc'), kind, parentId, name: name.trim(), content: kind === 'document' ? content ?? template(name.trim()) : '',
    rev: 1, archived: false, favorite: false, properties: {}, createdAt: now, updatedAt: now,
  };
  await putVersioned('documents', rec, 0);
  await record(rec);
  return rec;
}

export async function updateItem(all: DocumentRecord[], rec: DocumentRecord, patch: Partial<Pick<DocumentRecord, 'name' | 'content' | 'parentId' | 'archived' | 'favorite' | 'properties'>>): Promise<DocumentRecord> {
  const parentId = patch.parentId !== undefined ? patch.parentId : rec.parentId;
  const name = patch.name !== undefined ? patch.name.trim() : rec.name;
  if (patch.name !== undefined || patch.parentId !== undefined || patch.archived === false) checkName(all, parentId, name, rec.id);
  if (patch.parentId !== undefined && patch.parentId !== null && wouldCycle(all, rec.id, patch.parentId)) throw new Error('A folder cannot be moved into itself or one of its subfolders.');
  if (patch.content !== undefined && new Blob([patch.content]).size > MAX_DOC_BYTES) throw new Error('The document is larger than 2 MB.');
  const next: DocumentRecord = { ...rec, ...patch, name, parentId, rev: rec.rev + 1, updatedAt: new Date().toISOString() };
  await putVersioned('documents', next, rec.rev);
  if (patch.content !== undefined || patch.name !== undefined) await record(next);
  return next;
}

export function wouldCycle(all: DocumentRecord[], id: string, targetParent: string): boolean {
  const byId = new Map(all.map((d) => [d.id, d]));
  for (let p: string | null = targetParent; p; p = byId.get(p)?.parentId ?? null) if (p === id) return true;
  return false;
}

export function descendants(all: DocumentRecord[], id: string): DocumentRecord[] {
  const out: DocumentRecord[] = [];
  const walk = (pid: string) => { for (const d of all) if (d.parentId === pid) { out.push(d); if (d.kind === 'folder') walk(d.id); } };
  walk(id);
  return out;
}

/** Archive a folder together with everything inside it (restorable). */
export async function archiveItem(all: DocumentRecord[], rec: DocumentRecord, archived: boolean) {
  const items = [rec, ...(rec.kind === 'folder' ? descendants(all, rec.id) : [])];
  if (!archived && rec.parentId && all.find((d) => d.id === rec.parentId)?.archived) throw new Error('Restore the parent folder first.');
  for (const it of items) if (it.archived !== archived) await updateItem(archived ? [] : all, it, { archived });
}

export async function purgeItem(all: DocumentRecord[], rec: DocumentRecord) {
  if (!rec.archived) throw new Error('Archive the item before deleting it permanently.');
  for (const it of [rec, ...descendants(all, rec.id)]) {
    for (const r of await listDocRevisions(it.id)) await del('docRevisions', r.id);
    await del('documents', it.id);
  }
}

export async function listDocRevisions(docId: string): Promise<DocRevision[]> {
  return (await getAll<DocRevision>('docRevisions', 'docId', docId)).sort((a, b) => b.rev - a.rev);
}

export const draftKey = (id: string) => `docdraft:${id}`;
export const getDraft = (id: string) => kvGet<DocDraft>(draftKey(id));
export const setDraft = (id: string, d: DocDraft | null) => kvSet(draftKey(id), d);

const TEXT_EXT = /\.(md|markdown|mdx|txt|rst|adoc)$/i;
/** Imports Markdown/text files into a folder. Unsupported or oversized files are reported, never silently dropped. */
export async function importFiles(all: DocumentRecord[], files: File[], parentId: string | null) {
  const created: DocumentRecord[] = [];
  const skipped: { name: string; reason: string }[] = [];
  let current = [...all];
  for (const f of files) {
    if (!TEXT_EXT.test(f.name)) { skipped.push({ name: f.name, reason: 'Not a Markdown or text file' }); continue; }
    if (f.size > MAX_DOC_BYTES) { skipped.push({ name: f.name, reason: 'Larger than 2 MB' }); continue; }
    const text = await f.text();
    if (text.includes('\u0000')) { skipped.push({ name: f.name, reason: 'Binary content' }); continue; }
    const base = f.name.replace(TEXT_EXT, '').replace(/[\\/\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 170) || 'Imported document';
    const rec = await createItem(current, 'document', uniqueName(current, parentId, base), parentId, text);
    created.push(rec);
    current = [...current, rec];
  }
  return { created, skipped };
}

export function pathOf(all: DocumentRecord[], rec: DocumentRecord): string {
  const byId = new Map(all.map((d) => [d.id, d]));
  const parts = [rec.name];
  for (let p = rec.parentId ? byId.get(rec.parentId) : undefined; p; p = p.parentId ? byId.get(p.parentId) : undefined) parts.unshift(p.name);
  return parts.join(' / ');
}
