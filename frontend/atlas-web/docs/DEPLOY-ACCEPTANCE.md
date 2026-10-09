# Deploy and acceptance continuation

Current branch: `handoff/frontend-e2e` in `ldqanh1408/frontend`. Source `06c4f25404b5b20a5e2bf6261936792f137ee740` passed [three-engine CI](https://github.com/ldqanh1408/frontend/actions/runs/37877622378); later evidence-only commits preserve its runtime and QA inputs. Source push was authorized and completed. This document prepares a deployment; no deployment or live acceptance has occurred.

See [current readiness](DEPLOY-READINESS-20261009.md), [UI/UX acceptance](UI-UX-ACCEPTANCE.md) and [SRS/ADR conformance](SRS-ADR-CONFORMANCE.md). Historical checkpoints and existing `deploy/staging-target.json` describe older releases.

## Candidate inputs

| Input | Required value / proof | Current state |
| --- | --- | --- |
| UI review | User reviews the private gallery and approves the actual UI before deployment | Approval is not recorded |
| Workspace URL | Independent HTTPS origin, without credentials/query/fragment | Not configured |
| Observer URL | Different HTTPS origin; use `/observer/` for the existing router | Not configured |
| Backend boundary | Approved API/DTO, separate service audiences, host-only Secure cookies, allowed origins and test tenants | Not supplied |
| Release binding | Exact source commit, build-time origins, build ID, manifest/file hashes and repeat-build result | Baseline exists; target-configured candidate pending |
| Deployment scope | Named environment, both frontend targets and explicit deployment authorization | Not recorded |
| Live acceptance | Scoped backend fixtures, J0–J7/O1 evidence and manual NVDA/VoiceOver | Not run |

The CI artifact `atlas-web-current-release` is the authoritative **unconfigured frontend baseline**: buildId `06c4f25404b5`, ZIP SHA-256 `ce689219d7901f84b4c6d716e2e93709f75699ade4388736155ae9e850b10a78`. Its 126 files were verified and its repeat build was identical. It is not a target-configured production candidate. Do not rebuild through symlinked dependencies and relabel the result as that CI artifact.

## Prepare a target-configured candidate

1. Review the UI and freeze approved source on `handoff/frontend-e2e`. Use a clean checkout, Node 22 and `npm ci`, matching CI. Keep production and review output separate.
2. Set `VITE_WORKSPACE_URL` and `VITE_OBSERVER_URL` before building. The latter must use the independent Observer origin and `/observer/`. These are public inputs, never credentials. Record their exact values with the candidate; the source digest does **not** incorporate environment variables or `.env` files.
3. Run frontend gates with the same inputs, then `npm run release -- candidate`. Record `release/candidate/release-manifest.json` and verify clean source commit, both entries, sizes and hashes. Rebuild with the same origin variables and the manifest's `ATLAS_BUILD_ID`; compare all output files to the manifest. An origin change creates a new candidate even if its source digest remains the same.
4. Preserve the exact artifact in an immutable location. Record artifact SHA-256, source commit, inputs and manifest SHA-256. CI artifact retention is 14 days; retain an authorized copy for deployment/rollback rather than depending on expiry.
5. For the existing Git-pinned generator, publish the approved artifact under `frontend/atlas-web/release/candidate/` in a distinct artifact commit. Run `npm run worker:staging -- <full-artifact-commit-sha> candidate`, generating `deploy/candidate-workspace-worker.js` and `deploy/candidate-observer-worker.js`. **Source commit/build ID and artifact commit are different identities.** Confirm immutable raw URLs serve the manifest and all bytes. Embedded hashes do not prove that the supplied artifact commit contains the local artifact.
6. Inspect both Workers and their hashes. Each serves its own SPA fallback and permits no service writes. Backend owners still enforce authentication, tenant/RBAC isolation and separate audiences; the frontend split does not establish them.

No command above deploys. Use the Workers after the UI/deployment gates are satisfied. Legacy `deploy/staging-worker.js`, committed `release/staging/` and staging metadata must not be used as the current two-entry release.

## After an authorized deployment

Replace legacy target metadata with actual URLs using [STAGING-TARGET.example.json](STAGING-TARGET.example.json) as a shape. Replace every `.invalid` placeholder; do not dispatch against example hosts. Run in `frontend/atlas-web`:

```sh
WORKSPACE_URL=https://actual-workspace-host \
OBSERVER_URL=https://actual-observer-host/observer/ \
EXPECTED_BUILD_ID='<candidate-build-id>' npm run verify:staging
```

Alternatively dispatch `.github/workflows/atlas-web.yml` on the source branch with `check_staging=true` and `expected_release` equal to the **candidate** build ID. Checked-out `deploy/staging-target.json` must contain both actual URLs. Dispatch defaults to false; a green frontend CI run with staging skipped is not staging acceptance.

Acceptance sends GET/HEAD only and checks both origins in Chromium, Firefox and WebKit: build ID, manifest-listed bytes, entries/audiences/headers/cache, missing assets, routes and axe. Missing configuration and failed checks fail the job. Retain raw failed runs separately. Public CI uploads JSON/log results without screenshot, video or trace bytes. The staging suite does not establish cookie isolation or backend business effects; complete live/manual checks separately.

Record each deployment/version ID, target, candidate manifest hash and time. A rollback must restore a previously accepted matching Workspace/Observer pair and approved backend contract; repeat delivery checks. Observed old deployments are not tested rollback releases for the new two-entry application.

## Separate live-backend acceptance

The production bundle contains no test peer. Follow [LIVE-E2E-ACCEPTANCE.md](LIVE-E2E-ACCEPTANCE.md): approved DTO/enum/config mappings; J0–J7/O1; all 27 exceptions and 40 rules; server-enforced isolation, sandbox, recovery/security; acknowledgement/effect/audit/artifact proof. Unknown outcomes require status inspection and never automatic resend. Resolve C01–C07 before certifying affected requirements.

Manual NVDA/VoiceOver checks remain in `ui-review/AT-CHECKLIST.md`. Axe and WebKit/Linux do not establish manual screen-reader or Safari/macOS acceptance.

## Integrations already available

- GitHub inspects source, current CI jobs/logs and artifacts and supports the already authorized source/report push.
- Cloudflare inspects Workers, active deployment/version metadata and account configuration. Writes require scoped deployment authorization after UI review.
- Playwright already supplies functional, responsive, visual, performance and axe automation. No additional browser plugin is required.

Deployment environment observations are retained in private evidence. They do not establish current delivery acceptance. No infrastructure write or deployment was performed.
