import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { nav } from '../../data/catalog';
import { capability, toast } from '../../data/app-store';
import { analyze, deleteSnapshot, importFolder, LIMITS, listSnapshots, manifest, searchLiteral, type ImportProgress, type SymbolEntry } from '../../lib/sources';
import type { DocumentRecord, SourceFile, SourceSnapshot } from '../../lib/storage';
import { useDeviceQuery } from '../../lib/hooks';
import { bytes, relativeTime } from '../../lib/format';
import { downloadJson } from '../../lib/definitions';
import { Badge, Banner, Button, EmptyState, KeyValue, PageHeader, Panel } from '../../components/ui';
import { Dialog, Tabs } from '../../components/overlays';
import { CodeEditor, languageFor, type EditorHandle } from '../../components/CodeEditor';
import { usePageMeta } from '../../shell/page-meta';
import { ProvenanceBanner } from '../shared';
import { ModuleViews } from '../modules/common';
import { DocTree } from '../specs/DocTree';

/** Folders and files of a snapshot as tree items (ids are paths; folders are prefixed so they never clash with files). */
function treeItems(files: SourceFile[]): DocumentRecord[] {
  const out = new Map<string, DocumentRecord>();
  const base = { content: '', rev: 1, archived: false, favorite: false, properties: {}, createdAt: '', updatedAt: '' };
  for (const f of files) {
    const seg = f.path.split('/');
    for (let i = 0; i < seg.length - 1; i++) {
      const id = `dir:${seg.slice(0, i + 1).join('/')}`;
      if (!out.has(id)) out.set(id, { ...base, id, kind: 'folder', name: seg[i], parentId: i ? `dir:${seg.slice(0, i).join('/')}` : null });
    }
    out.set(f.path, { ...base, id: f.path, kind: 'document', name: seg[seg.length - 1], parentId: seg.length > 1 ? `dir:${seg.slice(0, -1).join('/')}` : null });
  }
  return [...out.values()];
}

