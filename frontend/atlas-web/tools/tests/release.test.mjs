import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { workerSource } from '../staging-worker.mjs';
import { channelName, sourceDigest, validateManifest } from '../release-manifest.mjs';

function fixture(audience = 'workspace', options = {}) {
  const bytes = { '/index.html': Buffer.from('<main>Workspace</main>'), '/telemetry-console.html': Buffer.from('<main>Observer</main>'), '/assets/app.js': Buffer.from('window.ready=true;') };
  const files = Object.fromEntries(Object.entries(bytes).map(([path, body]) => [path, { sha256: createHash('sha256').update(body).digest('hex'), size: body.length }]));
  const manifest = { format: 'atlas-web-release/v1', buildId: 'release-test', fileCount: 3, files };
  const manifestBytes = Buffer.from(JSON.stringify(manifest)); bytes['/release-manifest.json'] = manifestBytes;
  const pending = []; let fetched = 0;
  const cache = new Map();
  const source = workerSource({ origin: 'https://artifacts.example/release', manifest, manifestBytes, security: { 'X-Frame-Options': 'DENY' }, audience });
  const worker = runInNewContext(source.replace('export default', 'worker ='), { crypto: webcrypto, URL, Request, Response, AbortSignal, Uint8Array, caches: { default: { match: async key => options.badCache ? new Response('corrupt') : cache.get(key.url)?.clone(), put: async (key, response) => { cache.set(key.url, response); } } }, fetch: async url => { fetched++; const path = new URL(url).pathname.replace('/release', ''); return new Response(options.badUpstream ? 'tampered release response' : bytes[path]); } });
  return { get: (path, method = 'GET', headers = {}) => worker.fetch(new Request('https://app.example' + path, { method, headers }), {}, { waitUntil: promise => pending.push(promise) }), pending, fetched: () => fetched, bytes };
}
test('independent entries and origin boundaries', async () => {
  const workspace = fixture(); const observer = fixture('observer');
  assert.match(await (await workspace.get('/')).text(), /Workspace/);
  assert.match(await (await workspace.get('/execution/runs')).text(), /Workspace/);
  assert.match(await (await observer.get('/')).text(), /Observer/);
  assert.match(await (await observer.get('/observer/traces')).text(), /Observer/);
  assert.equal((await workspace.get('/observer/traces')).status, 404);
  assert.equal((await workspace.get('/telemetry-console.html')).status, 404);
  assert.equal((await observer.get('/index.html')).status, 404);
});
test('missing files, unsupported methods and malformed routes fail explicitly', async () => {
  const worker = fixture();
  for (const path of ['/assets/missing.js', '/missing.png']) assert.equal((await worker.get(path)).status, 404);
  for (const path of ['/bad%ZZ', '/%2e%2e%2fsecret', '/%5csecret', '/%00']) assert.equal((await worker.get(path)).status, 400);
  assert.equal((await worker.get('/', 'POST')).status, 405);
});
test('GET/HEAD, cache and ETag preserve release identity and security headers', async () => {
  const worker = fixture();
  const response = await worker.get('/assets/app.js');
  assert.equal(response.headers.get('x-atlas-release'), 'release-test');
  assert.equal(response.headers.get('x-atlas-audience'), 'workspace');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.match(response.headers.get('cache-control'), /immutable/);
  await Promise.all(worker.pending);
  const head = await worker.get('/assets/app.js', 'HEAD');
  assert.equal(await head.text(), ''); assert.equal(worker.fetched(), 1);
  assert.equal((await worker.get('/assets/app.js', 'GET', { 'If-None-Match': response.headers.get('etag') })).status, 304);
});
test('upstream integrity failure never serves HTML or caches unverified bytes', async () => {
  const worker = fixture('workspace', { badUpstream: true });
  assert.equal((await worker.get('/')).status, 502); assert.equal(worker.pending.length, 0);
});
test('corrupt cached bytes are rejected and repaired from verified upstream', async () => {
  const worker = fixture('workspace', { badCache: true });
  assert.match(await (await worker.get('/')).text(), /Workspace/); assert.equal(worker.fetched(), 1);
});
test('release validates channel before filesystem writes and validates both entries', () => {
  for (const channel of ['../src', '/tmp', 'x/y', '', 'staging;rm']) assert.throws(() => channelName(channel));
  assert.equal(channelName('staging'), 'staging');
  assert.throws(() => validateManifest({ format: 'atlas-web-release/v1', buildId: 'test', files: {}, fileCount: 0 }));
});
test('source digest detects Observer entry changes and ignores generated evidence', () => {
  const root = mkdtempSync(join(tmpdir(), 'atlas-source-'));
  try {
    writeFileSync(join(root, 'index.html'), 'workspace'); writeFileSync(join(root, 'telemetry-console.html'), 'observer');
    const before = sourceDigest(root);
    mkdirSync(join(root, 'test-results')); writeFileSync(join(root, 'test-results', 'run.json'), '{}');
    assert.equal(sourceDigest(root), before);
    writeFileSync(join(root, 'telemetry-console.html'), 'observer update'); assert.notEqual(sourceDigest(root), before);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
