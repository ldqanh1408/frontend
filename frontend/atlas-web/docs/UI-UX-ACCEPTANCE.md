# UI/UX acceptance — 2026-10-09

Implementation is on `handoff/frontend-e2e` in [ldqanh1408/frontend](https://github.com/ldqanh1408/frontend). This checkpoint supersedes historical current-status wording in HANDOFF checkpoints 12–16. It does not certify backend business acceptance or production deployment.

## Delivered

Search now examines all device records before limiting rendered matches, distinguishes same-name records, reports loading/partial failures, cancels stale reads and offers an empty-search reset. Keyboard hints are visible; Escape restores the invoker and navigation preserves route focus. Shared typography scales with browser text preferences. Footer status wraps, mobile header actions retain 44px targets, key/value columns use available space, and selected rows remain visible in system contrast. Both existing themes and the ADR stack are preserved.

See [UI-UX-DESIGN-SYSTEM.md](UI-UX-DESIGN-SYSTEM.md) for verified skill guidance, platform references and requirement mappings. Public test entrypoints use layout checks; private pixel comparisons require explicitly supplied baselines. No new screenshot bytes are published to this public repository.

## Verification status

The implementation checkpoint has passed typecheck, production/review builds, 83 unit tests and 7 release-tooling tests. New focused UX tests passed on Chromium and Firefox before the final complete run. Full functional, layout/performance, private pixel regression and current-commit CI are being verified; their final reports will be appended to this document and `ui-review/verification-uiux-20261009.json`.

The prior handoff commit `b24f9a3f214c05f12cb01bfa87c0a2ae3b8ec578` passed 150 private visual and 150 layout cases before these UI changes. Those historical results are not counted as acceptance of the changed UI.

## Reproduce

```sh
npm ci
npx playwright install --with-deps chromium firefox webkit
npm run verify
# Include private pixel regression only with reviewed baseline PNGs restored:
ATLAS_VISUAL_BASELINE_DIR=/absolute/private/baselines npm run verify
```

Fresh run directories prevent results from successful reruns being merged. Baseline generation with `--update-snapshots` is calibration and is followed by independent comparison without that flag. See [VISUAL-EVIDENCE.md](VISUAL-EVIDENCE.md).

## Remaining acceptance boundaries

- WebKit could not launch locally because system libraries are absent and Ubuntu package endpoints return 503 in this execution environment. The public CI matrix installs all engines on Ubuntu 24.04. Its actual conclusion is recorded separately from local results.
- [SRS-ADR-CONFORMANCE.md](SRS-ADR-CONFORMANCE.md) tracks missing backend, tenant/RBAC enforcement, Temporal recovery, sandbox, live CRDT/terminal latency and two-host/cookie Observer perimeter evidence.
- Local browser budgets are not field Core Web Vitals or production load tests. Axe and keyboard checks are not a manual NVDA/VoiceOver audit.
- No deployment, merge, live staging acceptance or production sign-off has occurred. [DEPLOY-ACCEPTANCE.md](DEPLOY-ACCEPTANCE.md) defines the remaining deployment gates.
