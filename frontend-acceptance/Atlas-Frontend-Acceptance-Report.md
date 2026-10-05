# Atlas Frontend Production Acceptance — Báo cáo (run 2 + run 3, 2026-10-05)

```text
FRONTEND ACCEPTANCE TARGET

Provider: Cloudflare
Primary URL: https://sparkling-snow-090d.ekko-okke666.workers.dev
Worker deployment: bd44cfc0-1219-40d9-9c1a-b1b7fe84d085 (version a8b5bc3a-63c9-4996-84e5-e8bc117775d3)
Pages deployment: none
Source revision: UNVERIFIED
Local build: UNVERIFIED
Remote/local equivalence: UNVERIFIED

VERDICT:
NO_GO_FRONTEND
```

Phạm vi: 210 canonical view (denominator theo v2; **0/210 liệt kê được** vì thiếu inventory) · 18 module route · Chromium 141 / Firefox 142 / WebKit 26 (Playwright, GitHub Actions) + Chromium của Cloudflare Browser Rendering · AUDIT_ONLY. Backend không được chứng nhận.

**Tóm tắt.** Deployment không đổi so với run 1; 120/120 payload khớp manifest. Routing, dialog, combobox, skip link, drawer mobile và hiệu năng tải trang đạt. Verdict **NO_GO_FRONTEND**: FE-02/03/04/05/06 có requirement bắt buộc FAIL — FND-018 (breadcrumb bị header che sau khi đổi view), FND-001 + FND-021 (tabs), FND-017 (title), FND-002 (CSP), FND-003 (cache), FND-022 (heap, budget giả định), FND-005 (toast cũ sau 401/hết phiên). FE-01 INCOMPLETE vì thiếu inventory/spec/source. Không có P0; P1 chỉ có FND-004 và FND-012 (kế thừa, chưa retest được).

## 1. Sáu gate

| Gate | Kết quả | Có bằng chứng | Còn chặn / FAIL |
|---|---|---|---|
| FE-01 Functional parity & routing | **INCOMPLETE** | 120/120 payload khớp manifest (Cloudflare browser + GitHub runner); 18/18 route deep link/reload/query/route lạ PASS trên Chromium 141, Firefox 142, WebKit 26 — case: 20 (PASS 15, FAIL 0, BLOCKED 3, NOT_RUN 0, N/A 2) | 210 view_id không liệt kê được (thiếu Screen-Inventory/Archive CSV, spec, source); FND-004/FND-012 chưa retest; Figma thiếu page per-view |
| FE-02 Responsive | **FAIL** | 216/216 tổ hợp route×viewport×theme trên Chromium + Firefox/WebKit ở 5 width; 768–1920 sạch mọi engine; 72 ảnh chụp — case: 30 (PASS 17, FAIL 9, BLOCKED 0, NOT_RUN 4, N/A 0) | FAIL: FND-018 (breadcrumb nằm dưới header cố định sau khi đổi view — Chromium/WebKit, 320/375/1440); state/zoom/coarse chưa script |
| FE-03 Accessibility | **FAIL** | axe-core 0 vi phạm (18 route, dark+light, mặc định); bàn phím thật PASS: skip link, Tab order + focus visible, Ctrl+K combobox, 2 dialog modal, drawer mobile, focus sau đổi view — case: 33 (PASS 20, FAIL 7, BLOCKED 0, NOT_RUN 3, N/A 3) | FAIL: FND-001 (tab↔tabpanel), FND-021 (mất focus khi Arrow trên tablist workspace), FND-017 (title), FND-018 (target bị che); AT NOT_RUN; axe connected/dialog NOT_RUN |
| FE-04 Runtime / workers / storage | **FAIL** | 0 lỗi runtime; 6 worker phục vụ MIME đúng; routing đồng nhất 3 engine — case: 15 (PASS 6, FAIL 3, BLOCKED 0, NOT_RUN 6, N/A 0) | FAIL: không CSP/security headers (FND-002); worker lifecycle, IndexedDB, 2 tab, Monaco/F12 chưa script |
| FE-05 Performance | **FAIL** | LCP p75 cold 168 ms / warm 80 ms / mobile throttled 1236 ms; CLS≈0; INP 40 ms (72 ms CPU 4×) — đạt budget khoá trước — case: 13 (PASS 7, FAIL 3, BLOCKED 0, NOT_RUN 3, N/A 0) | FAIL: asset băm max-age=0 (FND-003); heap +18,7%/30 chu kỳ vượt budget giả định (FND-022); workload lớn chưa chạy |
| FE-06 Journeys & fixtures / UAT | **FAIL** | FX-SERVICE (fixture có nhãn, click thật): 14/16 PASS — 1 POST khi double-click, stage đúng, 4xx/5xx/mạng/timeout/mismatch ⇒ Unknown, 401/hết phiên ⇒ disconnect, observer không gửi lệnh — case: 21 (PASS 14, FAIL 3, BLOCKED 3, NOT_RUN 1, N/A 0) | FAIL: FND-005 (toast thành công cũ còn sau 401/hết phiên); 42 journey + UAT BLOCKED (thiếu CSV); FX-EXEC-001 SPEC_UNRESOLVED |

