# Conformance evidence — 2026-10-08

Final source digest is recorded in ../../verification-conformance-20261008.json. Final unit/build log is conformance-check-final-2.log (78 PASS); final focused browser report is conformance-browser-final.json (57 PASS across three engines); release reproducibility is conformance-repro.log (126 identical files).

Earlier iterations remain separate, including a failed validation-message assertion in conformance-check-final.log that was corrected and rerun. Earlier browser results use an earlier source. Do not combine the runs into a fabricated full-suite result. Previous acceptance-20261008 results and visual/performance evidence are historical and unchanged.

pr-review/ uses the exact remote PR head: existing 29 tests passed, four additional security expectations failed. Only synthetic inputs were used. The local handoff fixes do not modify the remote PR.

Functional realtime passes are not latency acceptance. A local presence observation was 276ms, and measurements include test-observation overhead. Real <200ms CRDT/presence and peak <=300ms terminal throughput require a proper live test. Backend E2E, deploy, staging and manual screen-reader checks were not run.

Raw Playwright reports preserve original absolute attachment paths. Any finalized attachments are retained under corresponding run folders. index.json records current evidence byte hashes. No raw error was overwritten with PASS.

Transient browser trace buffers are excluded. Both browser runs passed with no finalized failure trace; raw reports/logs and last-run metadata are retained.
