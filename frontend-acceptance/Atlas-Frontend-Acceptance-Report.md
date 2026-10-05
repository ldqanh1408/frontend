# Atlas Frontend Production Acceptance — Báo cáo (run 2 + 3 + 4, 2026-10-05)

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

Phạm vi: **210 view theo Planned inventory của Figma** (file `0md9BEFI1rU0aRAvf98TWO`, node 342:5) · 18 module route · 49 definition type · 42 journey / 174 bước (traceability Figma) · Chromium 141 / Firefox 142 / WebKit 26 (Playwright, GitHub Actions) + Chromium của Cloudflare Browser Rendering · AUDIT_ONLY. Backend không được chứng nhận.

> **Đính chính:** run 2–3 ghi "file Figma chỉ có 2 page" — sai. `get_metadata` chỉ liệt kê page đã tải; Plugin API cho thấy đủ 10 page. Run 4 dùng Figma làm chuẩn cho inventory 210 view, so sánh Current UI, field contract 49 type và 174 bước journey. Xem `evidence/figma/start-here-metadata.md`.

## 0. Đã nghiệm thu được gì (run 4, theo Figma)

| Hạng mục | Kết quả trên bản deploy | Case |
|---|---|---|
| Definition type tới được từ UI module, tiêu đề đúng Figma | **49/49 PASS** | DEF-NAV-* |
| Số field + nhóm section (tên, thứ tự, số lượng) đúng Figma | **49/49 PASS** | DEF-COUNT-* |
| Field contract đúng Figma (key, nhãn, bắt buộc, đơn vị, min/max, option) | **46/46 type mở được PASS — 855 control, 0 khác biệt**; 3 type BLOCKED do FND-004 | DEF-FIELDS-* |
| Tạo definition cục bộ | **46/49 PASS**; 3 FAIL trên cả Chromium/Firefox/WebKit (FND-004) | DEF-CREATE-*, DEF-RETEST-FND-004 |
| Không có dữ liệu giả/mock trong bản production; action bảo vệ luôn hiển thị kèm lý do chặn | PASS | OBS-NOMOCK-001, OBS-BLOCKERS-001 |
| Giao diện so với Figma Current UI (18 route × dark/light) | **FAIL 36/36** — tiêu đề trùng 5/18, mô tả 0/18, IA điều hướng 7/21, thiếu 273/421 điều khiển Figma | FIGMA-001, FIGMA-PARITY-* |
| 210 view của Figma | COMPLETE 0 · PARTIAL 129 · NOT_IMPLEMENTED 0 · UNVERIFIED 81; chức năng phía frontend: PASS 107, FAIL 9, BLOCKED 76, NOT_RUN 18 | FE01-210-001 |
| 174 bước journey (Figma) | PASS 1 · FAIL 9 · BLOCKED 160 · NOT_RUN 4 | FE06-UXJ-042 |

**Tóm tắt.** Deployment không đổi; 120/120 payload khớp manifest. Phần authoring (49 definition type) khớp Figma đến từng field, trừ 3 type không tạo được (FND-004, P1). Giao diện module **không** theo Figma Current UI: IA điều hướng, tiêu đề, mô tả và bố cục/điều khiển khác (FND-023/024/025). Verdict **NO_GO_FRONTEND**: mọi gate có requirement bắt buộc FAIL — FE-01 (FND-004, lệch thiết kế), FE-02 (FND-018), FE-03 (FND-001/021/017/018), FE-04 (FND-002), FE-05 (FND-003/022), FE-06 (FND-005, FND-004 chặn journey). Không có P0; P1: FND-004, FND-012.

## 1. Sáu gate