## 2. Implementation (210 canonical view)

| Trạng thái | Run 2+3 (OBSERVED) | Run 1 (INHERITED, chưa xác minh lại) |
|---|---|---|
| COMPLETE | 0 | 0 |
| PARTIAL | 0 | 74 |
| NOT_IMPLEMENTED | 0 | 7 |
| UNVERIFIED | 210 | 129 |

Không view_id nào được suy ra từ tiêu đề/route (invariant 20). `Screen-Coverage.csv` giữ header với 0 hàng; `Route-Coverage.csv` (PROPOSED_EXTENSION) ghi 18 module route. Figma cho biết thiết kế có "184 Current views… 210 planned views" nhưng file không chứa page per-view.

## 3. Test denominator

| Total | PASS | FAIL | NOT_RUN | BLOCKED | NOT_APPLICABLE | Exclusions |
|---|---|---|---|---|---|---|
| 132 | 79 | 25 | 17 | 6 | 5 | 0 |

Mỗi biến thể engine là một case riêng (`-FIREFOX`, `-WEBKIT`); case tổng hợp (FE02-AUTO-216, FE03-KBD-001, FX-SERVICE-001, PERF-007, PERF-INP-001, FE04-XENGINE-001) được tính thêm. Không dùng % để bù gate.

## 4. Findings

