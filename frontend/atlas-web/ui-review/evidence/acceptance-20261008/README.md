# Current acceptance evidence, 2026-10-08

`20261008-local-03/functional.json` is the complete 1694-pass/1-fail/9-skip run before the focus repair. Its FAIL summary and finalized failure trace remain unchanged.

`20261008-final/targeted.json` records 48 functional, 150 visual and 8 performance passes after the repair. `focus-repeat.json` records 30 repeated skip-link checks; `review.json` records 174 review checks. Reruns replace matching cases in `functional-coverage.json`; that file is derived coverage, not a single full green acceptance run.

The two earlier local runs and three focus attempts were interrupted. Missing-target staging and archive Worker generation are intentional negative checks. `unit-fixture-initial.log` retains the failed new test fixture before cleanup was corrected; `unit-and-build-final.log` records 56 passes. `ci-repro-final.log` is the exact workflow step checked locally, not a GitHub run.

`index.json` contains file hashes. Raw reports retain their original absolute attachment paths; finalized attachments can be found under the matching relative run folder here. Transient hidden browser trace buffers are excluded.

Live backend business effects, remote CI of the final source, independent host/cookie security and manual NVDA/VoiceOver are not certified by this evidence. No deployment occurred.
