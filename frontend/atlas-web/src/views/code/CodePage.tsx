import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { nav } from '../../data/catalog';
import { capability, toast } from '../../data/app-store';
import { analyze, deleteSnapshot, importFolder, LIMITS, listSnapshots, manifest, searchLiteral, type ImportProgress, type SymbolEntry } from '../../lib/sources';
import type { DocumentRecord, SourceFile, SourceSnapshot } from '../../lib/storage';
import { useDeviceQuery } from '../../lib/hooks';
import { bytes, relativeTime } from '../../lib/format';
import { downloadJson } from '../../lib/definitions';
import { Badge, Banner, Button, EmptyState, PageHeader, Panel } from '../../components/ui';
import { Dialog } from '../../components/overlays';
import type { EditorHandle } from '../../components/CodeEditor';
import { languageFor } from '../../components/editor-language';
import { LazyCodeEditor as CodeEditor } from '../../components/LazyCodeEditor';
import { ResponsiveIde } from '../../components/ResponsiveIde';
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
  // Symbols & quality state is shared by the inspector and the file toolbar (Definition / References).
  const [analysis, setAnalysis] = useState<ReturnType<typeof analyze> | null>(null);
  const [symbol, setSymbol] = useState<SymbolEntry | null>(null);
  const [focus, setFocus] = useState<'definition' | 'references'>('definition');
  useEffect(() => { setAnalysis(null); setSymbol(null); }, [snap?.id]);
  const pickImport = () => dirRef.current?.click();
  return (
    <div className="page page-ide">
      <PageHeader title={m.title} purpose={m.purpose} actions={<>
        <Button blocked={connect.ok ? 'Requires an authorized repository connection contract.' : connect.reason} reasonId="repo-reason">Connect repository</Button>
        <Button variant="primary" onClick={pickImport} disabled={!!progress}>{progress ? `Importing ${progress.done}/${progress.total}…` : 'Import folder'}</Button>
        <input ref={dirRef} type="file" hidden multiple {...{ webkitdirectory: '', directory: '' }} onChange={(e) => { if (e.target.files?.length) onImport(e.target.files); e.target.value = ''; }} />
      </>} />
      {!connect.ok && <p id="repo-reason" className="caption">Connect repository: repository connections, refs and full commit IDs come from an authorized repository integration. Import a local folder to browse source now.</p>}
      <ProvenanceBanner detail="A local snapshot is read-only and is not a Git commit." />
      <ResponsiveIde activeKey={file?.path}>
        <section className="panel ide-side" aria-labelledby="snap-h">
          <div className="panel-pad stack">
            <h2 id="snap-h" className="eyebrow">Local source snapshot</h2>
            <p className="label break">{snap ? snap.name : loading ? 'Loading snapshots…' : 'No snapshot imported'}</p>
            {snaps.length > 1 && snap && (
              <div className="field">
                <label className="field-label" htmlFor="snap-pick">Snapshot</label>
                <select id="snap-pick" className="select" value={snap.id} onChange={(e) => setParams(new URLSearchParams({ snap: e.target.value }))}>
                  {snaps.map((s) => <option key={s.id} value={s.id}>{s.name} · {relativeTime(s.importedAt)}</option>)}
                </select>
              </div>
            )}
            {snap && <p className="caption mono source-stamp" title={snap.digest}><span>{snap.files.length} files · digest {snap.digest.slice(0, 12)}…</span><time dateTime={snap.importedAt}>{relativeTime(snap.importedAt)}</time></p>}
          </div>
          {snap ? (
            <div className="ide-tree">
              <DocTree items={items} selectedId={selected} onSelect={setSelected} onOpen={(r) => openFile(r.id)} label={`Files in ${snap.name}`} />
            </div>
          ) : (
            <p className="caption" style={{ padding: '0 var(--space-16) var(--space-12)' }}>
              {loading ? 'Reading device storage.' : `Import a folder to list its files here. Limits: ${LIMITS.files} files, ${bytes(LIMITS.fileBytes)} per file, ${bytes(LIMITS.totalBytes)} total; node_modules, .git and build output are skipped.`}
            </p>
          )}
          <SourceSearch snap={snap} onOpen={openFile} />
          {snap && (
            <div className="panel-section stack">
              {snap.skipped.length > 0 && (
                <details><summary className="caption" style={{ cursor: 'pointer' }}>{snap.skipped.length} skipped</summary>
                  <ul className="stack" style={{ marginTop: 6, paddingLeft: 16 }}>{snap.skipped.slice(0, 100).map((s, i) => <li key={i} className="caption break">{s.path} — {s.reason}</li>)}</ul>
                </details>
              )}
              <Button compact variant="danger" icon="trash" onClick={() => setConfirmDelete(true)}>Remove snapshot</Button>
            </div>
          )}
        </section>
        <div className="ide-main">
          {file ? <FileView key={file.path} file={file} editorRef={editorRef} symbol={symbol} onFocus={setFocus} onOpen={openFile} defs={analysis && symbol ? analysis.symbols.filter((x) => x.name === symbol.name) : []} /> : (
            <Panel>
              {snap
                ? <EmptyState icon="file" title="Select a file">Choose a file in the tree, or search the snapshot. Files are read-only.</EmptyState>
                : <EmptyState icon="code" title={loading ? 'Loading snapshots…' : 'No local source snapshot'} actions={!loading && <Button variant="primary" icon="upload" onClick={pickImport}>Import folder</Button>}>
                    Import a folder to browse files, search content and outline JS/TS symbols on this device. Files stay in this browser.
                  </EmptyState>}
            </Panel>
          )}
        </div>
        <CodeInspector snap={snap} file={file} onOpen={openFile} analysis={analysis} onAnalyze={() => snap && setAnalysis(analyze(snap))} symbol={symbol} onSymbol={setSymbol} focus={focus} />
      </ResponsiveIde>
      <ModuleViews module="code" />
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete} title={`Remove “${snap?.name ?? ''}”?`} description="The snapshot and its file contents are deleted from this browser. Your folder on disk is not touched."
        footer={<><Button onClick={() => setConfirmDelete(false)}>Cancel</Button><Button variant="danger" onClick={async () => { const id = snap!.id; setConfirmDelete(false); await deleteSnapshot(id); setParams(new URLSearchParams()); toast({ tone: 'success', title: 'Snapshot removed' }); }}>Remove snapshot</Button></>} />
    </div>
  );
}