| ID | Sev | Gate | Tiêu đề | Trạng thái | Retest |
|---|---|---|---|---|---|
| FND-001 | P2 | FE-03 | Tabs không liên kết tabpanel (thiếu aria-controls → role=tabpanel) — tái hiện trên 3 engine | OPEN (retested run 3: reproduces) | FE03-KBD-TABS,FE03-KBD-TABS-FIREFOX,FE03-KBD-TABS-WEBKIT |
| FND-002 | P2 | FE-04 | Không có CSP và các security header trên document/asset | OPEN (reproduced in run 2) | CF-PRE-005 |
| FND-003 | P2 | FE-05 | Asset có hash trong tên vẫn bị revalidate mỗi lần (max-age=0) | OPEN (reproduced in run 2) | CF-PRE-006 |
| FND-004 | P1 | FE-01 | 3/49 definition types cannot be created: default name contains "/" rejected by name validator | OPEN (inherited, not retested) | DEF-RETEST-FND-004 |
| FND-005 | P2 | FE-06 | Toast thành công cũ vẫn hiển thị sau khi 401 / hết phiên làm UI ngắt kết nối | OPEN (retested run 3: still reproduces on remote) | FX-SERVICE-FND-005,FX-SVC-EXPIRY |
| FND-006 | P3 | FE-06 | Quyết định 4xx definitive hay Unknown (FX-EXEC-001 / FX-CMD-004) — kế thừa run 1 | OPEN (SPEC_UNRESOLVED; behaviour observed in run 3) | FX-EXEC-001,FX-SVC-HTTP409,FX-SVC-HTTP422 |
| FND-007 | P3 | see run 1 | P3 finding from run 1 | OPEN (inherited, not retested) | see run-1 retest_case_ids |
| FND-008 | P3 | see run 1 | P3 finding from run 1 | OPEN (inherited, not retested) | see run-1 retest_case_ids |
| FND-009 | P3 | see run 1 | P3 finding from run 1 | OPEN (inherited, not retested) | see run-1 retest_case_ids |
| FND-010 | P3 | see run 1 | P3 finding from run 1 | OPEN (inherited, not retested) | see run-1 retest_case_ids |
| FND-011 | P2 | FE-03 | Scrollable table region not keyboard focusable | OPEN (inherited, not retested) | FE03-KBD-001 |
| FND-012 | P1 | FE-01 | 7 canonical screens NOT_IMPLEMENTED; 129 views without any case | OPEN (inherited, not retested) | FE01-210-001 |
| FND-013 | P3 | see run 1 | P3 finding from run 1 | OPEN (inherited, not retested) | see run-1 retest_case_ids |
| FND-014 | P3 | see run 1 | P3 finding from run 1 | OPEN (inherited, not retested) | see run-1 retest_case_ids |
| FND-015 | P3 | see run 1 | P3 finding from run 1 | OPEN (inherited, not retested) | see run-1 retest_case_ids |
| FND-016 | P3 | see run 1 | P3 finding from run 1 | OPEN (inherited, not retested) | see run-1 retest_case_ids |
| FND-017 | P3 | FE-03 | document.title không đổi theo view ("Atlas · Workspace" cho cả 18 module) | OPEN (new in run 2) | FE01-TITLE-001 |
| FND-018 | P2 | FE-02 | Sau khi đổi view từ ngoài <main> (menu mobile, sidebar desktop, nút header), trang bị cuộn 52–60 px và breadcrumb nằm dưới header cố định (Chromium, WebKit) | OPEN (root cause identified in run 3; earlier "light theme only" description superseded) | FE02-SCROLL-001-CHROMIUM,FE02-SCROLL-001-WEBKIT,FE02-AUTO-216-320,FE02-AUTO-216-375,A11Y-TARGET-001 |
| FND-019 | P3 | FE-03 | View "Workspace view not found" không có h1 trong main | OPEN (new in run 2) | FE01-ROUTE-003 |
| FND-020 | P3 | FE-01 | release-manifest.json khai báo "BUILT_NOT_DEPLOYED_NOT_PRODUCTION_CERTIFIED" và manifestSelfHash=null trong khi đang được phục vụ công khai | OPEN (new in run 2) | CF-PRE-002 |
| FND-021 | P2 | FE-03 | Nhấn mũi tên trên tablist "Specifications workspace" (IDE/Definitions/Service records) làm mất focus về <body> | OPEN (new in run 3) | FE03-KBD-TABS,FE03-KBD-TABS-FIREFOX,FE03-KBD-TABS-WEBKIT |
| FND-022 | P3 | FE-05 | JS heap tăng 18,7% sau 30 chu kỳ điều hướng (5 route/chu kỳ), sau đó chậm dần (+3,0% tới 60, +1,7% tới 90) | OPEN (new in run 3; needs product budget) | PERF-008 |

**Top P0/P1**: không có P0. P1 kế thừa chưa retest: FND-004 (kỳ vọng 49/49 definition type tạo được; cần Field-Dictionary + schema_oracle), FND-012 (kỳ vọng mỗi view có case; cần inventory/spec/source). P2 mới/được xác nhận trong run 3: FND-018, FND-021, FND-001, FND-005.

## 5. Specifications / Code Intelligence / Agent Lifecycle

