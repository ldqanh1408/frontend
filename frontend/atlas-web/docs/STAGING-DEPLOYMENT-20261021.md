# Staging deployment receipt — 2026-10-21

**Staging deployment completed and accepted. Production is unchanged.** This receipt records what was deployed, how it was verified and what the deployment does not establish. It supersedes the deployment state described in [DEPLOY-READINESS-20261009.md](DEPLOY-READINESS-20261009.md), which remains the record of the state before the origins were frozen.

## What was deployed

| Audience | Worker | URL | Entry | Version |
| --- | --- | --- | --- | --- |
| workspace | `atlas-web-staging` | https://atlas-web-staging.ekko-okke666.workers.dev | `/index.html` | `b094d99f-2149-42e4-99c9-9387188f345e` |
| observer | `atlas-web-observer` | https://atlas-web-observer.ekko-okke666.workers.dev | `/telemetry-console.html` | `2183f7e7-a641-4854-a17c-c45f16455395` |

- Release `0a0bba532b1b`, source commit `0a0bba532b1b5026855b324f6de6df6947148be3`.
- Artifact commit `875cb4140c50024d7ffc6aa733c95b56ba45aab3`; manifest SHA-256 `71a1627a4dfc36c4f9521b9047a8d40c185565bd7bc3d937bb926df3737dc526`; 128 files.
- Each Worker pins the artifact on `raw.githubusercontent.com` and verifies every served byte against the manifest hash before answering. The two Workers run on independent origins, so they share no browser session or cookie scope.
- `atlas-web-observer` is a new Worker. It did not exist on the account before this deployment.
- Deployment method: `wrangler 4.151.3 deploy --no-bundle`, one module upload per audience, compatibility date `2026-10-04`.

The machine-readable record is [../deploy/staging-deployment.json](../deploy/staging-deployment.json); the frozen target is [../deploy/staging-target.json](../deploy/staging-target.json).

## Acceptance

`npm run verify:staging` with `WORKSPACE_URL`, `OBSERVER_URL` and `EXPECTED_BUILD_ID=0a0bba532b1b`:

- Result **PASS**, run `staging-0a0bba532b1b`, finished `2026-10-21T11:11:23.924Z`.
- 18 expected, 0 unexpected, 0 flaky, 0 skipped, across Chromium, Firefox and WebKit.
- The run covered: the published manifest and every artifact byte on both origins; the release and audience headers; cross-audience routing refusals; the missing-asset contract; the `HEAD` contract; and browser rendering of the planned routes with no console errors and no axe violations.
- The source digest was unchanged across the run.
- The acceptance summary is at `test-results/acceptance/staging-0a0bba532b1b/summary.json`.

## Two defects found and fixed before this release

1. **The published artifact was not byte-identical to its manifest.** `core.autocrlf` rewrote line endings for six text files on the way into the repository, so the bytes GitHub served did not match the SHA-256 the manifest recorded. The Workers verify every file against that hash, so those six files would have failed the release integrity check. The release directory is now marked `-text -eol`, and all 128 files were re-verified byte-for-byte against the manifest from the published origin.
2. **A horizontally scrollable table region was not reachable by keyboard** (WCAG 2.1.1). The accessibility audit reported `scrollable-region-focusable` on every view rendering a wide table, in WebKit. A shared `ScrollableTable` wrapper now gives the region a focus stop and an accessible name whenever it actually overflows. The full accessibility suite passes on all three engines: 1398 expected, 0 unexpected.

## Production is untouched

`sparkling-snow-090d` was not written to. It still has its single deployment of `2026-10-04T14:54:09.581Z` (version `a8b5bc3a-63c9-4996-84e5-e8bc117775d3`) and answers on its own origin. No Cloudflare write targeted it at any point in this deployment.

## Rollback

The previous Workspace version `2a14923a-8d3c-4434-8da9-8fd0ba8ef886` (deployed `2026-10-09`) is retained on the Worker. A rollback restores a previously accepted matching Workspace and Observer pair; the Observer Worker did not exist before this deployment, so rolling it back removes it.

## What this deployment does not establish

- It is a frontend delivery check. It does not establish cookie isolation across origins in a live session, backend business effects, or the J0–J7 and O1 live journeys.
- Manual NVDA and VoiceOver acceptance is not established by an automated audit.
- UI approval (D01) is still not formally recorded; the authorization in this session covered the staging scope only.
- The backend contract and live tenants (D03) and the broader QA and security decisions (D05) remain open.
- A green staging acceptance is not a production readiness claim.

Follow [live E2E acceptance](LIVE-E2E-ACCEPTANCE.md) and [SRS/ADR conformance](SRS-ADR-CONFORMANCE.md) for the proofs that this deployment does not supply.
