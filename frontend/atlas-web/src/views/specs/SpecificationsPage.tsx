import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useBlocker, useSearchParams } from 'react-router';
import { nav } from '../../data/catalog';
import { capability, toast, useApp } from '../../data/app-store';
import { archiveItem, createItem, getDraft, importFiles, listDocRevisions, listDocuments, pathOf, purgeItem, setDraft, uniqueName, updateItem, type DocRevision } from '../../lib/documents';
import { ConflictError, type DocumentRecord } from '../../lib/storage';
import { useDeviceQuery } from '../../lib/hooks';
import { relativeTime } from '../../lib/format';
import { isValidName } from '../../lib/ids';
import { diffLines, withContext } from '../../lib/diff';
import { Badge, Banner, Button, EmptyState, PageHeader, Panel, Skeleton } from '../../components/ui';
import { Dialog, Tabs } from '../../components/overlays';
import { CodeEditor, type EditorHandle } from '../../components/CodeEditor';
import { usePageMeta } from '../../shell/page-meta';
import { ProvenanceBanner } from '../shared';
import { ModuleViews } from '../modules/common';
import { DocTree } from './DocTree';
import { outline, renderMarkdown, requirements } from './markdown';

const LIFECYCLE = ['Draft', 'In review', 'Merged', 'Locked / frozen manifest', 'Submitted to AI', 'Implemented after acceptance'];

type NameDialogState = { mode: 'folder' | 'document' | 'rename'; rec?: DocumentRecord } | null;

