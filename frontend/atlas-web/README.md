# atlas-web

Latest handoff: branch `handoff/frontend-e2e` in `ldqanh1408/frontend`. See [UI/UX acceptance](docs/UI-UX-ACCEPTANCE.md), [design decisions](docs/UI-UX-DESIGN-SYSTEM.md) and [SRS/ADR conformance](docs/SRS-ADR-CONFORMANCE.md). Earlier checkpoints retain historical results. Backend business E2E, deployment/staging and manual assistive technology require separate evidence.

Atlas — AI engineering workspace frontend, rebuilt from the Figma E2E delivery (file `0md9BEFI1rU0aRAvf98TWO`) and the
`Atlas-E2E-Delivery` package in `design-source/`.

## Run

```bash
npm ci
npm run dev            # http://localhost:5173
npm run check          # typecheck + unit tests + production build
npm run e2e           # functional + axe + layout/performance against production preview headers
```

Playwright browsers are expected at `PLAYWRIGHT_BROWSERS_PATH`. CI installs Chromium, Firefox and WebKit with
`npx playwright install --with-deps chromium firefox webkit`. Functional tests run in all three engines;
layout/performance tests use one Linux Chromium project. Private pixel regression is separate:

```bash
ATLAS_VISUAL_BASELINE_DIR=/absolute/private/baselines npm run e2e:visual
```

See [visual evidence policy](docs/VISUAL-EVIDENCE.md) before generating or restoring baselines.

## UI review before deployment

```bash
npm run build:review
npm run preview:review     # http://127.0.0.1:4174, distinct dist-review directory
npm run e2e:review         # review labels, 18 Current state screens and Execution state/keyboard checks
```

The review build has explicitly labelled illustrative data and does not authenticate, run agents or apply design-state
actions. Production and review outputs remain separate. The offline screenshot gallery, Archive shortlist, test evidence,
integration limits and assistive-technology checklist are described in `ui-review/Atlas-UI-Review.md`.

## How the app is put together

| Area | Where |
|---|---|
| Design data (210 views, 751 scenes, 49 definition types, 39 lifecycles, 55 source actions) | `tools/import-design.mjs` → `src/generated/` (`npm run import:design`) |
| Shell (nav 236px, app bar, status bar, palette, help, preferences) | `src/shell/` |
| Device authority: IndexedDB drafts, revisions, CAS across tabs | `src/lib/storage.ts`, `definitions.ts`, `documents.ts`, `workflows.ts`, `sources.ts` |
| Service authority: proposed `atlas-ui/v1` adapter | `src/data/service.ts` |
| Module pages (service records, device-draft modules, connection) | `src/views/modules/` |
| Specifications IDE, Code intelligence, Workflow | `src/views/specs/`, `src/views/code/`, `src/views/workflow/` |
| The 210 planned views | `src/views/ViewPage.tsx` + `src/views/scene/` |

Rules the UI keeps everywhere:

- Nothing is shown as a service result unless a service returned it. Without a session, views show their structure and
  "Not observed"; protected actions stay visible but disabled with the specific reason.
- Roles never authorize by name; an action is enabled only by a grant in the current session.
- Commands: one POST per activation (`Idempotency-Key`, `X-CSRF-Token`, `If-Match`); any unclear outcome is `Unknown`
  and is reconciled by status read, never re-sent; `Effective` requires an effect readback that matches operation,
  scope, resource and input fingerprint; 401 or expiry ends the session and withdraws service feedback.
- Fixture wording from the design (sample ids, SHAs) appears only in the review build (`npm run build:review`), labelled
  "Illustrative". The production build contains no fixture data or synthetic success handlers.

## Fresh local acceptance

```bash
npm run test:tooling   # release routing, entry isolation, integrity and cache contracts
npm run verify         # check + tooling + functional (3 engines) + layout/perf + review (3 engines)
```

Each invocation writes its own `test-results/acceptance/<run>/summary.json`, raw reports and logs. Failed gates fail the
command; results are never merged with successful reruns. Source digests detect edits during acceptance. To name a run,
set `ATLAS_VERIFY_RUN`; an existing summary is never overwritten. Browser suites use two workers to keep simultaneous Monaco/graph loads within the container budget. Container Firefox may require
`ATLAS_CONTAINER_BROWSER=1`; CI uses the normal browser sandbox.

## Release and staging

```bash
npm run release                          # creates local release/staging; no deployment
npm run worker:staging -- <artifact-commit-sha>
```

Release metadata records both entry documents, exact file lengths/SHA-256 and a deterministic source digest. A ZIP
without Git builds with `sourceKind: archive` and a digest-based build ID; it never claims an unobserved Git commit.
Dirty checkouts fail unless explicitly building a local draft with `ATLAS_ALLOW_DIRTY_RELEASE=1`. Remotely pinned Workers
require committed source. Worker generation writes separate `deploy/staging-workspace-worker.js` and
`deploy/staging-observer-worker.js`; each serves its own fallback entry, never the other application's entry.

After the UI gate and an explicitly authorized deployment, configure distinct `workspaceUrl` and `observerUrl` in
`deploy/staging-target.json`, and use the exact newly generated build ID:

```bash
WORKSPACE_URL=https://workspace.example OBSERVER_URL=https://observer.example EXPECTED_BUILD_ID=<build-id> npm run verify:staging
```

Staging acceptance checks bytes, expected release identity, audience, headers, cache, 404/HEAD contracts, routes and axe
on both independent origins in three engines. It sends GET/HEAD only, never service commands. Missing targets, stale
build IDs and failed tests fail the gate. CI uploads evidence as artifacts and does not commit or deploy from this job.
Legacy `url/release` metadata is historical; it cannot certify the current source.

The current CI release is an unconfigured baseline; it does not contain approved production origin inputs. Follow
[deployment acceptance](docs/DEPLOY-ACCEPTANCE.md) to build and verify a target-configured candidate, and read the
[current readiness report](docs/DEPLOY-READINESS-20261009.md) before continuing. Record build-time origin inputs alongside
the release manifest; environment variables are not included in the runtime source digest.

The Cloudflare plugin helps inspect Workers, deployment versions and account configuration. GitHub helps inspect/publish
source and CI. Playwright already supplies functional, visual and axe automation; it needs no browser plugin. Backend
persistence, freeze/lock/AI/PR/CI/Implemented effects and manual NVDA/VoiceOver remain independently required.

## ADR implementation and integrations

The editor is lazy Monaco with optional scoped Yjs/y-monaco binding. DAGs use lazy React Flow with a keyboard List view; terminal output uses lazy xterm with bounded batching. Workspace state uses Zustand and authenticated collection queries use TanStack Query. Commands stay on REST; advertised live channels use scoped WebSocket frames.

Observer is an independent second entry, router, store and session client. `telemetry-console.html` is served locally for `/observer/*`; production needs its own origin and authentication cookie boundary. See [integration contract and acceptance limits](docs/INTEGRATION.md) for proposed capabilities, configuration resolution, scope switch receipts and server obligations.

The review gallery contains actual app screenshots of all 18 Current states in both themes, plus the 7 definition states and the selected Archive patterns. Its screenshots are illustrative design evidence; backend business effects still require live service receipts. No deployment is authorized before the UI review gate is satisfied.
