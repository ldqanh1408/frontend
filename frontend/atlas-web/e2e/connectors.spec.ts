import { test, expect, type Page, type Route } from '@playwright/test';
import { axe, trackErrors } from './helpers';

// Network-level stand-in for the draft `/api/workspace/ssh-connections/*` contract (test only).
const B = 'https://svc.atlas.test';
const WORKSPACE_ID = '4a3f4b17-0df2-4fe2-9f01-4a0e8d2da020';
const PROJECT_ID = '9c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';
const FINGERPRINT = 'SHA256:abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';

type SshCall = { method: string; path: string; body: unknown; headers: Record<string, string> };

/** Mocks the atlas-ui/v1 session plus the draft SSH routes. Scope identifiers are explicit UUIDs. */
function mockWorkspace(page: Page, opts: { grants?: string[]; scopeIds?: boolean; failList?: boolean } = {}) {
  const grants = opts.grants ?? ['ssh_connection:view', 'ssh_connection:create', 'ssh_connection:update', 'ssh_connection:test', 'ssh_connection:revoke', 'ssh_connection:bind'];
  const calls: SshCall[] = [];
  const origin = (route: Route) => route.request().headers()['origin'] ?? '*';
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({
    status, contentType: 'application/json', body: JSON.stringify(body),
    headers: { 'access-control-allow-origin': origin(route), 'access-control-allow-credentials': 'true' },
  });

  page.route(`${B}/**`, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (req.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: {
        'access-control-allow-origin': origin(route), 'access-control-allow-credentials': 'true',
        'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE',
      } });
    }
    if (u.pathname.startsWith('/api/workspace/')) {
      calls.push({ method: req.method(), path: u.pathname, body: req.postDataJSON(), headers: req.headers() });
      if (opts.failList) return json(route, { error: 'boom' }, 500);
      if (u.pathname.endsWith('/test')) return json(route, {
        id: 'test-1', connectionId: 'conn-1', status: 'running', requestedAt: new Date().toISOString(),
        startedAt: null, finishedAt: null, result: null, operationId: 'op-1', auditEntryIds: ['audit-1'],
      });
      if (u.pathname.endsWith('/agent-bindings') && req.method() === 'PUT') return json(route, { items: [], operationId: 'op-2', auditEntryIds: [] });
      if (u.pathname.endsWith('/agent-bindings')) return json(route, { items: [] });
      if (u.pathname.endsWith('/revoke')) return json(route, { item: { id: 'conn-1', status: 'revoked' }, operationId: 'op-3', auditEntryId: 'audit-3' });
      if (req.method() === 'POST') return json(route, {
        item: { id: 'conn-1', name: 'Build host', host: 'build.internal', port: 22, username: 'agent',
          authMethod: 'private_key', credentialReference: 'vault://ws/infra/ssh', hostKeyFingerprints: [FINGERPRINT],
          status: 'unverified', version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          revokedAt: null, lastTest: null, orgId: 'org-1', workspaceId: WORKSPACE_ID },
        operationId: 'op-1', auditEntryId: 'audit-1',
      });
      if (req.method() === 'PATCH') return json(route, {
        item: { id: 'conn-1', name: 'Build host', host: 'build.internal', port: 22, username: 'agent',
          authMethod: 'private_key', credentialReference: 'vault://ws/infra/ssh', hostKeyFingerprints: [FINGERPRINT],
          status: 'unverified', version: 2, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          revokedAt: null, lastTest: null, orgId: 'org-1', workspaceId: WORKSPACE_ID },
        operationId: 'op-4', auditEntryId: 'audit-4',
      });
      return json(route, { items: [], nextCursor: null });
    }
    if (u.pathname === '/v1/capabilities') {
      return json(route, {
        protocol: 'atlas-ui/v1', audience: 'workspace', scope: 'org:acme/ws:core',
        ...(opts.scopeIds === false ? {} : { scopeIds: { orgId: '11111111-1111-4111-8111-111111111111', workspaceId: WORKSPACE_ID, projectId: PROJECT_ID } }),
        serviceSessionHref: `${B}/v1/session`, modules: { execution: { collectionHref: `${B}/v1/execution` } },
      });
    }
    if (u.pathname === '/v1/session') {
      return json(route, {
        subject: 'dev@acme.test', scope: 'org:acme/ws:core', audience: 'workspace', grants,
        expiresAt: new Date(Date.now() + 3600e3).toISOString(), csrfToken: 'token',
        ...(opts.scopeIds === false ? {} : { scopeIds: { orgId: '11111111-1111-4111-8111-111111111111', workspaceId: WORKSPACE_ID, projectId: PROJECT_ID } }),
      });
    }
    if (u.pathname === '/v1/execution') return json(route, { complete: true, observedAt: new Date().toISOString(), items: [] });
    return json(route, { error: 'not found' }, 404);
  });
  return calls;
}