/** Specifications IDE (Figma "Specifications"): folder catalog, Markdown source/preview, outline & requirements, document lifecycle. */
export default function SpecificationsPage() {
  const m = nav.modules.specifications;
  const [params, setParams] = useSearchParams();
  const openId = params.get('doc');
  const { data: docs, loading } = useDeviceQuery(listDocuments, [], [] as DocumentRecord[]);
  const [selected, setSelected] = useState<string | null>(openId);
  const [q, setQ] = useState('');
  const [collection, setCollection] = useState<'active' | 'archived'>('active');
  const [nameDlg, setNameDlg] = useState<NameDialogState>(null);
  const [moveRec, setMoveRec] = useState<DocumentRecord | null>(null);
  const [purgeRec, setPurgeRec] = useState<DocumentRecord | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const open = docs.find((d) => d.id === openId && d.kind === 'document');
  usePageMeta(open ? open.name : m.title, [{ label: m.label, to: '/specifications' }, ...(open ? [{ label: open.name }] : [])]);
  const visible = useMemo(() => docs.filter((d) => (collection === 'archived' ? d.archived : !d.archived)), [docs, collection]);
  const sel = docs.find((d) => d.id === selected) ?? null;
  const targetFolder = sel ? (sel.kind === 'folder' ? sel.id : sel.parentId) : null;

  const openDoc = useCallback((rec: DocumentRecord) => { setSelected(rec.id); const n = new URLSearchParams(params); n.set('doc', rec.id); setParams(n); }, [params, setParams]);
  const onName = async (name: string) => {
    const s = nameDlg!;
    if (s.mode === 'rename') {
      const next = await updateItem(docs, s.rec!, { name });
      toast({ tone: 'success', title: 'Renamed', body: `${next.name} · device revision ${next.rev}` });
    } else {
      const rec = await createItem(docs, s.mode, name, targetFolder);
      toast({ tone: 'success', title: s.mode === 'folder' ? 'Folder created' : 'Document created', body: `${pathOf([...docs, rec], rec)} · saved on this device` });
      setSelected(rec.id);
      if (rec.kind === 'document') openDoc(rec);
    }
    setNameDlg(null);
  };
  const onImport = async (files: FileList) => {
    try {
      const { created, skipped } = await importFiles(docs, [...files], targetFolder);
      toast({ tone: skipped.length ? 'warning' : 'success', title: `${created.length} imported${skipped.length ? `, ${skipped.length} skipped` : ''}`, body: skipped.map((s) => `${s.name}: ${s.reason}`).join('; ') || 'Saved on this device.' });
      if (created[0]) openDoc(created[0]);
    } catch (e) { toast({ tone: 'danger', title: 'Import failed', body: e instanceof Error ? e.message : String(e) }); }
  };
  const onArchive = async (rec: DocumentRecord) => {
    try {
      await archiveItem(docs, rec, !rec.archived);
      toast({ tone: 'success', title: rec.archived ? 'Restored' : 'Archived', body: `${rec.name}${rec.kind === 'folder' ? ' and its contents' : ''}. ${rec.archived ? '' : 'Find it under Archived.'}` });
      if (!rec.archived && openId && (rec.id === openId)) { const n = new URLSearchParams(params); n.delete('doc'); setParams(n); }
    } catch (e) { toast({ tone: 'danger', title: 'Could not change the collection', body: e instanceof Error ? e.message : String(e) }); }
  };
  const cut = capability('specifications:revision-cut', 'Create revision cut');
  return (
    <div className="page page-ide">
      <PageHeader title={m.title} purpose={m.purpose} actions={<>
        <Button icon="upload" onClick={() => fileRef.current?.click()}>Import</Button>
        <input ref={fileRef} type="file" multiple accept=".md,.markdown,.mdx,.txt,.rst,.adoc,text/markdown,text/plain" hidden onChange={(e) => { if (e.target.files?.length) onImport(e.target.files); e.target.value = ''; }} />
        <Button icon="folder-plus" onClick={() => setNameDlg({ mode: 'folder' })}>New folder</Button>
        <Button icon="file-plus" variant="primary" onClick={() => setNameDlg({ mode: 'document' })}>New document</Button>
      </>} />
      <ProvenanceBanner />
      <div className="ide">
        <section className="panel ide-side" aria-labelledby="docs-h">
          <div className="panel-head"><h2 id="docs-h" className="eyebrow">Documents</h2><span className="caption">{docs.filter((d) => d.kind === 'document' && !d.archived).length}</span></div>
          <div className="panel-pad stack-12">
            <div className="field">
              <label className="field-label" htmlFor="spec-search">Search catalog</label>
              <input id="spec-search" className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Folder or document name" />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="spec-col">Collection</label>
              <select id="spec-col" className="select" value={collection} onChange={(e) => setCollection(e.target.value as 'active' | 'archived')}><option value="active">Active</option><option value="archived">Archived</option></select>
            </div>
          </div>
          <div className="ide-tree">
            {loading ? <div className="panel-pad"><Skeleton label="Loading documents" /></div> : visible.length ? (
              <DocTree items={visible} selectedId={selected} onSelect={setSelected} onOpen={openDoc} onRename={(rec) => setNameDlg({ mode: 'rename', rec })} filter={q} label="Specification documents" />
            ) : (
              <div className="panel-pad"><p className="caption">{collection === 'archived' ? 'Nothing archived.' : 'No documents yet. Create a document or import Markdown files.'}</p></div>
            )}
          </div>
          {sel && (
            <div className="panel-section stack" aria-label="Selected item">
              <span className="caption break">{pathOf(docs, sel)}</span>
              <div className="row">
                {!sel.archived && <Button compact icon="edit" onClick={() => setNameDlg({ mode: 'rename', rec: sel })} aria-keyshortcuts="F2">Rename</Button>}
                {!sel.archived && <Button compact icon="folder" onClick={() => setMoveRec(sel)}>Move</Button>}
                <Button compact icon={sel.archived ? 'restore' : 'archive'} onClick={() => onArchive(sel)}>{sel.archived ? 'Restore' : 'Archive'}</Button>
                {sel.archived && <Button compact variant="danger" icon="trash" onClick={() => setPurgeRec(sel)}>Delete permanently</Button>}
              </div>
            </div>
          )}
          <div className="panel-section stack">
            <p className="caption">Folder catalog ≠ document outline</p>
            <Button compact block blocked={cut.ok ? undefined : cut.reason} reasonId={cut.ok ? undefined : 'cut-reason'}>Create revision cut</Button>
            {!cut.ok && <p id="cut-reason" className="caption">Revision cuts are created by the review service for an authorized scope.</p>}
          </div>
        </section>
        {open ? <DocEditor key={open.id} rec={open} all={docs} /> : (
          <>
            <div className="ide-main">
              {openId && !loading ? <Panel><EmptyState icon="danger" title="Document not found">This document does not exist on this device. It may have been created in another browser or deleted.</EmptyState></Panel> : (
                <Panel>
                  <EmptyState icon="file-text" title="Open a document" actions={<Button variant="primary" icon="file-plus" onClick={() => setNameDlg({ mode: 'document' })}>New document</Button>}>
                    Choose a document in the catalog, create one, or import Markdown files. Documents are saved on this device until a review service is connected.
                  </EmptyState>
                </Panel>
              )}
            </div>
            <DocInspector content="" hasDoc={false} onGo={() => {}} />
          </>
        )}
      </div>
      <ModuleViews module="specifications" />
      {nameDlg && <NameDialog state={nameDlg} all={docs} parentId={nameDlg.mode === 'rename' ? nameDlg.rec!.parentId : targetFolder} onClose={() => setNameDlg(null)} onSubmit={onName} />}
      {moveRec && <MoveDialog rec={moveRec} all={docs} onClose={() => setMoveRec(null)} />}
      <Dialog open={!!purgeRec} onOpenChange={(o) => !o && setPurgeRec(null)} title={`Delete “${purgeRec?.name ?? ''}” permanently?`}
        description="This removes the item, its contents and all device revisions from this browser. It cannot be undone. Export first if you may need it."
        footer={<>
          <Button onClick={() => setPurgeRec(null)}>Cancel</Button>
          <Button variant="danger" onClick={async () => { const r = purgeRec!; setPurgeRec(null); await purgeItem(docs, r); setSelected(null); toast({ tone: 'success', title: 'Deleted permanently', body: r.name }); }}>Delete permanently</Button>
        </>} />
    </div>
  );
}

