# UI/UX acceptance — 2026-10-09

Frontend gates passed for source commit [`06c4f25404b5`](https://github.com/ldqanh1408/frontend/commit/06c4f25404b5b20a5e2bf6261936792f137ee740). [CI run 37877622378](https://github.com/ldqanh1408/frontend/actions/runs/37877622378) completed successfully in Chromium, Firefox and WebKit. Runtime source SHA-256: `aeda5bd9e3ae4242c793eaeb34a2019f9b887f7c6bc5a74c35753ee937badc60`. Evidence-only commits after this source commit do not change runtime or QA inputs.

## Delivered

Search examines all device records before limiting each rendered collection to 50 matches, distinguishes same-name records, reports loading/partial failures, cancels stale reads and offers an empty-search reset. Visible keyboard hints, Escape-to-invoker focus and route focus preserve navigation. Pointer-open explicitly establishes the search invoker for Safari's differing click-focus behavior.

Shared typography respects text preferences. Tenant scope changes its column count with text size, including 200% text at 320/375px; labels no longer overlap. Footer status wraps, small-screen header actions retain 44px targets, key/value columns use available width, and selection retains an outline in system contrast. Desktop sidebar no longer shows a duplicate drawer control. Both themes, self-hosted fonts, the ADR stack and business authority guards are preserved.

The requested skill was reviewed at a pinned commit; its off-topic generated landing-page pattern was rejected after a narrower retry. Verified guidance and functional references from VS Code, Linear and Primer were applied through Atlas's existing tokens. See [design decisions and requirement mappings](UI-UX-DESIGN-SYSTEM.md) and [full SRS/ADR conformance](SRS-ADR-CONFORMANCE.md).

## Verified results

| Gate | Result | Evidence / scope |
| --- | --- | --- |
| Typecheck and production/review builds | Pass | Clean CI checkout; both independent entries |
| Unit / release tooling | 83 / 7 passed | Local final checkout and all CI jobs |
| Functional + axe | 1,725 passed; 9 skipped; 0 failed/flaky | 575 + 3 skipped per engine; skipped release/staging checks are not acceptance |
| Review fixtures / execution states | 174 passed; 0 failed/flaky | 58 per engine; illustrative fixtures restricted to review build |
| Public layout | 150 passed | 25 views × 3 widths × 2 themes; includes opened editors |
| Private pixel regression | 150 passed | Chromium/Linux; changed-pixel ratio ≤0.005; independent run without update flag |
| Performance | 8 passed | Local max LCP 444ms, max CLS 0.031, max initial JS 232,079 bytes; lazy Monaco verified |
| Focused UX/shell | 40 passed | Final release in Chromium/Firefox; included in the full CI suite |
| Release repeat build | 126/126 files identical | Independently within local environment and within canonical CI |
| Private evidence gallery | 16 checks passed | Loaded images and no horizontal overflow at 390/1440px |

See [structured receipt](../ui-review/verification-uiux-20261009.json) for timestamps, source/QA digests, measurements and CI job IDs. The two supplied specification files were verified against their original SHA-256 and sizes. A private evidence package contains before/after images, all pixel baselines, raw CI JSON/log results and integrity indexes; images are kept private after automatic approval review rejected public screenshot publication. Public CI uploads JSON/log results without screenshot, video or trace bytes.

## Canonical release and reproduction

Deploy the `atlas-web-current-release` artifact from the linked CI run: buildId `06c4f25404b5`, source commit `06c4f25404b5b20a5e2bf6261936792f137ee740`, ZIP SHA-256 `ce689219d7901f84b4c6d716e2e93709f75699ade4388736155ae9e850b10a78`. All 126 manifest-listed files were independently checked for byte size and SHA-256 after download.

CI uses Ubuntu 24.04, Node 22 and the lockfile with `npm ci`. The local isolated worktree reused dependencies through a symlink: 90/126 files match CI across environments. Each environment rebuilds its own output identically; cross-environment identity is not certified. The CI artifact is authoritative for deployment.

```sh
npm ci
npx playwright install --with-deps chromium firefox webkit
npm run verify
# Add private pixel comparison only after restoring reviewed baselines:
ATLAS_VISUAL_BASELINE_DIR=/absolute/private/baselines npm run verify
```

Fresh acceptance run directories keep failed attempts separate. Candidate-baseline generation is calibration, followed by acceptance without `--update-snapshots`. See [visual policy](VISUAL-EVIDENCE.md). The reviewed pixel baseline belongs to `0ea93bc`; the independent acceptance targets source `06c4f25`, whose final pointer-focus adjustment does not change appearance.

## Remaining acceptance boundaries

- CI staging job was skipped. No deployment, merge, real staging acceptance or production sign-off occurred. Follow [deployment acceptance](DEPLOY-ACCEPTANCE.md) and [live journeys](LIVE-E2E-ACCEPTANCE.md).
- Backend contracts, server-side tenant/RBAC isolation, Temporal recovery, sandbox guarantees, production CRDT/terminal latency and the two-host/cookie Observer perimeter require real backend/deployment evidence. Frontend fixtures do not establish them.
- Local browser budgets do not establish field Core Web Vitals or production load behavior. Automated axe/keyboard tests do not replace manual NVDA/VoiceOver and real Safari/macOS testing.
- PR #1 `fix/secret-handling` remains open at `0e8cf8340f0f90bc3dee5a5e37019450bfcda24f`. Its four reviewed issues are fixed in the handoff source; the original PR was not changed or merged. See [PR review](../ui-review/PR-1-SECRET-HANDLING-REVIEW.md).
