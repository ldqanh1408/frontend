# Deploy and acceptance continuation

This handoff prepares source and read-only checks. It does not authorize or perform a deployment.

## Before producing the deployable release

1. Review the current UI and retain the explicit UI-before-deploy gate from HANDOFF.md.
2. Use independent HTTPS origins for Workspace and Observer. Configure `VITE_WORKSPACE_URL` and `VITE_OBSERVER_URL`
   before building; the latter should include `/observer/` for the existing Observer router. Use the same values for the
   reproducibility rebuild. Environment-specific origins are deployment inputs; the current local acceptance uses
   unconfigured loopback links and does not certify those production inputs.
3. Identity/backend owners must supply separate service audiences, host-only Secure cookies and authorization policies.
   A split frontend router/Worker does not establish server-side tenant or authentication isolation.
4. Commit source on `claude/sharp-thompson-5tff91`. Build with `npm run release`, commit the release artifact, then generate
   both Workers with `npm run worker:staging -- <artifact-commit-sha>`. No command in these scripts publishes anything.
5. Inspect both generated workers; the legacy `deploy/staging-worker.js` and legacy staging JSON are historical records
   and must not be used as a release of the current two-entry application.

## After an authorized deployment

Configure `workspaceUrl` and `observerUrl` in `deploy/staging-target.json`. Run `npm run verify:staging` with both URLs and
`EXPECTED_BUILD_ID`, or dispatch `atlas-web` with `check_staging=true` and the exact `expected_release`. Acceptance sends
GET/HEAD only and requires all three browser engines on both origins. Missing configuration and failed checks fail the
job. Evidence is uploaded as CI artifacts; there is no automatic evidence commit, deployment or success override.

Do not use a historical green CI run as evidence for the uploaded source or the continuation changes. Use the current
commit and artifact hashes when reviewing results.

## Separate live-backend acceptance

The production bundle contains no test peer. Existing browser peers establish frontend protocol behavior only. Actual
lock/freeze/persistence, AI generation, plan approval, human/risk gates, PR creation, CI, drift and Implemented receipts
must be exercised against an authorized live backend with scoped test resources. Unknown outcomes require status
inspection and never an automatic resend. Server-provided operation/scope/resource/fingerprint evidence must match.

Manual NVDA/VoiceOver checks remain in `ui-review/AT-CHECKLIST.md`; axe cannot replace them.

## Useful integrations

- GitHub: inspect the current source branch, CI jobs/logs and publish source after explicit transfer authorization.
- Cloudflare: inspect deployment versions, Worker configuration and logs; use write operations only for a deployment
  authorized after the UI gate.
- Playwright: already installed for functional, responsive, visual, performance and axe automation. No extra browser
  plugin is required for these local/CI checks.

Cloudflare inspection on 2026-10-08 observed `atlas-web-staging` and `sparkling-snow-090d`; no independent Observer Worker
was present. The observed staging deployment predates this source. No Cloudflare write was performed.

GitHub connection on 2026-10-08 confirms the canonical repository is `ldqanh1408/frontend` (the handoff name `hehe` redirects there), default branch `claude/sharp-thompson-5tff91`, with push permission. The earlier automatic approval rejection still requires explicit authorization to export this source/evidence before pushing. No GitHub write was performed.


## SRS/ADR acceptance is a separate required gate

Read `SRS-ADR-CONFORMANCE.md` and `LIVE-E2E-ACCEPTANCE.md` before acceptance. Current frontend fixes and release checks do not fulfill the complete product. All J0–J7/O1 live journeys, 27 exceptions, server-enforced rules, backend security/recovery tests and conflicts C01–C07 must have concrete passing evidence. The historical audit workflow is artifact-only and does not certify the current two-origin release; the primary atlas-web staging check requires exact origins/build ID. PR-triggered CI was added locally; it has not been pushed or run on GitHub.