function NameDialog({ state, all, parentId, onClose, onSubmit }: { state: NonNullable<NameDialogState>; all: DocumentRecord[]; parentId: string | null; onClose: () => void; onSubmit: (n: string) => Promise<void> }) {
  const initial = state.mode === 'rename' ? state.rec!.name : uniqueName(all, parentId, state.mode === 'folder' ? 'New folder' : 'Untitled specification');
  const [name, setName] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const where = parentId ? pathOf(all, all.find((d) => d.id === parentId)!) : 'Top level';
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = isValidName(name);
    if (v) { setErr(v); return; }
    try { await onSubmit(name); } catch (x) { setErr(x instanceof Error ? x.message : String(x)); }
  };
  const title = state.mode === 'rename' ? 'Rename' : state.mode === 'folder' ? 'New folder' : 'New document';
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={title} description={`Location: ${where}`}>
      <form className="stack-12" onSubmit={submit} noValidate>
        <div className="field">
          <label className="field-label" htmlFor="item-name">Name<span className="req" aria-hidden="true"> *</span></label>
          <input id="item-name" className="input" autoFocus required value={name} onChange={(e) => { setName(e.target.value); setErr(null); }} onFocus={(e) => e.target.select()}
            aria-invalid={err ? true : undefined} aria-describedby="item-name-hint" />
          <small id="item-name-hint" className={err ? 'field-error' : 'field-hint'} role={err ? 'alert' : undefined}>{err ?? '1–180 characters, unique in this folder; no / or \\.'}</small>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">{state.mode === 'rename' ? 'Rename' : 'Create'}</Button>
        </div>
      </form>
    </Dialog>
  );
}