| Gate | Kết quả | Có bằng chứng | Còn chặn / FAIL |
|---|---|---|---|
| FE-01 Functional parity & routing | **FAIL** | 120/120 payload khớp manifest; 18/18 route deep link/reload 3 engine; 49/49 definition type tới được và đúng tiêu đề Figma; 49/49 số field + nhóm section khớp Figma; 46/46 type mở được khớp Figma đến từng field (855 control, 0 khác biệt); 210/210 view Figma đã ánh xạ — case: 255 (PASS 206, FAIL 44, BLOCKED 3, NOT_RUN 0, N/A 2) | FAIL: FND-004 (3/49 type không tạo được, 3 engine); thiết kế lệch Figma — FND-023 (IA điều hướng), FND-024 (tiêu đề 13/18, mô tả 18/18), FND-025 (273/421 điều khiển Figma không có); 0/210 view COMPLETE, 81 UNVERIFIED (FND-012) |
| FE-02 Responsive | **FAIL** | 216/216 tổ hợp route×viewport×theme trên Chromium + Firefox/WebKit ở 5 width; 768–1920 sạch mọi engine; 72 ảnh chụp — case: 30 (PASS 17, FAIL 9, BLOCKED 0, NOT_RUN 4, N/A 0) | FAIL: FND-018 (breadcrumb nằm dưới header cố định sau khi đổi view — Chromium/WebKit, 320/375/1440); state/zoom/coarse chưa script |
| FE-03 Accessibility | **FAIL** | axe-core 0 vi phạm (18 route, dark+light, mặc định); bàn phím thật PASS: skip link, Tab order + focus visible, Ctrl+K combobox, 2 dialog modal, drawer mobile, focus sau đổi view — case: 33 (PASS 20, FAIL 7, BLOCKED 0, NOT_RUN 3, N/A 3) | FAIL: FND-001 (tab↔tabpanel), FND-021 (mất focus khi Arrow trên tablist workspace), FND-017 (title), FND-018 (target bị che); AT NOT_RUN; axe connected/dialog NOT_RUN |
| FE-04 Runtime / workers / storage | **FAIL** | 0 lỗi runtime; 6 worker phục vụ MIME đúng; routing đồng nhất 3 engine — case: 25 (PASS 10, FAIL 9, BLOCKED 0, NOT_RUN 6, N/A 0) | FAIL: không CSP/security headers (FND-002); worker lifecycle, IndexedDB, 2 tab, Monaco/F12 chưa script |
| FE-05 Performance | **FAIL** | LCP p75 cold 168 ms / warm 80 ms / mobile throttled 1236 ms; CLS≈0; INP 40 ms (72 ms CPU 4×) — đạt budget khoá trước — case: 13 (PASS 7, FAIL 3, BLOCKED 0, NOT_RUN 3, N/A 0) | FAIL: asset băm max-age=0 (FND-003); heap +18,7%/30 chu kỳ vượt budget giả định (FND-022); workload lớn chưa chạy |
| FE-06 Journeys & fixtures / UAT | **FAIL** | FX-SERVICE (fixture có nhãn, click thật): 14/16 PASS — 1 POST khi double-click, stage đúng, 4xx/5xx/mạng/timeout/mismatch ⇒ Unknown, 401/hết phiên ⇒ disconnect, observer không gửi lệnh — case: 22 (PASS 15, FAIL 4, BLOCKED 2, NOT_RUN 1, N/A 0) | FAIL: FND-005; journey Figma (42/174 bước): 1 PASS, 9 FAIL (FND-004 ×7, FND-018, FND-005), 160 BLOCKED (cần service thật / AT), 4 NOT_RUN; UAT 113+194 BLOCKED (Figma không chứa dòng UAT); FX-EXEC-001 SPEC_UNRESOLVED |

## 2. Implementation (210 view của Figma Planned inventory)

| Trạng thái | Run 4 (OBSERVED) | Run 1 (INHERITED, đã thay thế) |
|---|---|---|
| COMPLETE | 0 | 0 |
| PARTIAL | 129 | 74 |
| NOT_IMPLEMENTED | 0 | 7 |
| UNVERIFIED | 81 | 129 |

Quy tắc (coverage.py): mỗi view nối với bản deploy qua (a) node Current UI trong inventory → frame → route, (b) registry schema của chính bundle đã deploy (49 schema ↔ view slug), kiểm chứng runtime bằng DEF-*. 96 view có frame Current, 116 view có form authoring. PARTIAL = có route/form nhưng màn hình riêng theo Figma chưa có và parity FAIL. UNVERIFIED (81) = 10 mục Figma đánh dấu review-scope + 71 route/state chỉ xuất hiện khi có điều kiện service (dữ liệu run, quyền bị thu hồi…) hoặc dữ liệu seed cục bộ — không chứng minh được là thiếu, nên **không** gán NOT_IMPLEMENTED. Không view nào COMPLETE: chính inventory Figma xếp 4 view tốt nhất là "Present · visual (not code-ready)". Figma presence: Missing 104, Partial 92, Present · visual 4, Review scope 10.

## 3. Figma Current UI vs bản deploy (1440×1000, Chromium 141)