| Mảng | Đã chứng minh | Thiếu / chưa kiểm |
|---|---|---|
| Specifications | Route render, deep link/reload 3 engine, tablist "Document inspector" theo APG (arrow/Home/End/roving) | FND-001/FND-021 (tabs); import/persistence/race/2-tab (SPEC-RETEST-001), Monaco gõ phím, tree (thư viện rỗng) chưa script |
| Code intelligence | Route render, 0 lỗi runtime | F12/references (CODE-008), 6 worker lifecycle (FE04-WORKER-001) chưa script — cần source snapshot mẫu |
| Agent lifecycle / service modules | FX-SERVICE trên #agents: 1 POST/double-click kèm Idempotency-Key + CSRF + If-Match; stage Received/Accepted/Rejected/Effective; mọi lỗi sau gửi ⇒ Unknown "do not resend"; journal ghi operation ID + evidence; observer không gửi lệnh | FND-005; 14 module còn lại chỉ đi qua cùng component ServiceModule (chưa chạy từng module); DTO chưa duyệt (FX-EXEC-001) |

## 6. Môi trường thực tế

| Lượt | Thời gian (UTC) | Môi trường | Phạm vi | Ghi chú |
|---|---|---|---|---|
| R2-001…004 | 2026-10-05 06:58–07:27Z | Cloudflare Browser Rendering (headless Chromium, UA Chrome/119), synthetic-DOM | Phase 0b metadata, hash 120 payload, header/MIME/cache, discovery, deep link/reload/history, FE02 320–1440 | Hết quota Free 10 phút/ngày lúc 07:27Z |
| R3-001 (run 37280321117) | 07:54–08:05Z | GitHub Actions, Playwright 1.56.1: Chromium 141 / Firefox 142 / WebKit 26 | mirror, discovery, axe dark/light, FE02 1920 + Firefox/WebKit 320/1920 | Bị huỷ; bước commit vẫn chạy và đẩy bản mirror plaintext (đã gỡ khỏi cây ở 41948df). Deeplink script cũ treo (lỗi harness) |
| run 37281392041 | 08:05–08:23Z | như trên | keyboard/perf/screenshots | Kết quả mất do xung đột commit (đã sửa workflow); chạy lại ở R3-003 |
| R3-002 (run 37282601201) | 08:24–08:29Z | như trên | mirror (redirect fixed), deeplink 3 engine, FE02 Firefox/WebKit 375/768/1440, FX-SERVICE 14 kịch bản, layout hit-test | OK |
| R3-003 (run 37284006443) | 08:30–08:35Z | như trên, trusted input + CDP | keyboard 3 engine, perf (cold/warm/mobile, INP, heap), 72 screenshots | Keyboard: 4 lỗi harness (đã sửa, không tính FAIL) |
| R3-004 (run 37285038578) | 08:40–08:42Z | như trên | keyboard 3 engine (harness đã sửa), INP ≥30 tương tác, heap 30/60/90 chu kỳ | OK |

- AT thật: không có (FE03-AT-001 NOT_RUN_AT; kịch bản thủ công ở Accessibility.md). Thiết bị thật: không có (emulation). Browser pane: không có.
- Kết quả của Cloudflare Browser Rendering và GitHub Actions được ghi thành case riêng (`-GH`, `-FIREFOX`, `-WEBKIT`); số liệu run 1 chỉ được trích dẫn với nhãn INHERITED.

## 7. Backend boundary

Xem `Atlas-Frontend-Backend-Dependencies.md`. DTO `atlas-ui/v1` vẫn "proposed"; FX-SERVICE chỉ chứng minh hành vi frontend với fixture có nhãn, không chứng minh service thật. 4xx-definitive (FND-006) SPEC_UNRESOLVED.

## 8. Deliverables

- Atlas-Frontend-Acceptance-Report.md / .html
- Atlas-Frontend-Acceptance-Manifest.json
- Atlas-Frontend-Screen-Coverage.csv (header, 0 hàng)
- Atlas-Frontend-Route-Coverage.csv
- Atlas-Frontend-Test-Results.csv
- Atlas-Frontend-Findings.csv
- Atlas-Frontend-Journey-Results.csv (header)
- Atlas-Frontend-UAT-Classification.csv (header)
- Atlas-Frontend-Accessibility.md
- Atlas-Frontend-Performance.json / .md
- Atlas-Frontend-Backend-Dependencies.md
- Atlas-Frontend-Remediation-Plan.md
- Atlas-Frontend-Cloudflare-Deployment.md
- evidence/ (runs R2-*, R3-*, 72 screenshots, standards, figma) + evidence-index.json (mọi path đã assert)
- work/ (ledgers + scripts)
- harness/ (Browser Rendering scripts + Playwright suites + workflow)