export default function CodePage() {
  const m = nav.modules.code;
  const [params, setParams] = useSearchParams();
  const { data: snaps, loading } = useDeviceQuery(listSnapshots, [], [] as SourceSnapshot[]);
  const snapId = params.get('snap') ?? snaps[0]?.id ?? null;
  const snap = snaps.find((s) => s.id === snapId) ?? null;
  const filePath = params.get('file');
  const file = snap?.files.find((f) => f.path === filePath) ?? null;
  usePageMeta(file ? file.path.split('/').pop()! : m.title, [{ label: m.label, to: '/code' }, ...(file ? [{ label: file.path }] : [])]);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [selected, setSelected] = useState<string | null>(filePath);
  const [q, setQ] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dirRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<EditorHandle | null>(null);
  const items = useMemo(() => (snap ? treeItems(snap.files) : []), [snap]);
  const set = (patch: Record<string, string | null>) => { const n = new URLSearchParams(params); for (const [k, v] of Object.entries(patch)) { if (v === null) n.delete(k); else n.set(k, v); } setParams(n); };
  const openFile = (path: string, line?: number) => {
    setSelected(path);
    set({ snap: snap?.id ?? null, file: path, line: line ? String(line) : null });
  };
  const line = Number(params.get('line')) || 0;
  useEffect(() => { if (file && line) requestAnimationFrame(() => editorRef.current?.goToLine(line)); }, [file?.path, line]); // eslint-disable-line react-hooks/exhaustive-deps
  const onImport = async (list: FileList) => {
    setProgress({ done: 0, total: list.length });
    try {
      const s = await importFolder([...list], setProgress);
      toast({ tone: s.skipped.length ? 'warning' : 'success', title: `Snapshot “${s.name}” imported`, body: `${s.files.length} files · ${s.skipped.length} skipped · digest ${s.digest.slice(0, 12)}…` });
      setParams(new URLSearchParams({ snap: s.id }));
    } catch (e) { toast({ tone: 'danger', title: 'Import failed', body: e instanceof Error ? e.message : String(e) }); }
    finally { setProgress(null); }
  };
  const connect = capability('code:repository-connect', 'Connect repository');
  return (
    <div className="page page-ide">
      <PageHeader eyebrow={m.label} title={m.title} purpose={m.purpose} actions={<>
        <Button icon="branch" blocked={connect.ok ? undefined : connect.reason} reasonId={connect.ok ? undefined : 'repo-reason'}>Connect repository</Button>
        <Button icon="upload" variant="primary" onClick={() => dirRef.current?.click()} disabled={!!progress}>{progress ? `Importing ${progress.done}/${progress.total}…` : 'Import folder'}</Button>
        <input ref={dirRef} type="file" hidden multiple {...{ webkitdirectory: '', directory: '' }} onChange={(e) => { if (e.target.files?.length) onImport(e.target.files); e.target.value = ''; }} />
        {snap && <Button icon="download" onClick={() => downloadJson(`${snap.name}-manifest.json`, manifest(snap))}>Export source manifest</Button>}
      </>} />
      {!connect.ok && <p id="repo-reason" className="caption">Repository connections, refs and full commit IDs come from an authorized repository integration. Import a local folder to browse source now.</p>}
      <ProvenanceBanner detail="A local snapshot is read-only and is not a Git commit." />
      {!snap ? (
        <Panel>
          <EmptyState icon="code" title={loading ? 'Loading snapshots…' : 'No local source snapshot'} actions={!loading && <Button variant="primary" icon="upload" onClick={() => dirRef.current?.click()}>Import folder</Button>}>
            Import a folder to browse files, search content and outline JS/TS symbols on this device. Files stay in this browser. Limits: {LIMITS.files} files, {bytes(LIMITS.fileBytes)} per file, {bytes(LIMITS.totalBytes)} total; node_modules, .git and build output are skipped.
          </EmptyState>
        </Panel>
      ) : (
        <div className="ide">
          <section className="panel ide-side" aria-labelledby="snap-h">
            <div className="panel-head"><h2 id="snap-h" className="eyebrow">Local source snapshot</h2><span className="caption">{snap.files.length}</span></div>
            <div className="panel-pad stack-12">
              {snaps.length > 1 && (
                <div className="field">
                  <label className="field-label" htmlFor="snap-pick">Snapshot</label>
                  <select id="snap-pick" className="select" value={snap.id} onChange={(e) => setParams(new URLSearchParams({ snap: e.target.value }))}>
                    {snaps.map((s) => <option key={s.id} value={s.id}>{s.name} · {relativeTime(s.importedAt)}</option>)}
                  </select>
                </div>
              )}
              <KeyValue items={[['Name', snap.name], ['Digest', <span key="d" className="mono" title={snap.digest}>{snap.digest.slice(0, 16)}…</span>], ['Imported', relativeTime(snap.importedAt)]]} />
              <div className="field">
                <label className="field-label" htmlFor="file-filter">Search source</label>
                <input id="file-filter" className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="File name" />
              </div>
            </div>
            <div className="ide-tree">
              <DocTree items={items} selectedId={selected} onSelect={setSelected} onOpen={(r) => openFile(r.id)} filter={q} label={`Files in ${snap.name}`} />
            </div>
            <div className="panel-section stack">
              {snap.skipped.length > 0 && (
                <details><summary className="caption" style={{ cursor: 'pointer' }}>{snap.skipped.length} skipped</summary>
                  <ul className="stack" style={{ marginTop: 6, paddingLeft: 16 }}>{snap.skipped.slice(0, 100).map((s, i) => <li key={i} className="caption break">{s.path} — {s.reason}</li>)}</ul>
                </details>
              )}
              <Button compact variant="danger" icon="trash" onClick={() => setConfirmDelete(true)}>Remove snapshot</Button>
            </div>
          </section>
          <div className="ide-main">
            {file ? <FileView key={file.path} file={file} editorRef={editorRef} /> : (
              <Panel><EmptyState icon="file" title="Select a file">Choose a file in the tree, or search the snapshot. Files are read-only.</EmptyState></Panel>
            )}
          </div>
          <CodeInspector snap={snap} file={file} onOpen={openFile} />
        </div>
      )}
      <ModuleViews module="code" />
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete} title={`Remove “${snap?.name ?? ''}”?`} description="The snapshot and its file contents are deleted from this browser. Your folder on disk is not touched."
        footer={<><Button onClick={() => setConfirmDelete(false)}>Cancel</Button><Button variant="danger" onClick={async () => { const id = snap!.id; setConfirmDelete(false); await deleteSnapshot(id); setParams(new URLSearchParams()); toast({ tone: 'success', title: 'Snapshot removed' }); }}>Remove snapshot</Button></>} />
    </div>
  );
}

