import { openDB, type IDBPDatabase } from 'idb';
import { createStore } from './store';

/** Device-local persistence (IndexedDB). Everything stored here is a local draft without tenant authority. */
export interface DefinitionRecord {
  id: string; schemaId: string; name: string; data: Record<string, unknown>; preserved: Record<string, unknown>;
  rev: number; archived: boolean; createdAt: string; updatedAt: string;
}
export interface RevisionRecord { id: string; defId: string; rev: number; name: string; data: Record<string, unknown>; hash: string; savedAt: string }
export interface DocumentRecord {
  id: string; kind: 'document' | 'folder'; parentId: string | null; name: string; content: string; rev: number; archived: boolean;
  favorite: boolean; properties: Record<string, unknown>; createdAt: string; updatedAt: string;
}
export interface SourceFile { path: string; size: number; sha256: string; text: string | null; binary: boolean }
export interface SourceSnapshot { id: string; name: string; digest: string; files: SourceFile[]; importedAt: string; skipped: { path: string; reason: string }[] }
export interface JournalEntry {
  id: string; module: string; resourceId: string; actionId: string; label: string; stage: string; idempotencyKey: string;
  fingerprint: string; scope: string; createdAt: string; updatedAt: string; message: string; evidence: string | null;
  /** Service-declared follow-up links (statusHref may contain {operationId}). */
  statusHref: string | null; effectHref: string | null; resourceName: string; expectedRevision: number | null;
  /** Retains the response-redaction policy after reload, without retaining input values. */
  hasSecretInputs?: boolean;
}
type StoreName = 'definitions' | 'revisions' | 'documents' | 'docRevisions' | 'sources' | 'journal' | 'kv' | 'workflows';

export class ConflictError extends Error {
  constructor(public current: { rev: number; updatedAt: string }) { super('This item changed in another tab or window.'); }
}

export const persistence = createStore<{ mode: 'indexeddb' | 'memory' | 'unknown'; reason: string }>({ mode: 'unknown', reason: '' });

const DB = 'atlas-device';
let dbp: Promise<IDBPDatabase | null> | null = null;
const memory: Record<StoreName, Map<string, unknown>> = {
  definitions: new Map(), revisions: new Map(), documents: new Map(), docRevisions: new Map(), sources: new Map(), journal: new Map(), kv: new Map(), workflows: new Map(),
};

function db(): Promise<IDBPDatabase | null> {
  if (!dbp) {
    dbp = (async () => {
      try {
        if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is not available in this browser.');
        const d = await openDB(DB, 2, {
          upgrade(u, oldVersion) {
            if (oldVersion < 2 && !u.objectStoreNames.contains('workflows')) u.createObjectStore('workflows', { keyPath: 'id' });
            if (oldVersion >= 1) return;
            const defs = u.createObjectStore('definitions', { keyPath: 'id' });
            defs.createIndex('schemaId', 'schemaId');
            const revs = u.createObjectStore('revisions', { keyPath: 'id' });
            revs.createIndex('defId', 'defId');
            const docs = u.createObjectStore('documents', { keyPath: 'id' });
            docs.createIndex('parentId', 'parentId');
            const drev = u.createObjectStore('docRevisions', { keyPath: 'id' });
            drev.createIndex('docId', 'docId');
            u.createObjectStore('sources', { keyPath: 'id' });
            const j = u.createObjectStore('journal', { keyPath: 'id' });
            j.createIndex('module', 'module');
            u.createObjectStore('kv');
          },
          blocked() { /* another tab holds an older version; it closes on versionchange */ },
          blocking() { d?.close(); },
        });
        persistence.set({ mode: 'indexeddb', reason: '' });
        return d;
      } catch (e) {
        persistence.set({ mode: 'memory', reason: e instanceof Error ? e.message : String(e) });
        return null;
      }
    })();
  }
  return dbp;
}

// Cross-tab change notification (multi-tab editing stays consistent).
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('atlas-device') : null;
const listeners = new Set<(store: StoreName, id: string) => void>();
channel?.addEventListener('message', (e) => listeners.forEach((fn) => fn(e.data.store, e.data.id)));
export function onDeviceChange(fn: (store: StoreName, id: string) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify(store: StoreName, id: string) {
  channel?.postMessage({ store, id });
  listeners.forEach((fn) => fn(store, id));
}

export async function getAll<T>(store: StoreName, index?: string, key?: string): Promise<T[]> {
  const d = await db();
  if (!d) return [...memory[store].values()].filter((r) => !index || (r as Record<string, unknown>)[index] === key) as T[];
  return (index ? d.getAllFromIndex(store, index, key) : d.getAll(store)) as Promise<T[]>;
}
export async function get<T>(store: StoreName, id: string): Promise<T | undefined> {
  const d = await db();
  if (!d) return memory[store].get(id) as T | undefined;
  return d.get(store, id) as Promise<T | undefined>;
}
export async function put<T extends { id: string }>(store: StoreName, value: T): Promise<T> {
  const d = await db();
  if (!d) memory[store].set(value.id, structuredClone(value));
  else await d.put(store, value);
  notify(store, value.id);
  return value;
}
export async function del(store: StoreName, id: string): Promise<void> {
  const d = await db();
  if (!d) memory[store].delete(id);
  else await d.delete(store, id);
  notify(store, id);
}

/** Compare-and-swap on `rev`: refuses to overwrite a newer revision written by another tab. */
export async function putVersioned<T extends { id: string; rev: number; updatedAt: string }>(store: 'definitions' | 'documents' | 'workflows', value: T, expectedRev: number): Promise<T> {
  const d = await db();
  if (!d) {
    const cur = memory[store].get(value.id) as T | undefined;
    if (cur && cur.rev !== expectedRev) throw new ConflictError({ rev: cur.rev, updatedAt: cur.updatedAt });
    memory[store].set(value.id, structuredClone(value));
  } else {
    const tx = d.transaction(store, 'readwrite');
    const cur = (await tx.store.get(value.id)) as T | undefined;
    if (cur && cur.rev !== expectedRev) {
      tx.done.catch(() => { /* aborted on purpose */ });
      tx.abort();
      throw new ConflictError({ rev: cur.rev, updatedAt: cur.updatedAt });
    }
    await tx.store.put(value);
    await tx.done;
  }
  notify(store, value.id);
  return value;
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const d = await db();
  if (!d) return memory.kv.get(key) as T | undefined;
  return d.get('kv', key) as Promise<T | undefined>;
}
export async function kvSet(key: string, value: unknown): Promise<void> {
  const d = await db();
  if (!d) memory.kv.set(key, value);
  else await d.put('kv', value, key);
}

/** Local storage that never throws (private mode / blocked site data). */
export const safeLocal = {
  get(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } },
  set(key: string, v: string) { try { localStorage.setItem(key, v); } catch { /* ignore */ } },
};

export async function initStorage() { await db(); }
