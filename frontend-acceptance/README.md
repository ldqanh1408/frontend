# Atlas Frontend Acceptance — run 2 (AUDIT_ONLY, 2026-10-05)

Audit artifacts for the Cloudflare deployment `sparkling-snow-090d` (deployment `bd44cfc0-1219-40d9-9c1a-b1b7fe84d085`).
Nothing in this folder is part of the Atlas product or changes release behaviour. Start with `Atlas-Frontend-Acceptance-Report.md`.

| Path | Content |
|---|---|
| `Atlas-Frontend-*.{md,csv,json,html}` | Deliverables (v2 §10) |
| `evidence/` + `evidence-index.json` | Raw run results (`evidence/runs/R2-*`), Cloudflare manifest copy, standards read |
| `work/` | Ledgers `tests.json`, `findings.json`; `record_r2.py` (fills ledgers from evidence), `tests.py`, `findings.py`, `coverage.py`, `build.py` (`cd work && python3 record_r2.py && python3 build.py`) |
| `harness/remote/*.js` | Scripts injected into Cloudflare Browser Rendering `/content` via `addScriptTag` (release_verify, discover, deeplink, detector + fe02, axe, perf_cold, fx_service — the last three were written after the quota ran out and are not yet executed remotely; fx_service is an untested draft) |
| `harness/suites/*.mjs`, `harness/run.mjs`, `run-request.json`, `../.github/workflows/atlas-acceptance.yml` | Playwright harness for GitHub Actions (chromium/firefox/webkit, trusted input). Pushing `run-request.json` triggers it; results are committed to `evidence/runs/<request_id>/`. Requires the Claude GitHub App on the repo. |
