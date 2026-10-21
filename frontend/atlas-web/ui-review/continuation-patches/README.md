# Continuation patches

The full source snapshot already contains these changes; do not apply them again to this ZIP.

1. `0001-release-acceptance-fix.patch`: release integrity, separate audiences, staging/CI gates and isolated evidence runner.
2. `0002-focus-and-browser-readiness.patch`: StrictMode initial focus, mounted-control keyboard checks and automation updater settings.
3. `0003-current-ci-release.patch`: current-commit release reproducibility and CI artifact retention.
4. `0004-acceptance-and-deploy-runbook.patch`: checkpoint 14, deploy runbook and source-linked raw evidence.

5. `0005-secret-policy-and-pr-gates.patch`: shared persistence/download guards, masked transient inputs, exact fingerprint binding, null inheritance and PR/read-only CI gates.
6. `0006-srs-adr-conformance-evidence.patch`: checkpoint15, immutable SRS/ADR baseline, complete traceability, live acceptance plan and exact PR reproduction evidence.
7. `0007-complete-frontend-verification.patch`: checkpoint16, one fresh complete frontend PASS, original raw reports/case hashes and user-confirmed repository/scope; no runtime changes.

Patches5–6 follow local commit `91a7e7e`; exact new local commits are recorded in `../conformance-source.json`.

Historical checkpoint patches remain in `../patches/`. The archive contains the supplied final report inputs/evidence as well. Patches are for review or application to their matching base; their local commit IDs are not remote deployment evidence. No push, remote PR change or deployment was performed.