async function connect(page: Page) {
  await page.goto('/connection');
  await page.fill('#service-endpoint', B);
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(page.getByText('dev@acme.test')).toBeVisible();
}

test.describe('SSH connections workspace', () => {
  test('stays locked with a visible reason when no session is connected', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/resources/ssh-connections');
    await expect(page.getByRole('heading', { level: 1, name: 'SSH connections' })).toBeVisible();
    await expect(page.getByText('SSH records are not available in this session')).toBeVisible();
    await expect(page.getByText('Connect a Workspace session and request the explicit SSH view grant before listing these records.')).toBeVisible();
    await axe(page, 'ssh disconnected');
    expect(errors).toEqual([]);
  });

  test('lists records only when the session exposes an explicit workspace identifier', async ({ page }) => {
    mockWorkspace(page, { scopeIds: false });
    await connect(page);
    await page.goto('/resources/ssh-connections');
    await expect(page.getByText('Workspace scope is incomplete')).toBeVisible();
    await expect(page.getByText(/Atlas will not derive an identifier from that label/)).toBeVisible();
  });

  test('rejects a scope whose identifiers disagree between capabilities and session', async ({ page }) => {
    const calls = mockWorkspace(page);
    await page.goto('/connection');
    await page.route(`${B}/v1/session`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        subject: 'dev@acme.test', scope: 'org:acme/ws:core', audience: 'workspace', grants: ['ssh_connection:view'],
        expiresAt: new Date(Date.now() + 3600e3).toISOString(), csrfToken: 'token',
        scopeIds: { orgId: '22222222-2222-4222-8222-222222222222', workspaceId: WORKSPACE_ID },
      }), headers: { 'access-control-allow-origin': route.request().headers()['origin'] ?? '*', 'access-control-allow-credentials': 'true' } });
    });
    await page.fill('#service-endpoint', B);
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect(page.getByText(/do not match the advertised capability scope/)).toBeVisible();
    expect(calls.filter((c) => c.path.startsWith('/api/workspace/'))).toHaveLength(0);
  });

  test('requires a Vault reference and a trusted host key before creating a connection', async ({ page }) => {
    const calls = mockWorkspace(page);
    await connect(page);
    await page.goto('/resources/ssh-connections');
    await page.getByRole('button', { name: 'New connection' }).click();
    const dialog = page.getByRole('dialog');
    // Step 1 — target.
    await dialog.locator('#ssh-name').fill('Build host');
    await dialog.locator('#ssh-host').fill('build.internal');
    await dialog.locator('#ssh-username').fill('agent');
    await dialog.getByRole('button', { name: 'Continue →' }).click();

    // Step 2 — authentication and trust. A literal secret and a malformed fingerprint are refused.
    await dialog.locator('#ssh-credential-ref').fill('raw-private-key');
    await dialog.locator('#ssh-host-fingerprint').fill('not-a-fingerprint');
    await dialog.getByRole('button', { name: 'Continue →' }).click();
    await expect(dialog.getByText(/Do not paste the secret itself/)).toBeVisible();
    await expect(dialog.getByText(/Each line must be an OpenSSH SHA256 fingerprint/)).toBeVisible();
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);

    await dialog.locator('#ssh-credential-ref').fill('vault://workspace/infra/ssh/build-host');
    await dialog.locator('#ssh-host-fingerprint').fill(FINGERPRINT);
    await dialog.getByRole('button', { name: 'Continue →' }).click();
    await dialog.getByRole('button', { name: 'Create connection' }).click();
    await expect(page.getByText('SSH connection created')).toBeVisible();
    const post = calls.find((c) => c.method === 'POST');
    expect(post).toBeTruthy();
    expect(post!.headers['x-csrf-token']).toBe('token');
    expect(post!.headers['idempotency-key']).toBeTruthy();
    // A Vault reference travels; a secret value must never be part of the request.
    expect(JSON.stringify(post!.body)).not.toContain('raw-private-key');
  });

  test('an uncertain list failure is reported without inventing records', async ({ page }) => {
    mockWorkspace(page, { failList: true });
    await connect(page);
    await page.goto('/resources/ssh-connections');
    await expect(page.getByText(/Workspace API answered 500/)).toBeVisible();
    await expect(page.getByText('No SSH connections returned')).toHaveCount(0);
  });

  test('ships the stylesheet for the setup wizard and the review summary', async ({ page }) => {
    mockWorkspace(page);
    await connect(page);
    await page.goto('/resources/ssh-connections');
    await page.getByRole('button', { name: 'New connection' }).click();
    const dialog = page.getByRole('dialog');
    // A missing stylesheet leaves the wizard unstyled; the gate must fail rather than pass silently.
    await expect(dialog.locator('.ssh-wizard-steps')).toHaveCSS('display', 'flex');
    await expect(dialog.locator('.ssh-wizard-number').first()).toHaveCSS('border-radius', '999px');
    await expect(dialog.locator('.ssh-wizard-step').first()).toHaveCSS('display', 'flex');
  });
});