function MoveDialog({ rec, all, onClose }: { rec: DocumentRecord; all: DocumentRecord[]; onClose: () => void }) {
  const [target, setTarget] = useState<string>(rec.parentId ?? '');
  const [err, setErr] = useState<string | null>(null);
  const folders = all.filter((d) => d.kind === 'folder' && !d.archived).map((f) => ({ f, path: pathOf(all, f) })).sort((a, b) => a.path.localeCompare(b.path));
  const blocked = (id: string) => id === rec.id || (rec.kind === 'folder' && pathOf(all, all.find((d) => d.id === id)!).startsWith(`${pathOf(all, rec)} / `));
  const submit = async () => {
    try {
      await updateItem(all, rec, { parentId: target || null });
      toast({ tone: 'success', title: 'Moved', body: `${rec.name} → ${target ? pathOf(all, all.find((d) => d.id === target)!) : 'Top level'}` });
      onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Move “${rec.name}”`} description="Choose the destination folder. A folder cannot move into itself or its subfolders."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit} disabled={(target || null) === rec.parentId}>Move here</Button></>}>
      <div className="field">
        <label className="field-label" htmlFor="move-target">Destination</label>
        <select id="move-target" className="select" value={target} onChange={(e) => { setTarget(e.target.value); setErr(null); }} aria-describedby="move-hint">
          <option value="">Top level</option>
          {folders.map(({ f, path }) => <option key={f.id} value={f.id} disabled={blocked(f.id)}>{path}{blocked(f.id) ? ' (not allowed)' : ''}</option>)}
        </select>
        <small id="move-hint" className={err ? 'field-error' : 'field-hint'} role={err ? 'alert' : undefined}>{err ?? 'Names must stay unique in the destination folder.'}</small>
      </div>
    </Dialog>
  );
}

/** Editor column and its inspector (rendered as two grid cells) so typing re-renders only this subtree. */
function DocEditor({ rec, all }: { rec: DocumentRecord; all: DocumentRecord[] }) {
  const editorRef = useRef<EditorHandle | null>(null);
  const [tab, onTab] = useState('source');
  const [base, setBase] = useState(rec);
  const [content, setContent] = useState(rec.content);
  const [resetKey, setResetKey] = useState(0);
  /** Programmatic content changes (restore, discard, load revision) must also reload the editor. */
  const loadContent = (c: string) => { setContent(c); setResetKey((k) => k + 1); };
  const [conflict, setConflict] = useState<number | null>(null);
  const [recovered, setRecovered] = useState<{ content: string; savedAt: string; stale: boolean } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirty = content !== base.content;
  const connection = useApp((s) => s.connection);
  useEffect(() => { getDraft(rec.id).then((d) => { if (d && d.content !== rec.content) setRecovered({ content: d.content, savedAt: d.savedAt, stale: d.baseRev !== rec.rev }); }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const ownWrites = useRef(new Set<number>());
  useEffect(() => {
    if (rec.rev > base.rev && !ownWrites.current.has(rec.rev)) { if (!dirty) { setBase(rec); loadContent(rec.content); } else setConflict(rec.rev); }
  }, [rec]); // eslint-disable-line react-hooks/exhaustive-deps
  const deferred = useDeferredValue(content);
  const goToLine = (line: number) => { onTab('source'); requestAnimationFrame(() => editorRef.current?.goToLine(line)); };
  // Keep an unsaved draft on this device so a crash or closed tab does not lose work.
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => { setDraft(rec.id, { content, baseRev: base.rev, savedAt: new Date().toISOString() }); }, 800);
    return () => clearTimeout(t);
  }, [content, dirty, base.rev, rec.id]);
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search));
  const save = async () => {
    const text = editorRef.current?.getValue() ?? content;
    if (text === base.content || saving || conflict) return;
    setSaving(true);
    try {
      ownWrites.current.add(base.rev + 1);
      const next = await updateItem(all, base, { content: text });
      setBase(next);
      await setDraft(rec.id, null);
      toast({ tone: 'success', title: `Device revision ${next.rev} saved`, body: 'Saved on this device. Review, freeze and submission need a service.' });
    } catch (e) {
      if (e instanceof ConflictError) setConflict(e.current.rev);
      else toast({ tone: 'danger', title: 'Save failed', body: e instanceof Error ? e.message : String(e) });
    } finally { setSaving(false); }
  };
  const exportMd = () => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `${base.name}.md` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const gate = (g: string, what: string) => { const c = capability(g, what); return c.ok ? undefined : c.reason; };
  const shared = connection !== 'connected' ? 'doc-gate-note' : undefined;
  const html = useMemo(() => (tab === 'preview' ? renderMarkdown(content) : ''), [tab, content]);
  return (
    <>
    <section className="panel ide-editor ide-main" aria-labelledby="doc-title">
      <div className="panel-head" style={{ flexWrap: 'wrap' }}>
        <div className="stack" style={{ gap: 2, minWidth: 0 }}>
          <h1 id="doc-title" tabIndex={-1} data-page-title className="doc-title break">{base.name}</h1>
          <span className="caption break">{pathOf(all, base)}</span>
        </div>
        <div className="row">
          <Badge tone={dirty ? 'warning' : 'neutral'}>{dirty ? 'Unsaved changes' : `Device revision ${base.rev}`}</Badge>
          <Button variant="primary" icon="save" onClick={save} disabled={!dirty || saving || !!conflict} aria-keyshortcuts="Control+S Meta+S">{saving ? 'Saving…' : 'Save draft'}</Button>
          <Button icon="history" onClick={() => setHistoryOpen(true)}>History</Button>
          <Button icon="download" onClick={exportMd}>Export source</Button>
        </div>
      </div>
      <div className="panel-pad stack-12">
        {recovered && (
          <Banner tone="warning" title={recovered.stale ? 'Unsaved draft based on an older revision' : 'Unsaved draft recovered'} role="status">
            A draft from {relativeTime(recovered.savedAt)} was kept on this device{recovered.stale ? '; the document has changed since' : ''}.
            <div className="row" style={{ marginTop: 8 }}>
              <Button compact onClick={() => { loadContent(recovered.content); setRecovered(null); }}>Restore draft</Button>
              <Button compact variant="quiet" onClick={() => { setDraft(rec.id, null); setRecovered(null); }}>Discard draft</Button>
            </div>
          </Banner>
        )}
        {conflict && (
          <Banner tone="danger" title="Changed in another tab" role="alert">
            Revision {conflict} was saved elsewhere. Your edits are still here — export them, or discard them to load the newer revision.
            <div className="row" style={{ marginTop: 8 }}>
              <Button compact onClick={exportMd}>Export my edits</Button>
              <Button compact variant="danger" onClick={() => { setBase(rec); loadContent(rec.content); setConflict(null); setDraft(rec.id, null); }}>Discard and load r{conflict}</Button>
            </div>
          </Banner>
        )}
        <div className="row" role="group" aria-label="Lifecycle requests">
          <Button compact icon="checklist" blocked={gate('specifications:review', 'Request review')} reasonId={shared}>Request review</Button>
          <Button compact icon="freeze" blocked={gate('specifications:freeze', 'Freeze')} reasonId={shared}>Freeze</Button>
          <Button compact icon="send" blocked={gate('specifications:submit', 'Submit to AI')} reasonId={shared}>Submit to AI</Button>
          {connection !== 'connected' && <span className="caption" id="doc-gate-note">Connect review and freeze services before submission. <Link to="/connection">Resolve connection</Link></span>}
        </div>
        <Tabs label="Document view" value={tab} onValueChange={onTab} activation="manual" tabs={[
          { id: 'source', label: 'Source', content: <CodeEditor value={content} onChange={setContent} resetKey={resetKey} language="markdown" label={`${base.name} — Markdown source`} onSave={save} handleRef={editorRef} minHeight={480} /> },
          { id: 'preview', label: 'Preview', content: <div className="markdown-body doc-preview" dangerouslySetInnerHTML={{ __html: html }} /> },
        ]} />
      </div>
      {historyOpen && <DocHistory rec={base} current={content} onClose={() => setHistoryOpen(false)} onRestore={(c) => { loadContent(c); setHistoryOpen(false); toast({ tone: 'info', title: 'Revision loaded into the editor', body: 'Review it, then save to create a new device revision.' }); }} />}
      <Dialog open={blocker.state === 'blocked'} onOpenChange={(o) => { if (!o) blocker.reset?.(); }} title="Leave with unsaved changes?"
        description="A draft is kept on this device, but it is not a saved revision."
        footer={<>
          <Button onClick={() => blocker.reset?.()}>Stay and edit</Button>
          <Button onClick={async () => { await save(); blocker.proceed?.(); }}>Save and leave</Button>
          <Button variant="danger" onClick={() => { setDraft(rec.id, null); blocker.proceed?.(); }}>Discard and leave</Button>
        </>} />
    </section>
    <DocInspector content={deferred} hasDoc onGo={goToLine} />
    </>
  );
}

function DocHistory({ rec, current, onClose, onRestore }: { rec: DocumentRecord; current: string; onClose: () => void; onRestore: (content: string) => void }) {
  const [revs, setRevs] = useState<DocRevision[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  useEffect(() => { listDocRevisions(rec.id).then((r) => { setRevs(r); setSel(r[1]?.rev ?? r[0]?.rev ?? null); }); }, [rec.id, rec.rev]);
  const chosen = revs.find((r) => r.rev === sel);
  const diff = useMemo(() => (chosen ? withContext(diffLines(chosen.content, current)) : []), [chosen, current]);
  const changes = diff.filter((d) => d.op === 'add' || d.op === 'del').length;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} wide title="Document history" description="Every saved device revision is immutable and hashed. Compare a revision with the editor, or load it to save again."
      footer={<><Button onClick={onClose}>Close</Button><Button variant="primary" disabled={!chosen} onClick={() => chosen && onRestore(chosen.content)}>Load r{chosen?.rev ?? ''} into editor</Button></>}>
      {revs.length === 0 ? <p>No saved revisions.</p> : (
        <div className="history">
          <div className="stack" role="group" aria-label="Revisions">
            {revs.map((r) => (
              <button key={r.id} className="list-item" aria-pressed={r.rev === sel} onClick={() => setSel(r.rev)}>
                <span className="grow">r{r.rev} · {r.name}</span><span className="caption" title={r.savedAt}>{relativeTime(r.savedAt)}</span>
              </button>
            ))}
          </div>
          <div className="stack" style={{ minWidth: 0 }}>
            {chosen && <p className="caption mono break">sha256 {chosen.hash}</p>}
            {chosen && (changes === 0 ? <p>The editor matches r{chosen.rev}.</p> : (
              <div className="diff" role="table" aria-label={`Changes from r${chosen.rev} to the editor`}>
                {diff.map((d, i) => d.op === 'gap'
                  ? <div key={i} className="diff-gap" role="row"><span role="cell">… {d.count} unchanged lines</span></div>
                  : <div key={i} className={`diff-line diff-${d.op}`} role="row">
                      <span role="cell" className="diff-sign" aria-label={d.op === 'add' ? 'added' : d.op === 'del' ? 'removed' : 'unchanged'}>{d.op === 'add' ? '+' : d.op === 'del' ? '−' : ' '}</span>
                      <span role="cell" className="diff-text">{d.text || ' '}</span>
                    </div>)}
              </div>
            ))}
          </div>
        </div>
      )}
    </Dialog>
  );
}

function DocInspector({ content, hasDoc, onGo }: { content: string; hasDoc: boolean; onGo: (line: number) => void }) {
  const heads = useMemo(() => outline(content), [content]);
  const req = useMemo(() => requirements(content), [content]);
  return (
    <aside className="panel ide-inspector" aria-label="Document outline and lifecycle">
      <Tabs label="Document structure" tabs={[
        {
          id: 'outline', label: 'Outline', content: (
            <div className="panel-pad">
              <h2 className="eyebrow" style={{ marginBottom: 8 }}>Document outline</h2>
              {!hasDoc ? <p className="caption">Open a document to see its headings.</p> : heads.length === 0 ? <p className="caption">No headings yet. Use # Heading lines to structure the document.</p> : (
                <ul className="list" role="list">
                  {heads.map((h, i) => <li key={i}><button className="list-item outline-item" style={{ paddingLeft: 8 + (h.level - 1) * 12 }} onClick={() => onGo(h.line)}><span className="grow">{h.text}</span><span className="caption">L{h.line}</span></button></li>)}
                </ul>
              )}
            </div>
          ),
        },
        {
          id: 'requirements', label: 'Requirements', badge: hasDoc ? <span className="badge" style={{ marginLeft: 4 }}>{req.items.length + req.scenarios.length}</span> : undefined, content: (
            <div className="panel-pad stack-12">
              {!hasDoc ? <p className="caption">Open a document to see requirements and acceptance criteria.</p> : <>
                <div className="stack">
                  <h2 className="eyebrow">Requirements ({req.items.length})</h2>
                  {req.items.length === 0 ? <p className="caption">Add bullets under a “Requirements” heading or tag lines with REQ-1, AC-1…</p> : (
                    <ul className="list" role="list">{req.items.map((r, i) => <li key={i}><button className="list-item" onClick={() => onGo(r.line)}>{r.id && <Badge tone="accent">{r.id}</Badge>}<span className="grow clamp-2">{r.text}</span></button></li>)}</ul>
                  )}
                </div>
                <div className="stack">
                  <h2 className="eyebrow">Acceptance scenarios ({req.scenarios.length})</h2>
                  {req.scenarios.length === 0 ? <p className="caption">Write Given / When / Then lines to define acceptance criteria.</p> : req.scenarios.map((s, i) => (
                    <button key={i} className="scenario" onClick={() => onGo(s.line)}>
                      {s.steps.map((st, k) => <span key={k}><strong>{st.kw}</strong> {st.text}</span>)}
                    </button>
                  ))}
                </div>
              </>}
            </div>
          ),
        },
      ]} />
      <section className="panel-section stack" aria-labelledby="doclc-h">
        <h2 id="doclc-h" className="eyebrow">Document lifecycle</h2>
        <ol className="lc-steps" aria-label="Document lifecycle">
          <li data-current={hasDoc || undefined}><span>Device draft</span><span className="caption">{hasDoc ? 'Current' : ''}</span></li>
          {LIFECYCLE.slice(1).map((s) => <li key={s}><span>{s}</span><span className="caption">Requires service</span></li>)}
        </ol>
      </section>
    </aside>
  );
}
