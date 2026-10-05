# Atlas Frontend Acceptance — run 2 (AUDIT_ONLY)

Audit artifacts for the Cloudflare deployment `sparkling-snow-090d` (see `Atlas-Frontend-Acceptance-Manifest.json`).
Nothing in this folder is part of the Atlas product or changes release behaviour.

- `harness/` — Playwright/Node test harness executed by `.github/workflows/atlas-acceptance.yml` against the public URL.
- `run-request.json` — which suites the next CI run executes (pushing it triggers the workflow).
- `runs/<request_id>/` — raw results committed back by CI (per suite `results.json` + evidence files).
- `work/` — ledger (`tests.json`, `findings.json`) and scripts (`tests.py`, `findings.py`, `coverage.py`, `build.py`).
- `work/release-mirror/` — byte copy of the public release payload, SHA-256 verified against `/release-manifest.json`.
  Used only to develop tests locally; local results are never used as acceptance evidence.
- `evidence/`, `evidence-index.json`, `Atlas-Frontend-*.{md,csv,json,html}` — deliverables.