/** Figma places source search under the snapshot tree: literal content search across every imported text file. */
function SourceSearch({ snap, onOpen }: { snap: SourceSnapshot | null; onOpen: (path: string, line?: number) => void }) {
  const [q, setQ] = useState('');
  const [cs, setCs] = useState(false);
  const [ww, setWw] = useState(false);
  const dq = useDeferredValue(q);
  const result = useMemo(() => (snap && dq.trim().length >= 2 ? searchLiteral(snap, dq, { caseSensitive: cs, wholeWord: ww }) : null), [snap, dq, cs, ww]);
  return (
    <div className="panel-pad stack" style={{ paddingTop: 'var(--space-8)' }}>
      <div className="field">
        <label className="field-label" htmlFor="lit-q">Search source</label>
        <input id="lit-q" className="input mono" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Text to find" aria-describedby="lit-hint" disabled={!snap} />
        <small id="lit-hint" className="field-hint">{snap ? 'Literal content search · exact text, at least 2 characters' : 'Literal content search · import a folder first'}</small>
      </div>
      {snap && (
        <div className="row">
          <label className="checkbox caption"><input type="checkbox" checked={cs} onChange={(e) => setCs(e.target.checked)} /> Match case</label>
          <label className="checkbox caption"><input type="checkbox" checked={ww} onChange={(e) => setWw(e.target.checked)} /> Whole word</label>
        </div>
      )}
      {result && <p className="caption" role="status">{result.hits.length}{result.truncated ? '+' : ''} matches{result.truncated ? ' (first 500 shown)' : ''}</p>}
      {result && <HitList hits={result.hits} onOpen={onOpen} />}
    </div>
  );
}