test.describe('connector catalog', () => {
  test('keeps credential fields as Vault references and blocks a literal secret', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/resources/connectors');
    await expect(page.getByRole('heading', { level: 1, name: 'Connector catalog' })).toBeVisible();
    await axe(page, 'connector catalog');

    await page.getByRole('button', { name: /Amazon Web Services/ }).click();
    // A literal secret value is refused; only a scoped Vault reference is accepted.
    await page.locator('#connector-aws-externalIdRef').fill('AKIAIOSFODNN7EXAMPLE');
    await page.getByRole('button', { name: 'Save local draft' }).click();
    await expect(page.getByText(/Use a scoped vault:\/\/ reference/)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('saves a device draft and exports it without contacting a provider', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/resources/connectors');
    await page.getByRole('button', { name: /Amazon Web Services/ }).click();
    await page.locator('#connector-aws-accountId').fill('123456789012');
    await page.locator('#connector-aws-region').fill('ap-southeast-1');
    await page.locator('#connector-aws-roleArn').fill('arn:aws:iam::123456789012:role/AtlasReadOnly');
    await page.locator('#connector-aws-externalIdRef').fill('vault://cloud/aws/external-id');
    await page.getByRole('button', { name: 'Save local draft' }).click();
    await expect(page.getByText('Local draft saved for review only. No API call or live connection was made.')).toBeVisible();
    await expect(page.getByText('123456789012 · Amazon Web Services')).toBeVisible();

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export JSON' }).first().click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.json$/);
    expect(errors).toEqual([]);
  });

  test('states that a connector draft is a device draft with no live connection', async ({ page }) => {
    await page.goto('/resources/connectors');
    await expect(page.getByText(/No provider is contacted, no credential is stored and no live connection is proven/)).toBeVisible();
  });

  test('ships the stylesheet for the catalog, the chips and the cards', async ({ page }) => {
    await page.goto('/resources/connectors');
    // A missing stylesheet leaves the surface unstyled; the gate must fail rather than pass silently.
    const chip = page.locator('.connector-category-chip').first();
    await expect(chip).toHaveCSS('border-radius', '999px');
    await expect(chip).toHaveCSS('min-height', '32px');
    const card = page.locator('.connector-card').first();
    await expect(card).toHaveCSS('display', 'flex');
    await expect(card).toHaveCSS('border-top-style', 'solid');
    const grid = page.locator('.connector-grid').first();
    await expect(grid).toHaveCSS('display', 'grid');
  });
});
