import { sha256Hex } from './hash';
import { newId } from './ids';
import { del, getAll, put, type SourceFile, type SourceSnapshot } from './storage';

/** Immutable local source snapshots (folder import). Not a Git commit: no refs, history or remote identity. */
export const LIMITS = { files: 3000, fileBytes: 512 * 1024, totalBytes: 30 * 1024 * 1024 };
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', 'coverage', 'vendor', 'target', '__pycache__', '.venv', 'venv', '.cache', '.turbo', '.idea', '.vscode']);
const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|bmp|tiff?|pdf|zip|gz|tgz|bz2|xz|7z|rar|jar|war|class|exe|dll|so|dylib|o|a|bin|woff2?|ttf|otf|eot|mp[34]|mov|avi|webm|wav|ogg|flac|psd|sketch|fig|sqlite|db|lockb)$/i;

export interface ImportProgress { done: number; total: number }

export async function importFolder(files: File[], onProgress?: (p: ImportProgress) => void): Promise<SourceSnapshot> {
  const root = (files[0] as File & { webkitRelativePath?: string })?.webkitRelativePath?.split('/')[0] || 'Local folder';
  const skipped: { path: string; reason: string }[] = [];
  const out: SourceFile[] = [];
  let total = 0;
  const candidates = files.map((f) => ({ f, path: ((f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name).split('/').slice(1).join('/') || f.name }));
  let i = 0;
  for (const { f, path } of candidates) {
    i++;
    if (i % 25 === 0) { onProgress?.({ done: i, total: candidates.length }); await new Promise((r) => setTimeout(r)); }
    const seg = path.split('/');
    const ignoredDir = seg.slice(0, -1).find((s) => IGNORED_DIRS.has(s));
    if (ignoredDir) { if (!skipped.some((s) => s.path === ignoredDir)) skipped.push({ path: ignoredDir, reason: 'Ignored directory' }); continue; }
    if (out.length >= LIMITS.files) { skipped.push({ path, reason: `Over the ${LIMITS.files}-file limit` }); continue; }
    if (f.size > LIMITS.fileBytes) { skipped.push({ path, reason: `Larger than ${LIMITS.fileBytes / 1024} KB` }); continue; }
    if (total + f.size > LIMITS.totalBytes) { skipped.push({ path, reason: 'Snapshot size limit reached' }); continue; }
    const buf = new Uint8Array(await f.arrayBuffer());
    const sha = await sha256Hex(buf);
    const binary = BINARY_EXT.test(path) || buf.subarray(0, 8000).includes(0);
    let text: string | null = null;
    if (!binary) {
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { text = null; }
    }
    out.push({ path, size: f.size, sha256: sha, text, binary: binary || text === null });
    total += f.size;
  }
  out.sort((a, b) => a.path.localeCompare(b.path));
  const digest = await sha256Hex(out.map((f) => `${f.path}\u0000${f.sha256}`).join('\n'));
  const snap: SourceSnapshot = { id: newId('snap'), name: root, digest, files: out, importedAt: new Date().toISOString(), skipped };
  await put('sources', snap);
  onProgress?.({ done: candidates.length, total: candidates.length });
  return snap;
}

export const listSnapshots = async () => (await getAll<SourceSnapshot>('sources')).sort((a, b) => b.importedAt.localeCompare(a.importedAt));
export const deleteSnapshot = (id: string) => del('sources', id);

export function manifest(s: SourceSnapshot) {
  return {
    format: 'atlas-source-manifest/v1', authority: 'DEVICE_ONLY', note: 'Local snapshot — not a Git commit; no ref, remote or history is implied.',
    name: s.name, digest: s.digest, importedAt: s.importedAt, files: s.files.map((f) => ({ path: f.path, size: f.size, sha256: f.sha256, binary: f.binary })), skipped: s.skipped,
  };
}

export interface Hit { path: string; line: number; col: number; text: string }
/** Literal (non-regex) content search. Results are capped so a broad query stays responsive. */
export function searchLiteral(s: SourceSnapshot, q: string, opts: { caseSensitive?: boolean; wholeWord?: boolean; limit?: number } = {}): { hits: Hit[]; truncated: boolean } {
  const limit = opts.limit ?? 500;
  const needle = opts.caseSensitive ? q : q.toLowerCase();
  const word = opts.wholeWord ? new RegExp(`(^|[^\\w$])${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^\\w$])`, opts.caseSensitive ? '' : 'i') : null;
  const hits: Hit[] = [];
  for (const f of s.files) {
    if (!f.text) continue;
    const lines = f.text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const col = word ? (l.match(word) ? (l.match(word)!.index ?? 0) + (l.match(word)![1]?.length ?? 0) : -1) : (opts.caseSensitive ? l : l.toLowerCase()).indexOf(needle);
      if (col >= 0) {
        hits.push({ path: f.path, line: i + 1, col, text: l.length > 240 ? `${l.slice(Math.max(0, col - 80), col + 160)}` : l });
        if (hits.length >= limit) return { hits, truncated: true };
      }
    }
  }
  return { hits, truncated: false };
}

export interface SymbolEntry { name: string; kind: 'function' | 'class' | 'interface' | 'type' | 'enum' | 'const' | 'variable'; path: string; line: number; exported: boolean }
const JS_TS = /\.(m|c)?(j|t)sx?$/i;
const RULES: [RegExp, SymbolEntry['kind']][] = [
  [/^\s*(export\s+(?:default\s+)?)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/, 'function'],
  [/^\s*(export\s+(?:default\s+)?)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/, 'class'],
  [/^\s*(export\s+)?(?:declare\s+)?interface\s+([A-Za-z_$][\w$]*)/, 'interface'],
  [/^\s*(export\s+)?(?:declare\s+)?type\s+([A-Za-z_$][\w$]*)\s*(?:<[^=]*>)?\s*=/, 'type'],
  [/^\s*(export\s+)?(?:const\s+|declare\s+)?enum\s+([A-Za-z_$][\w$]*)/, 'enum'],
  [/^(export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::[^=]+)?=>/, 'function'],
  [/^(export\s+)?const\s+([A-Za-z_$][\w$]*)/, 'const'],
  [/^(export\s+)?(?:let|var)\s+([A-Za-z_$][\w$]*)/, 'variable'],
];
/**
 * Heuristic JS/TS outline (line patterns, not a compiler). It finds top-level declarations; it does not resolve imports,
 * scopes, overloads or re-exports — the coverage boundary is shown to the user.
 */
export function analyze(s: SourceSnapshot): { symbols: SymbolEntry[]; files: number; skipped: number; todos: { path: string; line: number; text: string }[] } {
  const symbols: SymbolEntry[] = [];
  const todos: { path: string; line: number; text: string }[] = [];
  let files = 0, skipped = 0;
  for (const f of s.files) {
    if (!JS_TS.test(f.path)) continue;
    if (!f.text) { skipped++; continue; }
    files++;
    let block = false;
    f.text.split('\n').forEach((l, i) => {
      if (block) { if (l.includes('*/')) block = false; return; }
      if (/^\s*\/\*/.test(l) && !l.includes('*/')) { block = true; return; }
      if (/\b(TODO|FIXME|HACK|XXX)\b/.test(l)) todos.push({ path: f.path, line: i + 1, text: l.trim().slice(0, 200) });
      for (const [re, kind] of RULES) {
        const m = l.match(re);
        if (m) { symbols.push({ name: m[2], kind, path: f.path, line: i + 1, exported: !!m[1] }); break; }
      }
    });
  }
  return { symbols, files, skipped, todos };
}