function FileView({ file, editorRef, symbol, defs, onFocus, onOpen }: {
  file: SourceFile; editorRef: React.RefObject<EditorHandle | null>; symbol: SymbolEntry | null; defs: SymbolEntry[];
  onFocus: (f: 'definition' | 'references') => void; onOpen: (path: string, line?: number) => void;
}) {
  const lang = languageFor(file.path);
  const lines = file.text ? file.text.split('\n').length : 0;
  const ctx = capability('code:context-add', 'Add to context');
  const edit = capability('code:edit-workspace', 'Edit workspace');
  const noSymbol = symbol ? undefined : 'Select a symbol in Symbols & quality first (run Analyze JS/TS).';
  return (
    <section className="panel" aria-labelledby="file-h">
      <div className="panel-pad stack-12">
        <div className="row-between">
          <div className="stack" style={{ gap: 2, minWidth: 0 }}>
            <h1 id="file-h" tabIndex={-1} data-page-title className="doc-title mono break">{file.path}</h1>
            <span className="caption mono">{bytes(file.size)}{file.text ? ` · ${lines} lines` : ''} · sha256 {file.sha256.slice(0, 12)}…</span>
          </div>
          <Badge>{lang === 'text' ? 'Plain text' : lang.toUpperCase()}</Badge>
        </div>
        <div className="row" role="group" aria-label="File actions" aria-describedby="file-gate">
          <Button blocked={noSymbol} reasonId="file-gate" onClick={() => { onFocus('definition'); if (defs[0]) onOpen(defs[0].path, defs[0].line); }}>Definition</Button>
          <Button blocked={noSymbol} reasonId="file-gate" onClick={() => onFocus('references')}>References</Button>
          <Button blocked="A local snapshot has no Git history." reasonId="file-gate">History</Button>
          <Button blocked={ctx.ok ? 'Requires an authorized context package and service command.' : ctx.reason} reasonId="file-gate">Add to context</Button>
          <Button blocked={edit.ok ? 'Requires an authorized workspace and service command.' : edit.reason} reasonId="file-gate">Edit workspace</Button>
        </div>
        <ul id="file-gate" className="caption stack" style={{ gap: 2, margin: 0, paddingLeft: 'var(--space-16)' }}>
          {noSymbol && <li>Definition, References: {noSymbol}</li>}
          <li>History: a local snapshot has no Git history.</li>
          {!ctx.ok && <li>Add to context: {ctx.reason}</li>}
          {!edit.ok && <li>Edit workspace: {edit.reason}</li>}
        </ul>
        {file.binary || file.text === null
          ? <Banner tone="info" title="Binary or non-UTF-8 file">Not displayed. Size and SHA-256 are recorded in the manifest.</Banner>
          : <CodeEditor value={file.text} readOnly language={lang} label={`${file.path} (read-only)`} handleRef={editorRef} resetKey={file.path} minHeight={520} />}
        <p className="caption">Read-only · local snapshot · not a Git commit</p>
      </div>
    </section>
  );
}

