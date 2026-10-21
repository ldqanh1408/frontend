import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { axe, trackErrors } from './helpers';
const required = ['content-security-policy', 'x-content-type-options', 'referrer-policy', 'permissions-policy', 'strict-transport-security', 'x-frame-options', 'cross-origin-opener-policy'];

test('expected release and all artifact bytes match on both independent origins', async ({ request }, info) => {
  const response = await request.get('/release-manifest.json');
  expect(response.status()).toBe(200);
  const manifest = await response.json();
  expect(manifest.format).toBe('atlas-web-release/v1');
  expect(manifest.buildId).toBe(process.env.EXPECTED_BUILD_ID);
  expect(manifest.fileCount).toBe(Object.keys(manifest.files).length);
  expect(manifest.sourceDirty).toBe(false);
  expect(manifest.sourceKind).toBe('git');
  expect(manifest.sourceCommit).toMatch(/^[0-9a-f]{40}$/);
  const audience = info.project.metadata.audience;
  const failures = [];
  for (const [path, file] of Object.entries(manifest.files as Record<string, { sha256: string; size: number }>)) {
    const base = path === '/telemetry-console.html' ? process.env.OBSERVER_URL! : path === '/index.html' ? process.env.WORKSPACE_URL! : audience === 'observer' ? process.env.OBSERVER_URL! : process.env.WORKSPACE_URL!;
    const res = await request.get(new URL(path, base).toString());
    const bytes = await res.body();
    if (res.status() !== 200 || bytes.length !== file.size || createHash('sha256').update(bytes).digest('hex') !== file.sha256) failures.push(path);
  }
  expect(failures).toEqual([]);
});

test('headers, audience, routing, missing assets and HEAD contract', async ({ request }, info) => {
  const audience = info.project.metadata.audience as string;
  const root = await request.get('/');
  expect(root.status()).toBe(200);
  expect(root.headers()['x-atlas-release']).toBe(process.env.EXPECTED_BUILD_ID);
  expect(root.headers()['x-atlas-audience']).toBe(audience);
  for (const header of required) expect(root.headers()[header], header).toBeTruthy();
  expect(root.headers()['cache-control']).toMatch(/no-cache|max-age=0/);
  const manifest = await (await request.get('/release-manifest.json')).json();
  const entry = audience === 'observer' ? '/telemetry-console.html' : '/index.html';
  expect(createHash('sha256').update(await root.body()).digest('hex')).toBe(manifest.files[entry].sha256);
  const asset = Object.keys(manifest.files).find(path => path.startsWith('/assets/') && path.endsWith('.js'))!;
  expect((await request.get(asset)).headers()['cache-control']).toContain('immutable');
  expect((await request.get('/assets/__missing__.js')).status()).toBe(404);
  expect((await request.head('/')).status()).toBe(200);
  expect((await request.get(audience === 'observer' ? '/index.html' : '/observer/traces')).status()).toBe(404);
});

test('browser routes render without console errors or axe violations', async ({ page }, info) => {
  const errors = trackErrors(page);
  const routes = info.project.metadata.audience === 'observer' ? ['/observer', '/observer/sign-in', '/observer/traces', '/observer/metrics'] : ['/', '/specifications', '/code', '/execution', '/governance', '/connection', '/sign-in'];
  for (const route of routes) {
    await page.goto(route, { waitUntil: 'networkidle' });
    await expect(page.locator('h1').first()).toBeVisible();
    await axe(page, route);
  }
  expect(errors).toEqual([]);
});
