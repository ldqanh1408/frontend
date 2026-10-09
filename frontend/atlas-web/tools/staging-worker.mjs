#!/usr/bin/env node
// Generates independent Workspace/Observer Workers pinned to a committed release. Does not deploy.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { channelName, validateManifest } from './release-manifest.mjs';

export function workerSource({ origin, manifest, manifestBytes, security, audience }) {
  validateManifest(manifest);
  if (!['workspace', 'observer'].includes(audience)) throw new Error('Audience must be workspace or observer.');
  const files = { ...manifest.files, '/release-manifest.json': { sha256: createHash('sha256').update(manifestBytes).digest('hex'), size: manifestBytes.length } };
  return `// Generated release worker: ${manifest.buildId}, audience ${audience}.
const ORIGIN = ${JSON.stringify(origin)};
const RELEASE = ${JSON.stringify(manifest.buildId)};
const FILES = ${JSON.stringify(files)};
const AUDIENCE = ${JSON.stringify(audience)};
const ENTRY = ${JSON.stringify(audience === 'observer' ? '/telemetry-console.html' : '/index.html')};
const SECURITY = ${JSON.stringify({ ...security, 'X-Robots-Tag': 'noindex, nofollow' })};
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json; charset=utf-8', svg: 'image/svg+xml', woff2: 'font/woff2', woff: 'font/woff', txt: 'text/plain; charset=utf-8', ico: 'image/x-icon', png: 'image/png' };
async function valid(bytes, file) {
  if (bytes.byteLength !== file.size) return false;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('') === file.sha256;
}
async function load(path, ctx) {
  const file = FILES[path];
  const key = new Request('https://atlas-release.cache/' + file.sha256);
  const cache = caches.default;
  const hit = await cache.match(key);
  if (hit) { const bytes = await hit.arrayBuffer(); if (await valid(bytes, file)) return bytes; }
  const upstream = await fetch(ORIGIN + path, { signal: AbortSignal.timeout(15000), cf: { cacheTtl: 86400, cacheEverything: true } });
  if (!upstream.ok) throw new Error('upstream unavailable');
  // Bound reads to manifest length; an unexpected upstream must not consume unbounded Worker memory.
  const reader = upstream.body?.getReader();
  if (!reader) throw new Error('empty release response');
  const chunks = []; let size = 0;
  try { for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > file.size) throw new Error('release length mismatch'); chunks.push(value); } }
  finally { await reader.cancel(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  if (!(await valid(bytes, file))) throw new Error('release integrity mismatch');
  ctx.waitUntil(cache.put(key, new Response(bytes, { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } })).catch(() => {}));
  return bytes;
}
export default {
  async fetch(request, env, ctx) {
    const plain = (text, status, extra = {}) => new Response(text, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY, ...extra } });
    if (!['GET', 'HEAD'].includes(request.method)) return plain('Method not allowed', 405, { Allow: 'GET, HEAD' });
    let path;
    try { path = decodeURIComponent(new URL(request.url).pathname); } catch { return plain('Bad request', 400); }
    if (path.includes('..') || path.includes('\\\\') || /[\\x00-\\x1f]/.test(path)) return plain('Bad request', 400);
    if (AUDIENCE === 'workspace' && (/^\\/observer(?:\\/|$)/.test(path) || path === '/telemetry-console.html')) return plain('Observer uses its independent origin', 404);
    if (AUDIENCE === 'observer' && path === '/index.html') return plain('Workspace uses its independent origin', 404);
    if (path === '/') path = ENTRY;
    if (!Object.hasOwn(FILES, path)) {
      if (/\\.[a-z0-9]+$/i.test(path) || path.startsWith('/assets/')) return plain('Not found', 404);
      path = ENTRY;
    }
    const etag = '"' + FILES[path].sha256 + '"';
    const headers = { ...SECURITY, 'Content-Type': TYPES[path.split('.').pop().toLowerCase()] || 'application/octet-stream', ETag: etag, 'X-Atlas-Release': RELEASE, 'X-Atlas-Audience': AUDIENCE, 'Cache-Control': path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' };
    if (request.headers.get('If-None-Match') === etag) return new Response(null, { status: 304, headers });
    try { const bytes = await load(path, ctx); return new Response(request.method === 'HEAD' ? null : bytes, { headers }); }
    catch { return plain('Release file unavailable', 502); }
  },
};
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [sha, rawChannel = 'staging'] = process.argv.slice(2);
  if (!/^[0-9a-f]{40}$/.test(sha || '')) throw new Error('Pass the full artifact commit SHA.');
  const channel = channelName(rawChannel);
  const root = fileURLToPath(new URL('..', import.meta.url));
  const manifestBytes = readFileSync(join(root, 'release', channel, 'release-manifest.json'));
  const manifest = validateManifest(JSON.parse(manifestBytes));
  if (manifest.sourceDirty || manifest.sourceKind === 'archive') throw new Error('Commit and rebuild source before generating a remotely pinned Worker.');
  const headersFile = readFileSync(join(root, 'public', '_headers'), 'utf8');
  const security = Object.fromEntries(headersFile.split('\n/assets/*')[0].split('\n').filter(l => /^\s+\S+:/.test(l)).map(l => { const i = l.indexOf(':'); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
  const origin = `https://raw.githubusercontent.com/ldqanh1408/frontend/${sha}/frontend/atlas-web/release/${channel}`;
  mkdirSync(join(root, 'deploy'), { recursive: true });
  for (const audience of ['workspace', 'observer']) writeFileSync(join(root, 'deploy', `${channel}-${audience}-worker.js`), workerSource({ origin, manifest, manifestBytes, security, audience }));
  console.log(`Generated ${channel} Workspace/Observer Workers for release ${manifest.buildId}. No deployment performed.`);
}