function CodeInspector({ snap, file, onOpen, analysis, onAnalyze, symbol, onSymbol, focus }: {
  snap: SourceSnapshot | null; file: SourceFile | null; onOpen: (path: string, line?: number) => void;
  analysis: ReturnType<typeof analyze> | null; onAnalyze: () => void; symbol: SymbolEntry | null; onSymbol: (s: SymbolEntry) => void; focus: 'definition' | 'references';
}) {
  const fileSymbols = analysis && file ? analysis.symbols.filter((s) => s.path === file.path) : [];
  const listed = file ? fileSymbols : (analysis?.symbols.filter((s) => s.exported).slice(0, 50) ?? []);
  const defs = symbol && analysis ? analysis.symbols.filter((s) => s.name === symbol.name) : [];
  const refs = useMemo(() => (snap && symbol ? searchLiteral(snap, symbol.name, { caseSensitive: true, wholeWord: true, limit: 300 }) : null), [snap, symbol]);
  const noSnap = snap ? undefined : 'Import a folder first; analysis runs only on a local snapshot.';
  return (
    <aside className="panel ide-inspector" aria-label="Symbols and quality">
      <div className="panel-pad stack-12">
        <section className="stack" aria-labelledby="sym-h">
          <h2 id="sym-h">Symbols &amp; quality</h2>
          <div><Badge tone="info">Standalone local JS/TS</Badge></div>
          {!analysis ? (
            <p className="caption">Outline top-level JS/TS declarations to jump to definitions and find references.</p>
          ) : (
            <>
              <p className="caption" role="status">{analysis.symbols.length} symbols in {analysis.files} JS/TS files · {analysis.todos.length} TODO/FIXME</p>
              {listed.length === 0 ? <p className="caption">{file ? 'No top-level declarations in this file.' : 'No exported declarations found.'}</p> : (
                <ul className="list" role="list" aria-label={file ? 'Symbols in this file' : 'Exported symbols'}>{listed.map((s, i) => (
                  <li key={i}><button className="list-item caption" aria-pressed={symbol === s} onClick={() => { onSymbol(s); onOpen(s.path, s.line); }}><span className="grow mono break">{s.name} · {s.kind}</span><span className="caption">L{s.line}</span></button></li>
                ))}</ul>
              )}
              {symbol && (
                <div className="stack">
                  {focus === 'definition' ? <>
                    <h3 className="eyebrow">Definition · {symbol.name}</h3>
                    <HitList hits={defs.map((d) => ({ path: d.path, line: d.line, col: 0, text: `${d.exported ? 'export ' : ''}${d.kind} ${d.name}` }))} onOpen={onOpen} />
                  </> : <>
                    <h3 className="eyebrow">References · {symbol.name} ({refs?.hits.length ?? 0}{refs?.truncated ? '+' : ''})</h3>
                    {refs && <HitList hits={refs.hits} onOpen={onOpen} />}
                  </>}
                </div>
              )}
              {analysis.todos.length > 0 && (
                <details><summary className="eyebrow" style={{ cursor: 'pointer' }}>TODO / FIXME ({analysis.todos.length})</summary>
                  <HitList hits={analysis.todos.slice(0, 100).map((t) => ({ ...t, col: 0 }))} onOpen={onOpen} />
                </details>
              )}
            </>
          )}
        </section>
        <section className="stack" aria-labelledby="cov-h">
          <h2 id="cov-h">Coverage boundary</h2>
          <ul className="caption stack" style={{ gap: 'var(--space-8)', margin: 0, padding: 0, listStyle: 'none' }}>
            <li>AST and semantics: line-pattern outline of imported JS/TS only</li>
            <li>Imports, scopes and re-exports: not resolved</li>
            <li>External libraries: excluded</li>
            <li>Other languages and binary files: not analyzed{snap?.skipped.length ? ` · ${snap.skipped.length} skipped paths` : ''}</li>
            <li>CI verdict: not observed</li>
          </ul>
        </section>
        <div className="stack" style={{ alignItems: 'flex-start' }}>
          <Button blocked={noSnap} reasonId={noSnap && 'snap-reason'} onClick={onAnalyze}>Analyze JS/TS</Button>
          <Button blocked={noSnap} reasonId={noSnap && 'snap-reason'} onClick={() => snap && downloadJson(`${snap.name}-manifest.json`, manifest(snap))}>Export source manifest</Button>
          {noSnap && <p id="snap-reason" className="caption">Analyze JS/TS, Export source manifest: {noSnap}</p>}
        </div>
      </div>
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
