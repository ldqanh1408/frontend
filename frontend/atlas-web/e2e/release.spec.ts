import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';

// HTTP-level checks of a deployed release (run with RELEASE_CHECK=1 against BASE_URL).
test.skip(!process.env.RELEASE_CHECK, 'set RELEASE_CHECK=1 to verify a deployed release');

const REQUIRED = ['content-security-policy', 'x-content-type-options', 'referrer-policy', 'permissions-policy', 'strict-transport-security', 'x-frame-options', 'cross-origin-opener-policy'];

test('every file matches the release manifest byte-for-byte', async ({ request }) => {
  const res = await request.get('/release-manifest.json');
  expect(res.status()).toBe(200);
  const m = await res.json();
  expect(m.format).toBe('atlas-web-release/v1');
  console.log(`release ${m.buildId} · ${m.fileCount} files · source ${m.sourceCommit}`);
  const bad: string[] = [];
  for (const [path, f] of Object.entries(m.files as Record<string, { sha256: string; size: number }>)) {
    const r = await request.get(path === '/index.html' ? '/' : path);
    const buf = await r.body();
    const sha = createHash('sha256').update(buf).digest('hex');
    if (r.status() !== 200 || sha !== f.sha256 || buf.length !== f.size) bad.push(`${path}: ${r.status()} ${sha.slice(0, 12)} ${buf.length}`);
  }
  expect(bad).toEqual([]);
});

test('security headers and caching', async ({ request }) => {
  const html = await request.get('/');
  for (const h of REQUIRED) expect(html.headers()[h], h).toBeTruthy();
  expect(html.headers()['cache-control']).toMatch(/no-cache|max-age=0/);
  const m = await (await request.get('/release-manifest.json')).json();
  const asset = Object.keys(m.files).find((p) => p.startsWith('/assets/') && p.endsWith('.js'))!;
  const a = await request.get(asset);
  expect(a.headers()['cache-control']).toContain('immutable');
  expect(a.headers()['content-type']).toMatch(/javascript/);
  for (const h of REQUIRED) expect(a.headers()[h], `${asset} ${h}`).toBeTruthy();
});

test('client routes serve the app; missing files are 404', async ({ request }) => {
  for (const p of ['/execution/runs', '/definitions/agent', '/sign-in', '/specifications?doc=x']) {
    const r = await request.get(p);
    expect(r.status(), p).toBe(200);
    expect(r.headers()['content-type'], p).toContain('text/html');
  }
  const missing = await request.get('/assets/__missing__.js');
  expect(missing.status()).toBe(404);
  expect((await missing.text()).includes('<div id="root">')).toBe(false);
  const post = await request.post('/', { data: {} });
  expect(post.status()).toBe(405);
});
