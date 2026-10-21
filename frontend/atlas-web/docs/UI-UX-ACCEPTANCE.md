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

The `atlas-web-current-release` artifact from the linked CI run is the verified unconfigured frontend baseline: buildId `06c4f25404b5`, source commit `06c4f25404b5b20a5e2bf6261936792f137ee740`, ZIP SHA-256 `ce689219d7901f84b4c6d716e2e93709f75699ade4388736155ae9e850b10a78`. All 126 manifest-listed files were independently checked for byte size and SHA-256 after download. It does not contain approved production origin inputs. Prepare and reverify a target-configured candidate as described in [deployment acceptance](DEPLOY-ACCEPTANCE.md); preserve the exact artifact and input receipt.

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

- CI staging job was skipped in that run. The staging deployment that has since been performed and accepted is recorded in [STAGING-DEPLOYMENT-20261021.md](STAGING-DEPLOYMENT-20261021.md). Production sign-off has not occurred. Follow [deployment acceptance](DEPLOY-ACCEPTANCE.md) and [live journeys](LIVE-E2E-ACCEPTANCE.md).
- Backend contracts, server-side tenant/RBAC isolation, Temporal recovery, sandbox guarantees, production CRDT/terminal latency and the two-host/cookie Observer perimeter require real backend/deployment evidence. Frontend fixtures do not establish them.
- Local browser budgets do not establish field Core Web Vitals or production load behavior. Automated axe/keyboard tests do not replace manual NVDA/VoiceOver and real Safari/macOS testing.
- PR #1 `fix/secret-handling` remains open at `0e8cf8340f0f90bc3dee5a5e37019450bfcda24f`. Its four reviewed issues are fixed in the handoff source; the original PR was not changed or merged. See [PR review](../ui-review/PR-1-SECRET-HANDLING-REVIEW.md).

# Integrated branch acceptance — 2026-10-21

The handoff line and the three open branches were merged into `merge/all-branches`. The gates below were run on the integrated source, not on any single branch. The merge decisions and the per-conflict rationale are in [SRS/ADR conformance](SRS-ADR-CONFORMANCE.md).

## Verified results

| Gate | Result | Evidence / scope |
| --- | --- | --- |
| Typecheck (app + tooling) | Pass | Both tsconfig projects |
| Unit / release tooling | 95 / 7 passed | 15 unit files; 7 tooling checks |
| Production build | Pass | No review-mode copy in the production bundle |
| Chromium functional + axe | 587 passed; 3 skipped; 0 failed | Includes the new SSH and connector coverage |
| Firefox functional + axe | 575 passed; 3 skipped; 0 failed | Three-engine CI on Ubuntu |
| WebKit functional + axe | Pass | Three-engine CI on Ubuntu |
| Public layout | 170 passed | 28 views × 3 widths × 2 themes, plus opened editors |
| Review fixtures / execution states | 58 passed per engine | Illustrative fixtures restricted to the review build |
| Three-engine CI | Pass | Chromium, Firefox and WebKit all completed successfully |

The three skipped checks are the release/staging acceptance checks. Staging acceptance was performed separately against a configured target: release `0a0bba532b1b` is deployed to two independent origins and passed 18 expected, 0 unexpected, 0 flaky across Chromium, Firefox and WebKit. See [STAGING-DEPLOYMENT-20261021.md](STAGING-DEPLOYMENT-20261021.md).

Two defects were found and fixed during the staging deployment itself. The published release artifact was not byte-identical to its manifest because `core.autocrlf` rewrote line endings for six text files; the release directory is now marked `-text -eol` and all 128 files were re-verified byte-for-byte from the published origin. A horizontally scrollable table region was not reachable by keyboard, which the WebKit audit reported as `scrollable-region-focusable`; a shared `ScrollableTable` wrapper now gives such a region a focus stop and an accessible name, and the full accessibility suite passes on all three engines (1398 expected, 0 unexpected).

## What the new coverage asserts

The SSH connection workspace and the connector catalog had no end-to-end coverage at all. The new spec asserts that the disconnected state names its blocker instead of showing an empty list; that a session without an explicit workspace identifier is refused rather than guessed; that a scope whose identifiers disagree between the capability and the session is rejected before any scope call is made; that a literal secret and a malformed host-key fingerprint are refused before a create request is sent; that a Vault reference travels while the secret value does not; that an uncertain list failure is reported without inventing records; that a connector draft is saved and exported as a device draft with no provider call; and that the stylesheet for both surfaces is present, so a missing stylesheet fails the gate instead of passing silently.