| Route | Frame Figma (Dark) | h1 Figma | h1 deploy | Mô tả | Điều khiển Figma: exact / tương đương / thiếu | Dark | Light |
|---|---|---|---|---|---|---|---|
| #home | 236:729 | Turn specifications into traceable work | Build with a clear trail. (MISSING) | MISSING | 2 / 0 / 14 của 16 | **FAIL** | **FAIL** |
| #specifications | 236:985 | Specifications | Specifications (EXACT) | MISSING | 4 / 4 / 17 của 25 | **FAIL** | **FAIL** |
| #code | 236:1306 | Code intelligence | Code intelligence (EXACT) | MISSING | 1 / 5 / 9 của 15 | **FAIL** | **FAIL** |
| #collaboration | 236:3496 | Collaboration | Collaboration (EXACT) | MISSING | 2 / 7 / 18 của 27 | **FAIL** | **FAIL** |
| #agents | 236:1608 | Agents | Agents (EXACT) | MISSING | 7 / 7 / 5 của 19 | **FAIL** | **FAIL** |
| #resources | 236:1866 | Resource registry | Resources (MISSING) | MISSING | 1 / 5 / 11 của 17 | **FAIL** | **FAIL** |
| #workflow | 236:2121 | Workflow definitions & plans | Workflow (MISSING) | MISSING | 0 / 3 / 12 của 15 | **FAIL** | **FAIL** |
| #memory | 236:2967 | Memory & context | Memory (MISSING) | MISSING | 2 / 7 / 11 của 20 | **FAIL** | **FAIL** |
| #execution | 236:2375 | Runs & agent activity | Execution (MISSING) | MISSING | 5 / 7 / 21 của 33 | **FAIL** | **FAIL** |
| #governance | 236:2674 | Reviews & delivery | Delivery & acceptance (MISSING) | MISSING | 5 / 7 / 21 của 33 | **FAIL** | **FAIL** |
| #gateway | 236:3226 | AI access & budget | AI gateway (MISSING) | MISSING | 5 / 7 / 17 của 29 | **FAIL** | **FAIL** |
| #configuration | 236:3752 | Configuration & policy | Configuration (MISSING) | MISSING | 1 / 4 / 14 của 19 | **FAIL** | **FAIL** |
| #identity | 236:4007 | People & access | Identity & access (MISSING) | MISSING | 2 / 6 / 18 của 26 | **FAIL** | **FAIL** |
| #tenancy | 236:4258 | Organization & projects | Organization & projects (EXACT) | MISSING | 3 / 8 / 14 của 25 | **FAIL** | **FAIL** |
| #saas | 236:4512 | Usage, billing & data | Usage & billing (MISSING) | MISSING | 2 / 8 / 18 của 28 | **FAIL** | **FAIL** |
| #desktop | 236:4776 | Desktop & local runtime | Desktop companion (MISSING) | MISSING | 4 / 4 / 21 của 29 | **FAIL** | **FAIL** |
| #observer | 236:5048 | Operations observer | Observer (MISSING) | MISSING | 1 / 5 / 22 của 28 | **FAIL** | **FAIL** |
| #connection | 236:5309 | Connection & operation receipts | Connection & operations (MISSING) | MISSING | 3 / 4 / 10 của 17 | **FAIL** | **FAIL** |

Điều hướng: Figma BUILD / KNOWLEDGE & SERVICES / ADMINISTRATION, bản deploy 7/21 exact; order different; deployed groups: WORKSPACE / OPERATIONS; mismatches: BUILD→missing; Workflow & planning→Workflow; Runs & activity→Execution; Reviews & delivery→Delivery & acceptance; KNOWLEDGE & SERVICES→missing; Memory & context→Memory; AI access & budget→AI gateway; Configuration & policy→Configuration; ADMINISTRATION→missing; People & access→Identity & access; Usage, billing & data. Ảnh chụp: `evidence/runs/R4-001-figma/figma_parity/{dark,light}/*.jpg` (70). Không so pixel được (sandbox không tải được ảnh render Figma); phần nội dung minh hoạ trong frame ("Design example") bị loại khỏi oracle.

## 4. Field contract 49 definition type (oracle = frame "unified fields")

