import { test, expect, type Page, type Route } from '@playwright/test';
import { axe } from './helpers';

// Network-level stand-in for an atlas-ui/v1 service (test only; the app has no built-in fixture).
const B = 'https://svc.atlas.test';
function mockService(page: Page, opts: { postStatus?: number; unauthorizedAfterConnect?: boolean; secretInput?: boolean } = {}) {
  const state = { posts: 0, connected: false, ops: new Map<string, { fp: string }>() };
  const origin = (route: Route) => route.request().headers()['origin'] ?? '*';
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body),
    headers: { 'access-control-allow-origin': origin(route), 'access-control-allow-credentials': 'true' } });
  page.route(`${B}/**`, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': origin(route), 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST' } });
    if (req.method() === 'POST') {
      state.posts++;
      const body = req.postDataJSON();
      await new Promise((r) => setTimeout(r, 300));
      if (opts.postStatus) return json(route, { error: 'x' }, opts.postStatus);
      state.ops.set(body.operationId, { fp: body.fingerprint });
      return json(route, { operationId: body.operationId, scope: body.scope, resourceId: body.resourceId, fingerprint: body.fingerprint, stage: opts.secretInput ? 'Rejected' : 'Accepted', reason: opts.secretInput ? `Invalid ${body.input.apiKey}` : undefined });
    }
    if (opts.unauthorizedAfterConnect && state.connected && u.pathname !== '/v1/capabilities') return json(route, { error: 'unauthorized' }, 401);
    if (u.pathname === '/v1/capabilities') return json(route, { protocol: 'atlas-ui/v1', audience: u.searchParams.get('audience'), scope: 'org:acme/ws:core', serviceSessionHref: `${B}/v1/session`, modules: { execution: { collectionHref: `${B}/v1/execution` } } });
    if (u.pathname === '/v1/session') { state.connected = true; return json(route, { subject: 'dev@acme.test', scope: 'org:acme/ws:core', audience: 'workspace', grants: ['agent:control'], expiresAt: new Date(Date.now() + 3600e3).toISOString(), csrfToken: 'token' }); }
    if (u.pathname === '/v1/execution') return json(route, { complete: true, observedAt: new Date().toISOString(), items: [{ id: 'run-7', name: 'Nightly regression', revision: 4, scope: 'org:acme/ws:core', observedAt: new Date().toISOString(), status: 'Running', etag: '"r4"', actions: [{ id: 'pause', grant: 'agent:control', label: 'Pause', href: `${B}/v1/execution/run-7/pause`, statusHref: `${B}/v1/ops/{operationId}`, resourceId: 'run-7', expectedRevision: 4, inputs: opts.secretInput ? [{ key: 'apiKey', label: 'API key', secret: true, required: true }] : undefined }] }] });
    return json(route, { error: 'not found' }, 404);
  });
  return state;
}

async function connect(page: Page) {
  await page.goto('/connection');
  await page.fill('#service-endpoint', B);
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(page.getByText('dev@acme.test')).toBeVisible();
}

test('secret command fields are masked and echoed rejection details never enter persisted receipts', async ({ page }) => {
  const s = mockService(page, { secretInput: true });
  await connect(page);
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('link', { name: 'Runs & activity' }).click();
  await page.getByRole('button', { name: 'Nightly regression' }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const dlg = page.getByRole('dialog'); const field = dlg.getByLabel('API key');
  await expect(field).toHaveAttribute('type', 'password');
  await expect(field).toHaveAttribute('autocomplete', 'new-password');
  await field.fill('browser-synthetic-secret');
  await dlg.getByRole('button', { name: 'Send Pause' }).dblclick();
  await expect(dlg.getByRole('status')).toContainText('Sensitive response details are not retained');
  await expect(field).toHaveCount(0); expect(s.posts).toBe(1);
  const journal = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const req = indexedDB.open('atlas-device'); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    const entries = await new Promise<unknown[]>((resolve, reject) => { const req = db.transaction('journal').objectStore('journal').getAll(); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    db.close(); return entries;
  });
  expect(JSON.stringify(journal)).not.toContain('browser-synthetic-secret');
  expect(journal).toHaveLength(1); expect(journal[0]).toHaveProperty('hasSecretInputs', true);
});

test('rejects credentials in the service URL', async ({ page }) => {
  await page.goto('/connection');
  await page.fill('#service-endpoint', 'https://user:pass@svc.atlas.test');
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(page.locator('#service-endpoint-hint')).toContainText('Remove credentials');
  await expect(page.locator('#service-endpoint')).toBeFocused();
});

test('connect, inspect a record and send one command per activation', async ({ page }) => {
  const s = mockService(page);
  await connect(page);
  await axe(page, 'connected');
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('link', { name: 'Runs & activity' }).click();
  await page.getByRole('button', { name: 'Nightly regression' }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg).toContainText('Expected revision');
  await axe(page, 'command dialog');
  const send = dlg.getByRole('button', { name: 'Send Pause' });
  await send.dblclick();
  await expect(dlg.getByRole('status')).toContainText('Accepted for processing');
  expect(s.posts).toBe(1);
  await dlg.getByRole('button', { name: 'Close' }).first().click();
  await expect(page.getByRole('region', { name: 'Operation receipts' }).or(page.locator('section', { hasText: 'Operation receipts' })).first()).toContainText('Pause · Nightly regression');
});

test('server error after send is Unknown and never resent', async ({ page }) => {
  const s = mockService(page, { postStatus: 500 });
  await connect(page);
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('link', { name: 'Runs & activity' }).click();
  await page.getByRole('button', { name: 'Nightly regression' }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Send Pause' }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('reconcile');
  expect(s.posts).toBe(1);
});

test('session is restored after a reload from the service cookie session', async ({ page }) => {
  mockService(page);
  await connect(page);
  await page.goto('/execution');
  await expect(page.getByRole('button', { name: 'Nightly regression' })).toBeVisible();
});

test('401 ends the session with a single reconnect notice (FND-005)', async ({ page }) => {
  mockService(page, { unauthorizedAfterConnect: true });
  await connect(page);
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('link', { name: 'Runs & activity' }).click();
  await expect(page.getByText('Service session ended').first()).toBeVisible();
  await expect(page.locator('.toast', { hasText: 'Service session ended' })).toHaveCount(1);
  await expect(page.locator('.toast', { hasText: 'Service connected' })).toHaveCount(0);
});
