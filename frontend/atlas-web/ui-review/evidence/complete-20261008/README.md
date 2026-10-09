# Complete frontend evidence — 2026-10-08

The 20261008-complete folder contains a single fresh npm run verify pipeline: unit/typecheck/production build, tooling, full functional Chromium/Firefox/WebKit, Linux Chromium visual/performance, review build and three-engine review. Summary and raw reports are never merged with earlier runs. Runtime source digest remained unchanged. acceptance-inputs.json separately records test/config/baseline bytes matching the local commit; it was captured during the run, not before it.

functional-cases.json indexes every result from this run only. Conditional release/staging skips remain explicit. Transient Playwright trace buffers are excluded; finalized attachments are retained. Raw reports keep their original absolute attachment paths.

Historical failures, focused tests and previous source coverage remain under sibling evidence folders. This local PASS does not establish current-source GitHub CI, live backend E2E, production origins/cookies, staging/deployment or manual screen-reader acceptance. Local performance and realtime diagnostics do not certify production NFRs.