| Type | Route | Figma field | Tới được | Tạo | Số field + section | Field contract |
|---|---|---|---|---|---|---|
| Agent definition | #agents | 35 | PASS | **PASS** | PASS | PASS |
| Model resource | #resources | 29 | PASS | **PASS** | PASS | PASS |
| MCP server | #resources | 29 | PASS | **PASS** | PASS | PASS |
| Tool contract | #resources | 22 | PASS | **PASS** | PASS | PASS |
| Sandbox template | #resources | 29 | PASS | **PASS** | PASS | PASS |
| Agent skill | #resources | 17 | PASS | **PASS** | PASS | PASS |
| Agent rule | #resources | 14 | PASS | **PASS** | PASS | PASS |
| Agent plugin | #resources | 17 | PASS | **PASS** | PASS | PASS |
| Lifecycle hook | #resources | 15 | PASS | **PASS** | PASS | PASS |
| Runtime sidecar | #resources | 19 | PASS | **PASS** | PASS | PASS |
| Memory record | #memory | 23 | PASS | **PASS** | PASS | PASS |
| Memory retrieval policy | #memory | 16 | PASS | **PASS** | PASS | PASS |
| Context package request | #memory | 15 | PASS | **PASS** | PASS | PASS |
| Repository connection | #code | 20 | PASS | **PASS** | PASS | PASS |
| Code index policy | #code | 20 | PASS | **PASS** | PASS | PASS |
| Source query | #code | 15 | PASS | **PASS** | PASS | PASS |
| Document properties | #specifications | 16 | PASS | **PASS** | PASS | PASS |
| Specification submission request | #specifications | 15 | PASS | **PASS** | PASS | PASS |
| Provider credential request | #gateway | 15 | PASS | **PASS** | PASS | PASS |
| Model routing policy | #gateway | 17 | PASS | **PASS** | PASS | PASS |
| Budget and reservation policy | #gateway | 15 | PASS | **PASS** | PASS | PASS |
| Workflow definition policy | #workflow | 19 | PASS | **PASS** | PASS | PASS |
| Task execution contract | #workflow | 24 | PASS | **PASS** | PASS | PASS |
| Run admission request | #execution | 15 | PASS | **PASS** | PASS | PASS |
| Human checkpoint decision | #execution | 14 | PASS | **PASS** | PASS | PASS |
| Retry / resume request | #execution | 15 | PASS | **FAIL** | PASS | BLOCKED |
| Cancel and cleanup request | #execution | 15 | PASS | **PASS** | PASS | PASS |
| Delivery review | #governance | 16 | PASS | **PASS** | PASS | PASS |
| Pull request and merge request | #governance | 16 | PASS | **PASS** | PASS | PASS |
| Post-merge acceptance | #governance | 17 | PASS | **PASS** | PASS | PASS |
| Membership invitation | #identity | 12 | PASS | **PASS** | PASS | PASS |
| Role and grant policy | #identity | 15 | PASS | **PASS** | PASS | PASS |
| Access revocation request | #identity | 13 | PASS | **PASS** | PASS | PASS |
| Organization | #tenancy | 15 | PASS | **PASS** | PASS | PASS |
| Workspace | #tenancy | 14 | PASS | **PASS** | PASS | PASS |
| Project onboarding | #tenancy | 18 | PASS | **PASS** | PASS | PASS |
| Archive / transfer / deletion request | #tenancy | 14 | PASS | **FAIL** | PASS | BLOCKED |
| Scoped configuration override | #configuration | 15 | PASS | **PASS** | PASS | PASS |
| Runtime capability policy | #configuration | 16 | PASS | **PASS** | PASS | PASS |
| Anchored discussion | #collaboration | 15 | PASS | **PASS** | PASS | PASS |
| Durable collaboration cut request | #collaboration | 13 | PASS | **PASS** | PASS | PASS |
| Subscription and seats request | #saas | 14 | PASS | **PASS** | PASS | PASS |
| Billing reconciliation request | #saas | 14 | PASS | **PASS** | PASS | PASS |
| Data export / erasure request | #saas | 14 | PASS | **FAIL** | PASS | BLOCKED |
| Desktop device binding | #desktop | 17 | PASS | **PASS** | PASS | PASS |
| Companion update request | #desktop | 15 | PASS | **PASS** | PASS | PASS |
| Telemetry query | #observer | 19 | PASS | **PASS** | PASS | PASS |
| Diagnostic export request | #observer | 17 | PASS | **PASS** | PASS | PASS |
| Incident and operations handoff | #connection | 18 | PASS | **PASS** | PASS | PASS |

## 5. Journey (Figma traceability: 42 journey / 174 bước)

Mỗi bước: phần frontend quan sát được kiểm bằng case hiện có; phần ORACLE cần receipt của service thật ⇒ BLOCKED_BACKEND. Chi tiết 174 dòng: `Atlas-Frontend-Journey-Results.csv`.