function FileView({ file, editorRef }: { file: SourceFile; editorRef: React.RefObject<EditorHandle | null> }) {
  const lang = languageFor(file.path);
  const lines = file.text ? file.text.split('\n').length : 0;
  const ctx = capability('code:context-add', 'Add to context');
  const edit = capability('code:edit-workspace', 'Edit workspace');
  return (
    <section className="panel" aria-labelledby="file-h">
      <div className="panel-head" style={{ flexWrap: 'wrap' }}>
        <div className="stack" style={{ gap: 2, minWidth: 0 }}>
          <h1 id="file-h" tabIndex={-1} data-page-title className="doc-title mono break">{file.path}</h1>
          <span className="caption mono">{bytes(file.size)}{file.text ? ` · ${lines} lines` : ''} · sha256 {file.sha256.slice(0, 12)}…</span>
        </div>
        <div className="row">
          <Badge>{lang === 'text' ? 'Plain text' : lang.toUpperCase()}</Badge>
          <Button compact icon="history" blocked="A local snapshot has no Git history." reasonId="file-gate">History</Button>
          <Button compact icon="plus" blocked={ctx.ok ? undefined : ctx.reason} reasonId="file-gate">Add to context</Button>
          <Button compact icon="edit" blocked={edit.ok ? undefined : edit.reason} reasonId="file-gate">Edit workspace</Button>
        </div>
      </div>
      <div className="panel-pad stack-12">
        <p id="file-gate" className="caption">Read-only · local snapshot · not a Git commit. Context and edit workspaces need an authorized service with a pinned commit.</p>
        {file.binary || file.text === null
          ? <Banner tone="info" title="Binary or non-UTF-8 file">Not displayed. Size and SHA-256 are recorded in the manifest.</Banner>
          : <CodeEditor value={file.text} readOnly language={lang} label={`${file.path} (read-only)`} handleRef={editorRef} resetKey={file.path} minHeight={520} />}
      </div>
    </section>
  );
}