## 9. Exact remaining cases

| Case | Gate | Kết quả | Expected | Evidence | Lý do / cách nghiệm thu tiếp |
|---|---|---|---|---|---|
| A11Y-AXE-002 | FE-03 | NOT_RUN | 0 violations | — | Remaining scope: connected service state and open dialogs (needs axe inside the fxservice suite). |
| CODE-008 | FE-04 | NOT_RUN | navigates to oracle locations | — | Trusted input, Firefox/WebKit and CDP are now available via GitHub Actions (run 3); scenario not yet scripted: needs a seeded source snapshot (Import source folder) with an AST oracle |
| DEF-RETEST-FND-004 | FE-01 | BLOCKED | all types create successfully | — | BLOCKED_INPUT_MISSING: Atlas-Field-Dictionary.csv / work/schema_oracle.json not provided in this session (only the master prompt was uploaded; no handover zip). BLOCKED_CLOUDFLARE_BROWSER_QUOTA: Cloudflare Browser Rendering (the only remote browser available t |
| FE01-210-001 | FE-01 | BLOCKED | 210 rows with case evidence | — | BLOCKED_INPUT_MISSING: Atlas-Screen-Inventory.csv, Atlas-Archive-Canonical-Frontend.csv, State-Matrix, RBAC, Field-Dictionary, source frontend/workspace-web not provided in this session (only the master prompt was uploaded; no handover zip). |
| FE02-COARSE-001 | FE-02 | NOT_RUN | no loss of essential actions | — | Trusted input, Firefox/WebKit and CDP are now available via GitHub Actions (run 3); not yet scripted |
| FE02-STATE-001 | FE-02 | NOT_RUN | no overflow/clipping | — | Trusted input, Firefox/WebKit and CDP are now available via GitHub Actions (run 3); not yet scripted (states via FX-SERVICE fixture + seeded data) |
| FE02-WALK-001 | FE-02 | NOT_RUN | 72 screenshots captured after correct render (h1 matched); visual review vs Figma pending | EV-SHOT-601 | Screenshots captured (72) and spot-checked by the auditor (375 light #agents shows the breadcrumb hidden under the header = FND-018; 1440 dark #specifications renders as expected); visual parity vs Figma not possible (per-view frames absent) |
| FE02-ZOOM-001 | FE-02 | NOT_RUN | no loss of content/function | — | Trusted input, Firefox/WebKit and CDP are now available via GitHub Actions (run 3); not yet scripted (Playwright deviceScaleFactor/CSS zoom; real browser zoom still needs a desktop browser) |
| FE03-AT-001 | FE-03 | NOT_RUN | Name/role/state/announcements correct | — | NOT_RUN_AT: no screen reader / real device available in this cloud session |
| FE03-MOTION-001 | FE-03 | NOT_RUN | no loss of content/function | — | Trusted input, Firefox/WebKit and CDP are now available via GitHub Actions (run 3); not yet scripted (Playwright emulateMedia reducedMotion/forcedColors) |
| FE04-IDB-001 | FE-04 | NOT_RUN | graceful recovery, no data loss | — | Trusted input, Firefox/WebKit and CDP are now available via GitHub Actions (run 3); scenario not yet scripted (isolated-profile quota/denied/malformed/migration cases) |
| FE04-TAB-001 | FE-04 | NOT_RUN | conflict surfaced, no silent overwrite | — | Trusted input, Firefox/WebKit and CDP are now available via GitHub Actions (run 3); scenario not yet scripted (two contexts on one profile now possible in Playwright) |
| FE04-WORKER-001 | FE-04 | NOT_RUN | workers start, respond, terminate; served as JS; allowed by CSP | — | Trusted input, Firefox/WebKit and CDP are now available via GitHub Actions (run 3); scenario not yet scripted: needs an opened document/source file to start the 6 Monaco workers |
| FE04-XENGINE-HISTORY-FIREFOX | FE-04 | NOT_RUN | #specifications → #home → #specifications | EV-XE-615 | Inconclusive: iframe history.back() in Gecko walks the joint session history differently (second back did not reach #home); needs a top-level page.goBack() check — not attributed to the app. |
| FE06-UAT-307 | FE-06 | BLOCKED | classified | — | BLOCKED_INPUT_MISSING: Atlas-Original-UAT-113.csv, Atlas-UX-UAT-194.csv not provided in this session (only the master prompt was uploaded; no handover zip). |
| FE06-UXJ-042 | FE-06 | BLOCKED | all applicable steps PASS | — | BLOCKED_INPUT_MISSING: Atlas-Source-Journeys-42.csv not provided in this session (only the master prompt was uploaded; no handover zip). |
| FIGMA-001 | FE-01 | BLOCKED | visual parity | EV-FIG-501 | BLOCKED_INPUT: Figma file 0md9BEFI1rU0aRAvf98TWO supplied, but only pages "00 · Start here" and "03 · Design system" exist; the per-view pages "01/02 · Current UI · Dark/Light" referenced by the file are absent, so view-level frame pairs cannot be compared |
| FX-BRANCH-001 | FE-06 | NOT_RUN | per v2 §9 P-B FE-06 | — | Trusted input, Firefox/WebKit and CDP are now available via GitHub Actions (run 3); partly covered by FX-SVC-EXPIRY/OBSERVER/HTTP409; remaining: revoked mid-flow, stale revision on GET, offline/reconnect, role projection, reverse-order, retry/resume/cancel rac |
| FX-EXEC-001 | FE-06 | BLOCKED | per DTO | — | SPEC_UNRESOLVED: atlas-ui/v1 DTO not approved (Connection page itself states "Service adapter contract is proposed") |
| PERF-006 | FE-05 | NOT_RUN | within locked budget | — | Trusted input, Firefox/WebKit and CDP are now available via GitHub Actions (run 3); not yet scripted (needs import fixtures of growing size) |
| PERF-009 | FE-05 | NOT_RUN | within budget | — | Trusted input, Firefox/WebKit and CDP are now available via GitHub Actions (run 3); not yet scripted (needs 1k/10k/100k-line files opened in Monaco) |
| PERF-WORKLOAD-001 | FE-05 | NOT_RUN | within budget + cleanup | — | Trusted input, Firefox/WebKit and CDP are now available via GitHub Actions (run 3); not yet scripted (synthetic workloads) |
| SPEC-RETEST-001 | FE-04 | NOT_RUN | oracle SHA-256 equal | — | Trusted input, Firefox/WebKit and CDP are now available via GitHub Actions (run 3); scenario not yet scripted: needs seeded documents and the SHA-256/AST oracles of run 1 |

## 10. Giới hạn và sự cố

- Không có source ⇒ không có COMPLETE; local/remote equivalence UNVERIFIED (chỉ chứng minh remote == manifest).
- Detector/axe chạy ở trạng thái mặc định và trạng thái kết nối fixture trên #agents; không suy ra cho 210 view.
- Harness có lỗi ở một số lượt (deeplink cũ, hash runner không theo redirect, 4 kiểm tra bàn phím ở R3-003); tất cả đã sửa và chạy lại, kết quả lỗi harness không được tính FAIL.
- Sự cố: run CI bị huỷ đã commit bản mirror plaintext của payload công khai lên branch public; đã gỡ khỏi cây (41948df) nhưng còn trong lịch sử git. Muốn xoá hẳn cần force-push (chưa làm, chờ chủ repo quyết định).
- Link ChatGPT người dùng gửi không đọc được (chatgpt.com bị proxy chặn).

_Generated 2026-10-05T08:55Z từ work/tests.json + work/findings.json bằng work/build.py._
