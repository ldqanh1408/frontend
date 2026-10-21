import { describe, expect, it } from 'vitest';
import { archiveItem, createItem, getDraft, listDocRevisions, listDocuments, purgeItem, setDraft, updateItem } from './documents';

describe('device document operations', () => {
  it('moves a document, refuses a duplicate name and prevents a folder cycle', async () => {
    const a = await createItem([], 'folder', 'Move A', null);
    const b = await createItem([a], 'folder', 'Move B', a.id);
    const d = await createItem([a, b], 'document', 'Document', a.id, '# A');
    const other = await createItem([a, b, d], 'document', 'Document', b.id, '# B');
    const all = [a, b, d, other];
    await expect(updateItem(all, a, { parentId: b.id })).rejects.toThrow(/subfolders/);
    await expect(updateItem(all, d, { parentId: b.id })).rejects.toThrow(/already exists/);
    const moved = await updateItem(all, d, { parentId: null });
    expect(moved.parentId).toBeNull(); expect(moved.rev).toBe(2);
  });
  it('requires archiving before permanent deletion and removes descendants, revisions and unsaved drafts', async () => {
    const folder = await createItem([], 'folder', 'Purge folder', null);
    const doc = await createItem([folder], 'document', 'Purge document', folder.id, '# Private draft');
    await setDraft(doc.id, { content: 'Unsaved private content', baseRev: 1, savedAt: new Date().toISOString() });
    await expect(purgeItem([folder, doc], folder)).rejects.toThrow(/Archive/);
    await archiveItem([folder, doc], folder, true);
    const all = await listDocuments();
    await purgeItem(all, all.find(r => r.id === folder.id)!);
    expect((await listDocuments()).some(r => [folder.id, doc.id].includes(r.id))).toBe(false);
    expect(await listDocRevisions(doc.id)).toEqual([]);
    expect(await getDraft(doc.id)).toBeNull();
  });
});