function CodeInspector({ snap, file, onOpen }: { snap: SourceSnapshot; file: SourceFile | null; onOpen: (path: string, line?: number) => void }) {
  const [q, setQ] = useState('');
  const [cs, setCs] = useState(false);
  const [ww, setWw] = useState(false);
  const dq = useDeferredValue(q);
  const result = useMemo(() => (dq.trim().length >= 2 ? searchLiteral(snap, dq, { caseSensitive: cs, wholeWord: ww }) : null), [snap, dq, cs, ww]);
  const [analysis, setAnalysis] = useState<ReturnType<typeof analyze> | null>(null);
  const [symbol, setSymbol] = useState<SymbolEntry | null>(null);
  useEffect(() => { setAnalysis(null); setSymbol(null); }, [snap.id]);
  const fileSymbols = analysis && file ? analysis.symbols.filter((s) => s.path === file.path) : [];
  const defs = symbol && analysis ? analysis.symbols.filter((s) => s.name === symbol.name) : [];
  const refs = useMemo(() => (symbol ? searchLiteral(snap, symbol.name, { caseSensitive: true, wholeWord: true, limit: 300 }) : null), [snap, symbol]);
  return (
    <aside className="panel ide-inspector" aria-label="Search and symbols">
      <Tabs label="Code tools" tabs={[
        {
          id: 'search', label: 'Search', content: (
            <div className="panel-pad stack-12">
              <div className="field">
                <label className="field-label" htmlFor="lit-q">Literal content search</label>
                <input id="lit-q" className="input mono" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Text to find" aria-describedby="lit-hint" />
                <small id="lit-hint" className="field-hint">Exact text (not a regular expression). At least 2 characters.</small>
              </div>
              <div className="row">
                <label className="checkbox"><input type="checkbox" checked={cs} onChange={(e) => setCs(e.target.checked)} /> Match case</label>
                <label className="checkbox"><input type="checkbox" checked={ww} onChange={(e) => setWw(e.target.checked)} /> Whole word</label>
              </div>
              {result && <p className="caption" role="status">{result.hits.length}{result.truncated ? '+' : ''} matches{result.truncated ? ' (first 500 shown)' : ''}</p>}
              {result && <HitList hits={result.hits} onOpen={onOpen} />}
            </div>
          ),
        },
        {
          id: 'symbols', label: 'Symbols & quality', content: (
            <div className="panel-pad stack-12">
              {!analysis ? (
                <>
                  <p className="caption">Outline top-level JS/TS declarations to jump to definitions and find references.</p>
                  <Button icon="braces" onClick={() => setAnalysis(analyze(snap))}>Analyze JS/TS</Button>
                </>
              ) : (
                <>
                  <p className="caption" role="status">{analysis.symbols.length} symbols in {analysis.files} JS/TS files · {analysis.todos.length} TODO/FIXME</p>
                  {file && (
                    <div className="stack">
                      <h2 className="eyebrow">In this file</h2>
                      {fileSymbols.length === 0 ? <p className="caption">No top-level declarations found.</p> : (
                        <ul className="list" role="list">{fileSymbols.map((s, i) => (
                          <li key={i}><button className="list-item" aria-pressed={symbol === s} onClick={() => { setSymbol(s); onOpen(s.path, s.line); }}><Badge>{s.kind}</Badge><span className="grow mono break">{s.name}</span><span className="caption">L{s.line}</span></button></li>
                        ))}</ul>
                      )}
                    </div>
                  )}
                  {symbol && (
                    <div className="stack">
                      <h2 className="eyebrow">Definition · {symbol.name}</h2>
                      <HitList hits={defs.map((d) => ({ path: d.path, line: d.line, col: 0, text: `${d.exported ? 'export ' : ''}${d.kind} ${d.name}` }))} onOpen={onOpen} />
                      <h2 className="eyebrow">References ({refs?.hits.length ?? 0}{refs?.truncated ? '+' : ''})</h2>
                      {refs && <HitList hits={refs.hits} onOpen={onOpen} />}
                    </div>
                  )}
                  {analysis.todos.length > 0 && (
                    <details><summary className="eyebrow" style={{ cursor: 'pointer' }}>TODO / FIXME ({analysis.todos.length})</summary>
                      <HitList hits={analysis.todos.slice(0, 100).map((t) => ({ ...t, col: 0 }))} onOpen={onOpen} />
                    </details>
                  )}
                </>
              )}
              <div className="stack">
                <h2 className="eyebrow">Coverage boundary</h2>
                <p className="caption">Line-pattern outline of top-level declarations; not a compiler or AST index. Imports, scopes, overloads and re-exports are not resolved. References are whole-word text matches. Other languages, binary files and {snap.skipped.length} skipped paths are not analyzed.</p>
              </div>
            </div>
          ),
        },
      ]} />
    </aside>
  );
}

function HitList({ hits, onOpen }: { hits: { path: string; line: number; col: number; text: string }[]; onOpen: (p: string, l?: number) => void }) {
  if (!hits.length) return <p className="caption">No matches.</p>;
  return (
    <ul className="list hits" role="list">
      {hits.map((h, i) => (
        <li key={i}>
          <button className="list-item hit" onClick={() => onOpen(h.path, h.line)}>
            <span className="caption mono break">{h.path}:{h.line}</span>
            <span className="mono hit-text">{h.text.trim() || ' '}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