| Kết quả | Số bước | Ví dụ |
|---|---|---|
| PASS | 1 | UXJ-28-S03 Verify mock boundary and authority after recovery — FE-scope oracle fully observable on the client |
| FAIL | 9 | UXJ-18-S02 Kill/restart and select verified compatible snapshot — Authoring request "run-recovery" for this step cannot be created (FND-004, DEF-CREATE-run-; UXJ-18-S03 Retry/resume under current source/policy/grants — Authoring request "run-recovery" for this step cannot be created (FND-004, DEF-CREATE-run-; UXJ-27-S02 Archive/transfer with accepted target and retention — Authoring request "scope-lifecycle" for this step cannot be created (FND-004, DEF-CREATE-s; UXJ-27-S03 Export/delete only eligible scoped objects — Authoring request "data-lifecycle" for this step cannot be created (FND-004, DEF-CREATE-da |
| NOT_RUN | 4 | UXJ-06-S01 Create/edit Markdown source and preview — FE scope "Local Markdown edit + preview + generated outline (Monaco; trusted typing requir; UXJ-14-S02 Configure typed nodes/dependencies/agents — FE scope "Local DAG validation with actionable node/field errors (local, no service)" not ; UXJ-40-S01 Navigate tree and expand/select without pointer — FE scope evidence not applicable/run: {'FE03-KBD-TREE': 'NOT_APPLICABLE', 'FE03-KBD-TREE-F; UXJ-40-S02 Move using pointer/menu/keyboard alternative — FE scope "Keyboard/menu alternative to drag move" not yet scripted (needs seeded local dat |
| BLOCKED | 160 | UXJ-01-S01 Sign in and confirm account — BLOCKED_BACKEND: the ORACLE requires an authorized service receipt (atlas-ui/v1 proposed, ; UXJ-01-S02 Create org/workspace/project — BLOCKED_BACKEND: the ORACLE requires an authorized service receipt (atlas-ui/v1 proposed, ; UXJ-01-S03 Open readiness and configure real dependencies — BLOCKED_BACKEND: the ORACLE requires an authorized service receipt (atlas-ui/v1 proposed, ; UXJ-01-S04 Open project library/repo from stable route — FE scope PASS (CF-PRE-008, FE01-ROUTE-001, FE01-ROUTE-002, FE01-ROUTE-003, FE04-XENGINE-RO |

Figma cũng có 14 journey DESIGN_V8 (J01–J14) và 8 journey xuyên suốt (X01–X08) ở page 07, khác namespace với UXJ-01…42; Figma ghi tất cả "Prototype NOT_VERIFIED · UAT NOT_RUN". Decision register: 28 quyết định (D01–D14, UXD-01–14) + EX-LOCK-03 + OBSERVER_READ_ONLY + API TBD đều "Proposed not approved" — liên quan FND-006, FND-012, BE-01.

## 6. Test denominator

| Total | PASS | FAIL | NOT_RUN | BLOCKED | NOT_APPLICABLE | Exclusions |
|---|---|---|---|---|---|---|
| 378 | 275 | 76 | 17 | 5 | 5 | 0 |

Mỗi biến thể engine/theme là một case riêng; case tổng hợp (FIGMA-001, DEF-FIGMA-001, FE01-210-001, FE06-UXJ-042, FE02-AUTO-216, FE03-KBD-001, FX-SERVICE-001, PERF-007, PERF-INP-001, FE04-XENGINE-001) được tính thêm. Không dùng % để bù gate.

## 7. Findings

| ID | Sev | Gate | Tiêu đề | Trạng thái | Retest |
|---|---|---|---|---|---|
| FND-001 | P2 | FE-03 | Tabs không liên kết tabpanel (thiếu aria-controls → role=tabpanel) — tái hiện trên 3 engine | OPEN (retested run 3: reproduces) | FE03-KBD-TABS,FE03-KBD-TABS-FIREFOX,FE03-KBD-TABS-WEBKIT |
| FND-002 | P2 | FE-04 | Không có CSP và các security header trên document/asset | OPEN (reproduced in run 2) | CF-PRE-005 |
| FND-003 | P2 | FE-05 | Asset có hash trong tên vẫn bị revalidate mỗi lần (max-age=0) | OPEN (reproduced in run 2) | CF-PRE-006 |
| FND-004 | P1 | FE-01 | 3/49 definition type không tạo được: tên mặc định "<tiêu đề> <uuid>" chứa "/" bị chính validator tên của app từ chối | OPEN (retested run 4: reproduces on 3 engines) | DEF-CREATE-run-recovery,DEF-CREATE-scope-lifecycle,DEF-CREATE-data-lifecycle (+ -FIREFOX/-WEBKIT) |
| FND-005 | P2 | FE-06 | Toast thành công cũ vẫn hiển thị sau khi 401 / hết phiên làm UI ngắt kết nối | OPEN (retested run 3: still reproduces on remote) | FX-SERVICE-FND-005,FX-SVC-EXPIRY |
| FND-006 | P3 | FE-06 | Quyết định 4xx definitive hay Unknown (FX-EXEC-001 / FX-CMD-004) — kế thừa run 1 | OPEN (SPEC_UNRESOLVED; behaviour observed in run 3) | FX-EXEC-001,FX-SVC-HTTP409,FX-SVC-HTTP422 |
| FND-007 | P3 | see run 1 | P3 finding from run 1 | OPEN (inherited, not retested) | see run-1 retest_case_ids |
| FND-008 | P3 | see run 1 | P3 finding from run 1 | OPEN (inherited, not retested) | see run-1 retest_case_ids |
| FND-009 | P3 | see run 1 | P3 finding from run 1 | OPEN (inherited, not retested) | see run-1 retest_case_ids |
| FND-010 | P3 | see run 1 | P3 finding from run 1 | OPEN (inherited, not retested) | see run-1 retest_case_ids |
| FND-011 | P2 | FE-03 | Scrollable table region not keyboard focusable | OPEN (inherited, not retested) | FE03-KBD-001 |
| FND-012 | P1 | FE-01 | 0/210 view COMPLETE; 81/210 view chưa kiểm được (UNVERIFIED) vì cần service/fixture hoặc thuộc review-scope của Figma | OPEN (re-evaluated run 4 against the Figma inventory; run-1 "7 NOT_IMPLEMENTED" not reproduced as provable absence) | FE01-210-001 |
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
| FND-023 | P2 | FE-01 | Điều hướng (IA) khác Figma: nhóm WORKSPACE / OPERATIONS thay vì BUILD / KNOWLEDGE & SERVICES / ADMINISTRATION; 11/18 nhãn khác; thứ tự khác | OPEN (new in run 4) | FIGMA-PARITY-NAV |
| FND-024 | P2 | FE-01 | Tiêu đề trang khác Figma ở 13/18 route; câu mô tả (purpose) khác ở 18/18 route | OPEN (new in run 4) | FIGMA-PARITY-<ROUTE>-DARK/LIGHT |
| FND-025 | P2 | FE-01 | Bố cục/điều khiển module khác Figma: 273/421 điều khiển cấu trúc trong frame Figma không có trên bản deploy | OPEN (new in run 4) | FIGMA-PARITY-<ROUTE>-DARK/LIGHT |

**Top P0/P1**: không có P0. P1: FND-004 (xác nhận lại run 4 trên 3 engine — 3 type có "/" trong tiêu đề không tạo được, chặn 7 bước journey và 9 view); FND-012 (0/210 COMPLETE, 81 UNVERIFIED). P2 mới ở run 4: FND-023/024/025 (lệch thiết kế Figma).

## 8. Specifications / Code Intelligence / Agent Lifecycle

| Mảng | Đã chứng minh | Thiếu / chưa kiểm |
|---|---|---|
| Specifications | Route + deep link 3 engine; Document properties & Specification submission request: tạo được, field contract khớp Figma; tablist "Document inspector" theo APG | Tiêu đề/mô tả/điều khiển khác Figma (FND-024/025); FND-001/FND-021; Monaco, import, history/diff (UNVERIFIED) chưa script |
| Code intelligence | Route; Repository connection, Code index policy, Source query khớp Figma | FND-025 (thiếu "Import folder", "Analyze JS/TS", "Symbols & quality"…); F12/worker chưa script |
| Agent / resource / service modules | 49/49 type tới được; 46 type tạo + khớp field; FX-SERVICE: 1 POST/double-click, stage đúng, Unknown "do not resend", 401 ⇒ disconnect | FND-004 (Retry / resume, Archive / transfer / deletion, Data export / erasure); FND-005; bố cục service records khác Figma (FND-025) |

## 9. Môi trường thực tế

| Lượt | Thời gian (UTC) | Môi trường | Phạm vi | Ghi chú |
|---|---|---|---|---|
| R2-001…004 | 2026-10-05 06:58–07:27Z | Cloudflare Browser Rendering (headless Chromium, UA Chrome/119), synthetic-DOM | Phase 0b metadata, hash 120 payload, header/MIME/cache, discovery, deep link/reload/history, FE02 320–1440 | Hết quota Free 10 phút/ngày lúc 07:27Z |
| R3-001 (run 37280321117) | 07:54–08:05Z | GitHub Actions, Playwright 1.56.1: Chromium 141 / Firefox 142 / WebKit 26 | mirror, discovery, axe dark/light, FE02 1920 + Firefox/WebKit 320/1920 | Bị huỷ; bước commit vẫn chạy và đẩy bản mirror plaintext (đã gỡ khỏi cây ở 41948df). Deeplink script cũ treo (lỗi harness) |
| run 37281392041 | 08:05–08:23Z | như trên | keyboard/perf/screenshots | Kết quả mất do xung đột commit (đã sửa workflow); chạy lại ở R3-003 |
| R3-002 (run 37282601201) | 08:24–08:29Z | như trên | mirror (redirect fixed), deeplink 3 engine, FE02 Firefox/WebKit 375/768/1440, FX-SERVICE 14 kịch bản, layout hit-test | OK |
| R3-003 (run 37284006443) | 08:30–08:35Z | như trên, trusted input + CDP | keyboard 3 engine, perf (cold/warm/mobile, INP, heap), 72 screenshots | Keyboard: 4 lỗi harness (đã sửa, không tính FAIL) |
| R3-004 (run 37285038578) | 08:40–08:42Z | như trên | keyboard 3 engine (harness đã sửa), INP ≥30 tương tác, heap 30/60/90 chu kỳ | OK |
| Figma read (run 4) | 09:00–09:55Z | Figma MCP use_figma (Plugin API, chỉ đọc) | 10 page; Planned inventory 210; 18+18 frame module; 49 frame unified fields (852 field); journey register, decision register, traceability 174 bước | Sửa kết luận sai "chỉ có 2 page" của run 2–3 |
| R4-001 (run 37289868204) | 09:25–09:28Z | GitHub Actions, Chromium 141, click thật | Figma parity 18 route × dark/light (+70 ảnh); definitions 49 type | Definitions: 2 lỗi harness (view lazy-load chưa đợi; khoảng trắng nhãn section) — kết quả definitions bị thay bằng R4-002, không tính FAIL |
| R4-002 (run 37290670654) | 09:33–09:36Z | GitHub Actions, Chromium 141 + Firefox 142 + WebKit 26 | definitions 49 type (harness đã sửa) + FND-004 trên Firefox/WebKit | OK |

- AT thật: không có (FE03-AT-001, UXJ-40-S05). Thiết bị thật: không có. Browser pane: không có. figma.com bị proxy chặn ⇒ không tải ảnh render Figma.

## 10. Backend boundary

Xem `Atlas-Frontend-Backend-Dependencies.md`. DTO `atlas-ui/v1` vẫn "proposed" (Figma decision register: "API TBD — 49 authoring schemas AUTHORING_PROPOSAL"); 160/174 bước journey BLOCKED_BACKEND.

## 11. Deliverables

- Atlas-Frontend-Acceptance-Report.md / .html
- Atlas-Frontend-Acceptance-Manifest.json
- Atlas-Frontend-Screen-Coverage.csv (210 hàng, theo Figma)
- Atlas-Frontend-Route-Coverage.csv (18 route)
- Atlas-Frontend-Test-Results.csv
- Atlas-Frontend-Findings.csv
- Atlas-Frontend-Journey-Results.csv (174 bước)
- Atlas-Frontend-UAT-Classification.csv (header — Figma không chứa dòng UAT)
- Atlas-Frontend-Accessibility.md
- Atlas-Frontend-Performance.json / .md
- Atlas-Frontend-Backend-Dependencies.md
- Atlas-Frontend-Remediation-Plan.md
- Atlas-Frontend-Cloudflare-Deployment.md
- evidence/figma/ (inventory 210, frame map, field oracle 49, journey trace 174, page list + đính chính)
- evidence/runs R2-*, R3-*, R4-* (+ 70 ảnh parity, 49 ảnh definitions) + evidence-index.json
- work/ (ledgers + scripts: figma_data.py, figma_journeys.py, record_r2/3/4.py, coverage.py, build.py)
- harness/ (Playwright suites figma_parity.mjs, definitions.mjs, …)

## 12. Exact remaining cases

| Case | Gate | Kết quả | Expected | Evidence | Lý do / cách nghiệm thu tiếp |
|---|---|---|---|---|---|
| A11Y-AXE-002 | FE-03 | NOT_RUN | 0 violations | — | Remaining scope: connected service state and open dialogs (needs axe inside the fxservice suite). |
| CODE-008 | FE-04 | NOT_RUN | navigates to oracle locations | — | Trusted input, Firefox/WebKit and CDP are now available via GitHub Actions (run 3); scenario not yet scripted: needs a seeded source snapshot (Import source folder) with an AST oracle |
| DEF-FIELDS-data-lifecycle | FE-01 | BLOCKED | 14 Figma fields, all attributes identical, no extra keys | EV-DEF-701,EV-DEF-702,EV-FIG-706 | BLOCKED_BY_FND-004: editor did not open |
| DEF-FIELDS-run-recovery | FE-01 | BLOCKED | 15 Figma fields, all attributes identical, no extra keys | EV-DEF-701,EV-DEF-702,EV-FIG-706 | BLOCKED_BY_FND-004: editor did not open |
| DEF-FIELDS-scope-lifecycle | FE-01 | BLOCKED | 14 Figma fields, all attributes identical, no extra keys | EV-DEF-701,EV-DEF-702,EV-FIG-706 | BLOCKED_BY_FND-004: editor did not open |
| FE02-COARSE-001 | FE-02 | NOT_RUN | no loss of essential actions | — | Trusted input, Firefox/WebKit and CDP are now available via GitHub Actions (run 3); not yet scripted |
| FE02-STATE-001 | FE-02 | NOT_RUN | no overflow/clipping | — | Trusted input, Firefox/WebKit and CDP are now available via GitHub Actions (run 3); not yet scripted (states via FX-SERVICE fixture + seeded data) |
| FE02-WALK-001 | FE-02 | NOT_RUN | 72 screenshots captured after correct render (h1 matched); visual review vs Figma pending | EV-SHOT-601 | Run 4: 70 deployed screenshots at 1440x1000 dark/light captured next to the Figma Current UI comparison (FIGMA-001); pixel diff vs Figma renders not possible (figma.com unreachable from the sandbox). |
| FE02-ZOOM-001 | FE-02 | NOT_RUN | no loss of content/function | — | Trusted input, Firefox/WebKit and CDP are now available via GitHub Actions (run 3); not yet scripted (Playwright deviceScaleFactor/CSS zoom; real browser zoom still needs a desktop browser) |
| FE03-AT-001 | FE-03 | NOT_RUN | Name/role/state/announcements correct | — | NOT_RUN_AT: no screen reader / real device available in this cloud session |
| FE03-MOTION-001 | FE-03 | NOT_RUN | no loss of content/function | — | Trusted input, Firefox/WebKit and CDP are now available via GitHub Actions (run 3); not yet scripted (Playwright emulateMedia reducedMotion/forcedColors) |
| FE04-IDB-001 | FE-04 | NOT_RUN | graceful recovery, no data loss | — | Trusted input, Firefox/WebKit and CDP are now available via GitHub Actions (run 3); scenario not yet scripted (isolated-profile quota/denied/malformed/migration cases) |
| FE04-TAB-001 | FE-04 | NOT_RUN | conflict surfaced, no silent overwrite | — | Trusted input, Firefox/WebKit and CDP are now available via GitHub Actions (run 3); scenario not yet scripted (two contexts on one profile now possible in Playwright) |
| FE04-WORKER-001 | FE-04 | NOT_RUN | workers start, respond, terminate; served as JS; allowed by CSP | — | Trusted input, Firefox/WebKit and CDP are now available via GitHub Actions (run 3); scenario not yet scripted: needs an opened document/source file to start the 6 Monaco workers |
| FE04-XENGINE-HISTORY-FIREFOX | FE-04 | NOT_RUN | #specifications → #home → #specifications | EV-XE-615 | Inconclusive: iframe history.back() in Gecko walks the joint session history differently (second back did not reach #home); needs a top-level page.goBack() check — not attributed to the app. |
| FE06-UAT-307 | FE-06 | BLOCKED | classified | — | BLOCKED_INPUT: Figma states "113 original UAT remain NOT_RUN" and "UAT NOT_RUN" but contains no UAT rows (IDs/Given-When-Then); Atlas-Original-UAT-113.csv and Atlas-UX-UAT-194.csv still not supplied. Journey-level acceptance now runs from the Figma traceabilit |
| FX-BRANCH-001 | FE-06 | NOT_RUN | per v2 §9 P-B FE-06 | — | Trusted input, Firefox/WebKit and CDP are now available via GitHub Actions (run 3); partly covered by FX-SVC-EXPIRY/OBSERVER/HTTP409; remaining: revoked mid-flow, stale revision on GET, offline/reconnect, role projection, reverse-order, retry/resume/cancel rac |
| FX-EXEC-001 | FE-06 | BLOCKED | per DTO | — | SPEC_UNRESOLVED: atlas-ui/v1 DTO not approved (Connection page itself states "Service adapter contract is proposed") |
| PERF-006 | FE-05 | NOT_RUN | within locked budget | — | Trusted input, Firefox/WebKit and CDP are now available via GitHub Actions (run 3); not yet scripted (needs import fixtures of growing size) |
| PERF-009 | FE-05 | NOT_RUN | within budget | — | Trusted input, Firefox/WebKit and CDP are now available via GitHub Actions (run 3); not yet scripted (needs 1k/10k/100k-line files opened in Monaco) |
| PERF-WORKLOAD-001 | FE-05 | NOT_RUN | within budget + cleanup | — | Trusted input, Firefox/WebKit and CDP are now available via GitHub Actions (run 3); not yet scripted (synthetic workloads) |
| SPEC-RETEST-001 | FE-04 | NOT_RUN | oracle SHA-256 equal | — | Trusted input, Firefox/WebKit and CDP are now available via GitHub Actions (run 3); scenario not yet scripted: needs seeded documents and the SHA-256/AST oracles of run 1 |

## 13. Giới hạn và sự cố

- Không có source ⇒ không có COMPLETE; local/remote equivalence UNVERIFIED (chỉ chứng minh remote == manifest).
- Figma parity đo trên text/cấu trúc (tiêu đề, mô tả, IA, điều khiển, field contract); không so pixel. Nội dung minh hoạ trong frame bị loại.
- Registry schema đọc tĩnh từ bundle đã deploy (hash khớp manifest) chỉ dùng để nối view ↔ form; mọi kết luận PASS/FAIL đến từ chạy runtime.
- Harness có lỗi ở một số lượt (deeplink cũ, hash runner, 4 kiểm tra bàn phím R3-003, 2 lỗi definitions R4-001); tất cả đã sửa và chạy lại, kết quả lỗi harness không tính FAIL.
- Sự cố: run CI bị huỷ đã commit bản mirror plaintext của payload công khai; đã gỡ khỏi cây (41948df) nhưng còn trong lịch sử git (chờ chủ repo quyết định force-push).
- Đính chính: kết luận "Figma chỉ có 2 page" của run 2–3 là sai và đã được thay ở run 4.

_Generated 2026-10-05T10:05Z từ work/tests.json + work/findings.json + work/journeys-r4.json bằng work/build.py._
