# Master plan bàn giao: hoàn thiện frontend Atlas web

Văn bản này dùng độc lập: dán nguyên vào phiên agent mới.

## 1. Vai trò, mục tiêu, thứ tự

Bạn tiếp quản frontend Atlas trong `frontend/atlas-web`, repo `ldqanh1408/hehe`, nhánh `claude/sharp-thompson-5tff91`.

**Mục tiêu:** đưa frontend lên mức production-grade, bám sát Figma.

**Thứ tự bắt buộc:**
1. Hỏi người dùng các quyết định kiến trúc ở mục 10.1 (một lần, gom chung một câu hỏi).
2. Làm xong phần UI/UX còn lại: mục 4, cộng thêm mục 10 (bám Tech stack ADR + SRS v1.1) và mục 11 (UI-11: màn hình thực thi multi-agent refactor từ Archive).
3. Sau đó mới làm test và cổng chất lượng (mục 5).

**Hai tài liệu chuẩn bổ sung** do người dùng cung cấp: "Atlas — Tech Stack & ADR" (2026-10-01) và "SRS v1.1". Khi Figma, ADR và SRS mâu thuẫn:
- **SRS** quyết định nghiệp vụ: trạng thái, quyền, ngưỡng, luồng.
- **ADR** quyết định công nghệ.
- **Figma** quyết định hình thức.

Mọi lệch còn lại phải ghi vào báo cáo.

**Không deploy** lên staging hay production, và không gọi API ghi của Cloudflare.

## 2. Ràng buộc (giữ nguyên từ master prompt gốc)

**Git**
- Chỉ commit và push lên `claude/sharp-thompson-5tff91`. Người dùng đã xác nhận nhánh này.
- Không tạo PR nếu người dùng không yêu cầu.
- Không force-push, không viết lại lịch sử, không tạo commit rỗng.
- Mỗi hạng mục là một commit nhỏ, kết thúc bằng dòng attribution do hệ thống của phiên bạn cung cấp.
- Không ghi tên hay ID model vào commit, mã nguồn hoặc tài liệu.

**Nguồn thiết kế**
- Figma file `0md9BEFI1rU0aRAvf98TWO`. Trước khi gọi `get_design_context`, đọc `skill://figma/figma-design-to-code/SKILL.md`.
- URL asset của figma.com bị chặn từ sandbox, nên `curl` sẽ trả về 000. Dùng `get_screenshot` với `enableBase64Response: true`. Ảnh được lưu dưới `/root/.claude/projects/.../tool-results/*.png`; copy ra scratchpad để so sánh.
- Bản sao dữ liệu thiết kế nằm trong `design-source/`. Node id của module, state và definition state nằm trong `design-source/current-ui-frames.json`.

**Dữ liệu và hành vi**
- Production không có dữ liệu mẫu hay success handler giả. Chữ mẫu chỉ xuất hiện trong `vite build --mode review` (`__ATLAS_REVIEW__`), gắn nhãn "Illustrative". Production hiển thị cấu trúc kèm "Not observed".
- Hành động cần service luôn hiển thị nhưng bị khoá. Lý do khoá phải hiện ngay cạnh hành động, không chỉ hiện khi rê chuột:
  - dùng `Button blocked=…`;
  - nếu một lý do áp dụng cho nhiều nút, đặt `reasonId` trỏ tới một `<p id>` chung.
- Quyền chỉ lấy từ grant của session (`capability()` / `actionGate()`), không bao giờ suy ra từ tên vai trò.

**Quyết định của người dùng**
- UI-9: giữ tên trường theo **Field Dictionary**. Vì vậy parity Figma tối đa là 451/457, và 6 nhãn lệch là có chủ đích:
  - Memory: Source revision / snapshot, Knowledge type, Source digest;
  - Configuration: Proposed scope, Policy JSON, Rollback proposal.
  - Resources: "Endpoint / artifact reference" cũng là một nhãn lệch, cũng giữ theo Field Dictionary.
  - Ghi các lý do này vào báo cáo.

**Báo cáo**
- Báo cáo cho người dùng bằng tiếng Việt, ngắn gọn, có bằng chứng (ảnh, số test, link CI).
- Không tuyên bố "production-ready" khi chưa có bằng chứng.

**Môi trường**
- Không chạy `pkill -f "vite preview"`, vì lệnh này giết luôn shell. Dùng `fuser -k 4173/tcp`.
- Sandbox không truy cập được `*.workers.dev`.
- Không được bọc `sleep` dài; chạy lệnh dài bằng background.

## 3. Trạng thái hiện tại (đã kiểm chứng trước khi bàn giao)

**Commit đã push**
- `27d3fdf`: siết bộ lọc chữ mẫu cho production.
  - Regex `SAMPLE` trong `tools/import-design.mjs` bắt thêm: rev/revision N, số đếm, kích thước, %, tên persona, email, id dạng `fld-…`.
  - Thêm `prodState` và `rows[].prodLabel` vào dữ liệu sinh ra và `src/data/types.ts`.
  - Đã kiểm 5.266 chuỗi production: không còn chuỗi nào lọt mẫu.
- `392214b`: Figma parity đợt 1, gồm:
  - Typography: thêm token `--text-control` 12/18. Nav link, nút, tab, chip và mô tả trang dùng caption 12 px. Nút secondary không viền. Tree row và tab cao 36 px. Bỏ eyebrow trên heading module. Panel head không có đường kẻ.
  - Overview: 4 thẻ số liệu, cột journey (7fr) cạnh cột readiness (5fr) gồm thẻ readiness và nút "Open".
  - Trang module dịch vụ (`ServiceModulePage`), theo frame:
    - cột trái: bảng có header luôn hiện, dải Lifecycle nền raised, "Continue the journey" dạng nút;
    - cột phải: "Select a resource", hàng nút bị khoá (Cancel/Reject… dùng kiểu danger), tab với empty "Inspect before acting", Operation receipts.
  - Connection: badge Disconnected màu warning; nút "Connect"; định nghĩa Received/Accepted · Effective · Unknown; empty "No authenticated session"; bỏ banner warning, thay bằng ProvenanceBanner.
  - **UI-5 xong.** Code intelligence luôn hiển thị 3 cột: Search source ở cột trái; Symbols & quality, Coverage boundary, Analyze JS/TS, Export source manifest ở cột phải; Definition/References/History/Add to context/Edit workspace trên thanh file. Parity code đạt 17/17.
  - **UI-6 xong một phần.** Đã có `Skeleton`/`PageSkeleton` (Spinner giờ là alias của Skeleton). Toast tối đa 3, thời gian 5/8/10 s, tạm dừng khi rê chuột hoặc focus.

**Chất lượng tại `392214b`**

| Hạng mục | Kết quả |
|---|---|
| typecheck | sạch |
| Vitest | 25/25 |
| Playwright | 304 đạt, 3 skip, 0 lỗi (local, chromium) |
| Figma parity | 451/457 |

- CI trên commit mới chưa được kiểm. Bước đầu tiên của bạn là kiểm CI (mục 6).

**Test đã đổi có chủ đích**
- `e2e/ides.spec.ts`: dùng nhãn "Search source", thêm bước References.
- `e2e/service.spec.ts`: nút "Connect".

**Ảnh before/after**
- Ảnh "before" của 18 module nằm ở scratchpad phiên cũ và sẽ mất.
- Chụp lại "before" từ commit `8beed67` bằng `git worktree` nếu cần ảnh so sánh.

## 4. Việc UI/UX còn lại

**Cách làm chung cho mỗi hạng mục:**
1. Chụp Figma bằng `get_screenshot` base64.
2. Chụp app ở 1440×1000, cả Dark lẫn Light (script ở mục 7).
3. So sánh rồi sửa.
4. Chỉ dùng token và primitive sẵn có.
5. Commit nhỏ.

### UI-3: template riêng cho từng loại scene (việc lớn nhất; đang dở)

**Phát hiện quan trọng**
- `scene.figma` rỗng cho cả 751 scene, nên importer không có node id.
- Frame của scene chỉ tồn tại cho J01/J02, nằm ở trang "05 · Gap closure · Dark" (`359:592`) và "06 · … Light" (`359:593`), với tên dạng `GAP/J01/<key> · Dark`. Có 81 frame ở trang Dark.
- `get_metadata` trên trang này trả về khoảng 6 MB. Lọc các dòng `^  <frame id=… name=…>` bằng Python.
- Với các kind khác, thiết kế template từ component trong "03 · Design system" và frame Current UI gần nhất.

**Điểm dừng**
- Đã thêm `prodState` và `rows[].prodLabel` vào type.
- `SceneRenderer.tsx` **chưa** dùng hai trường này: dòng 46, 101, 183 và 237 vẫn hiển thị `scene.state`, RowsList hiển thị `r.label`.
- Việc đầu tiên: production dùng `prodState` và `prodLabel`; review build dùng `state` và `label`.

**Kế hoạch**
1. Tách phần dùng chung từ `SceneRenderer.tsx` sang `src/views/scene/parts.tsx`: `sceneText` (kèm state), `FieldFacts`, `RowsList`, `Inspector`, `InspectorSection`, panel receipt, tab Evidence/Activity.
2. Tạo template trong `src/views/scene/`, theo thứ tự ưu tiên:

| Thứ tự | File | Kind (số scene) | Bố cục |
|---|---|---|---|
| 1 | `IdeScene.tsx` | ide (176) | Lưới `.ide` 3 cột: Explorer (review: pins dạng đường dẫn; prod: "Not observed — tree comes from the service"); editor (thanh tab = prodEntity + badge state, toolbar = ActionBar, vùng editor có gutter; prod để trống kèm Not observed); receipt/fields bên dưới; Inspector bên phải |
| 2 | `ReviewScene.tsx` | review (221) | Panel tóm tắt quyết định (state, entity, copy); facts; bảng records; selectedTask; tab Evidence/Activity; Inspector |
| 3 | `TableScene.tsx` | table (21) | `<table>` thật: Item / Detail / Status / Open. Prod: dòng không phải mẫu dùng `prodLabel` kèm ô "Not observed"; dòng mẫu thay bằng một dòng "No authorized records loaded" |
| 4 | `StatePatternScene.tsx` | statepattern (18) | Thẻ: State, Meaning (copy), Safe next step (primary), Blocked (disabled + lý do), Recovery |
| 5 | `RunScene.tsx` | run (12), observer (7), trace (1) | Run: dải header (State/Task/Attempt/Lease = Observed hoặc Not observed) và timeline các giai đoạn Admission → Lease → Execute → Artifacts → Cleanup. Observer: ô metric. Trace: waterfall có trục; prod "No spans received" |
| 6 | `TerminalScene.tsx` | terminal (2) | Log mono có số dòng; prod "No stream received"; ô nhập bị khoá kèm lý do lấy từ `disabled` |
| 7 | `DiffScene.tsx` | diff, merge (1 + 1) | 2 hoặc 3 pane (Base / Current / Incoming); prod mỗi pane Not observed |
| 8 | `PlanScene.tsx` | plan (2), tasklist (1), workflow (1) | Bảng task: Task / Depends on / Checkpoint / Status |
| 9 | `PaletteScene.tsx` | palette (1) | Ô tìm chỉ đọc, danh sách kết quả, nút mở command palette thật (Ctrl K) |

3. Giữ nguyên `resolveAction` và `ActionBar`: hành động có hiệu lực thật luôn bị khoá khi không có service.
4. Giữ các nhánh receipt, lifecycle, confirm và form/schema hiện có.
5. Chạy `npx playwright test e2e/a11y.spec.ts` (210 view × 2 theme). Phải giữ axe ở 0 vi phạm.

### UI-4: trang tài khoản không có shell (`BareScene` trong `SceneRenderer.tsx`)

- Đối chiếu với frame GAP/J01. Ví dụ ở trang Dark:

| Scene | Node |
|---|---|
| sign-in | `362:3` |
| sign-in-pending | `362:44` |
| sign-in-help | `362:76` |
| invite | `362:109` |
| wrong-account | `362:171` |
| invite-expired | `362:214` |
| invite-requested | `362:251` |
| invite-revoked | `362:283` |
| invite-accepted | `362:314` |
| invite-unknown | `362:346` |

- Bản Light lấy từ trang `359:593`. Lưu bảng map vào `design-source/gap-frames.json` (ghi method/read_at) và cho importer điền `scene.figma`.
- Production không hiển thị ô nhập giả. Nút cần service bị khoá kèm lý do.
- Các route cần làm: `/sign-in`, `/sign-in/help`, `/invitations`, `/observer/sign-in`.

### UI-1: phần còn lại

- So 18 module ở cả 2 theme. Đã soát kỹ: home, specifications, code, agents (có draft), execution, workflow, connection.
- Còn phải xem kỹ: resources, memory, configuration (draft); governance, gateway, collaboration, identity, tenancy, saas, desktop, observer (cùng template dịch vụ, cần kiểm tra tràn chữ và nút danger).
- Lệch đang giữ có chủ đích:
  - Top bar có thêm nút Service status, Preferences và Help (chức năng thật).
  - "Views in this module" và "Lifecycle details" ở cuối trang (truy vết 210 view).
  - Placeholder workbench `min-height: 440px` để giữ CLS.

### UI-2: 18 frame state và 7 frame definition state

- Node id nằm trong `current-ui-frames.json` (`state`, `definition_state`).
- Tái hiện từng trạng thái trong app thật, hoặc bằng scene ở chế độ review, rồi sửa cho khớp.

### UI-6: phần còn lại

- Thống nhất trạng thái error: icon, tiêu đề, bước tiếp theo, nút. Xem `src/views/shared.tsx` (route error / not found) và các Banner danger.
- Đo lại CLS bằng `e2e/perf.spec.ts`.

### UI-7: responsive

- Kích thước cần làm tốt: 320, 390, 768, 1024, 1280, 1440, 1920.
- Specifications và Code dưới 1024 px: cây thư mục và inspector thu vào drawer hoặc tab; editor chiếm toàn bộ chiều rộng.
- Vùng bấm ≥ 44 px khi `pointer: coarse`. Đã có cho `.btn`, `.nav-link`, `.input`, `.chip`, `.tree-row`; kiểm tra thêm `.list-item` và `.tabs-trigger`.
- Không có thanh cuộn ngang.

### UI-8: câu chữ và tương tác

- Nhãn thống nhất với Figma ở mọi nơi có cùng chức năng: Save draft, Validate draft, Connect…
- Kiểm tra: focus trả về đúng chỗ khi đóng dialog, phím tắt, dirty guard, xác nhận cho hành động huỷ hoại.

### UI-10: hiệu năng cảm nhận

- Chunk `codemirror` khoảng 538 KB (186 KB gzip). Chỉ import `CodeEditor` khi mở editor:
  - dùng `lazy()` trong `SpecificationsPage` và `CodePage`;
  - trong `CodePage`, editor chỉ cần khi đã chọn file.
- Prefetch chunk route khi hover hoặc focus vào nav link (`src/shell/Sidebar.tsx`).

**Kết thúc giai đoạn 1**
- Gửi báo cáo tiếng Việt kèm ảnh before/after cho từng module chính, ở cả 2 theme.
- Các test hiện có phải xanh: `npm run typecheck && npx vitest run && npx vite build && npx playwright test`.

## 5. Giai đoạn 2: test và cổng chất lượng (sau khi UI xong)

| Mục | Nội dung |
|---|---|
| T-1 | Thêm project Firefox và WebKit vào `playwright.config.ts`. CI chạy `npx playwright install --with-deps chromium firefox webkit` (chỉ trong CI; local chỉ có chromium ở `/opt/pw-browsers`) |
| T-2 | `toHaveScreenshot` cho 18 module, IDE, workbench, trang tài khoản; 2 theme; 390, 1024 và 1440 px. Ảnh chuẩn lưu trong repo, ngưỡng sai khác hợp lý. Ảnh chuẩn phải sinh trên đúng môi trường CI (Linux) |
| T-3 | Test cho template scene mới. Production: không có chữ mẫu, kiểm bằng regex giống `SAMPLE` trên `innerText` của 210 view. Review build: có nhãn "Illustrative". Hành động có hiệu lực luôn bị khoá |
| T-4 | Unit và component test. `documents.ts`: di chuyển, chống vòng lặp, xoá vĩnh viễn, trùng tên. `sources.ts`: giới hạn import, phát hiện binary. `service.ts`: session hết hạn theo thời gian, link sai origin. `DefinitionForm` và `DraftWorkbench`: chuyển tab khi có lỗi. Toast: tối đa 3, tạm dừng khi rê chuột |
| T-5 | Giữ axe ở 0 vi phạm, kể cả trạng thái tương tác mới. Viết checklist kiểm tra thủ công với NVDA/VoiceOver |
| T-6 | `e2e/perf.spec.ts`: LCP < 2,5 s, CLS < 0,1. Thêm ngưỡng dung lượng JS ban đầu |
| T-7 | `e2e/figma-parity.spec.ts`: mục tiêu ≥ 451/457 theo quyết định UI-9. Có thể đặt ngưỡng theo từng module |
| T-8 | Job verify xanh trên commit cuối. Đọc kết quả qua GitHub MCP. Không chạy job staging |

## 6. Bước đầu tiên khi nhận việc

```bash
cd /home/user/hehe && git fetch origin claude/sharp-thompson-5tff91 && git checkout claude/sharp-thompson-5tff91 && git pull
cd frontend/atlas-web && npm ci && npm run typecheck && npx vitest run && npx vite build
```

- Kiểm CI của `.github/workflows/atlas-web.yml` trên commit đầu nhánh bằng GitHub MCP (`actions_list`, `get_job_logs`). Nếu đỏ, sửa trước khi làm việc khác.
- Remote có thể đã có thêm commit kết quả từ `atlas-acceptance-bot`; pull trước khi làm.

## 7. Lệnh và công cụ

```bash
npm run dev                    # :5173 (không có CSP; dùng để chụp nhanh)
npx vite build && npx vite preview --port 4173 --strictPort   # có CSP thật
npx playwright test            # tự chạy preview :4173
npm run build:review           # bản review có dữ liệu minh hoạ
node tools/import-design.mjs   # tạo lại src/generated từ design-source
```

**Script chụp màn hình**
- Lưu ở scratchpad. Chạy từ thư mục dự án bằng `node --input-type=module - <base> <outdir> /route1 /route2 < shot.mjs` để resolve được `playwright-core`.

```js
import { chromium } from 'playwright-core';
const [,, base, out, ...routes] = process.argv;
const b = await chromium.launch();
for (const theme of ['dark','light']) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: theme });
  const p = await ctx.newPage();
  for (const r of routes) {
    await p.goto(base + r, { waitUntil: 'networkidle' }); await p.waitForTimeout(300);
    await p.screenshot({ path: `${out}/${(r.replace(/[\/?=&]+/g,'_')||'_home')}-${theme}.png` });
  }
  await ctx.close();
}
await b.close();
```

- Để chụp module draft có draft đang mở: click `.page-head` → nút `/^New /`, rồi chờ `#definition-name`.

**Bản đồ mã nguồn**
- Shell: `src/shell/`.
- Primitive: `src/components/ui.tsx` (Button, ButtonLink, Badge, Banner, EmptyState, PageHeader, Panel, Skeleton, PageSkeleton, Stages), `overlays.tsx`, `CodeEditor.tsx`, `Icon.tsx`.
- CSS: `src/styles/tokens.css`, `base.css`, `components.css`. Các block mới nằm ở cuối `components.css`: service-grid, outcome-defs, skeleton, metrics, dashboard, journey.
- Module: `src/views/modules/` (ServiceModulePage, DraftModulePage + DraftWorkbench, ConnectionPage, common.tsx với LifecycleSection, ContinueJourney, `OperationReceipts bare`).
- Scene: `src/views/ViewPage.tsx`, `src/views/scene/SceneRenderer.tsx`, `model.ts`.

## 8. Không được đảo ngược

- `CodeEditor`: editor tự giữ nội dung; `onChange` chạy trong `startTransition`; thay nội dung bằng code thì phải qua `resetKey` (sửa lỗi React #185).
- `ownWrites`: ref trong các editor để không báo "Changed in another tab" với chính lần lưu của mình.
- `Tabs`: id được làm sạch để `aria-controls` hợp lệ.
- Caption trên nền được chọn dùng màu secondary.
- CodeMirror chỉ đọc có `tabindex="0"`.
- Link trong error summary có vùng bấm ≥ 24 px.
- Bộ lọc `SAMPLE` mới trong importer.
- Toast tối đa 3.

## 9. Không được làm

- Deploy hoặc gọi API ghi của Cloudflare; đụng `atlas-web-staging` hay `sparkling-snow-090d`.
- Đưa dữ liệu mẫu hay handler giả vào production; giấu lý do khoá vào tooltip.
- Skip, tắt hoặc nới test để CI xanh.
- Force-push; commit rỗng chỉ để kích CI.
- Đưa secret, token hay header xác thực vào code, log hoặc báo cáo.

**Định nghĩa hoàn thành:**
- Toàn bộ UI-1 đến UI-10 đã làm hoặc đã có quyết định của người dùng.
- T-1 đến T-8 xanh trên CI.
- Đã gửi báo cáo tiếng Việt cuối cùng: việc đã làm, số liệu, ảnh, giới hạn còn lại.

## 10. Bám Tech stack ADR và SRS v1.1 (bổ sung bắt buộc cho giai đoạn 1)

### 10.1. Quyết định kiến trúc cần hỏi người dùng trước khi làm

Đây là những lệch đã kiểm chứng trong code. Đừng tự ý chuyển đổi; hỏi một lần bằng AskUserQuestion, kèm khuyến nghị.

| # | ADR/SRS yêu cầu | Hiện trạng `atlas-web` | Khuyến nghị khi hỏi |
|---|---|---|---|
| D1 | ADR-011/012: **Monaco + Yjs + y-monaco** cho editor và cộng tác | CodeMirror 6 (`src/components/CodeEditor.tsx`); không có Yjs | Chuyển sang Monaco sau lớp `CodeEditor` (giữ API `value/onChange/resetKey/handleRef`), bọc lazy. Cần chỉnh CSP `worker-src 'self' blob:` (đã có) và `style-src` cho Monaco. Yjs chỉ gắn khi có service collab (`/ws/collab`); không có service thì không giả presence |
| D2 | NFR-2.4 / FR-7.6 / ADR §36: **hai SPA tách biệt**, `workspace-web` (app.*) và `telemetry-console` (observer.*), không chung router, store, cookie hay storage | Các route `/observer/*` nằm chung bundle `atlas-web` | Tách thành entry Vite thứ hai (`telemetry-console`) trong cùng repo; `atlas-web` chỉ giữ link ra domain observer. Hoặc ghi rõ đây là lệch có chủ đích cho tới khi có domain |
| D3 | ADR-011: **React Flow** (DAG), **xterm.js** (terminal), **TanStack Query**, **Zustand** | Graph workflow tự vẽ; không có terminal thật; store tự viết (`src/lib/store.ts`); `useAsync` tự viết | React Flow cho DAG/Execution graph (UI-11, Workflow), xterm.js cho terminal (lazy). TanStack Query và Zustand chỉ đưa vào khi có lớp API thật, nếu không thì giữ store hiện tại để khỏi tăng bundle |
| D4 | ADR §35: lệnh qua REST, luồng sống qua WebSocket | `src/data/service.ts` có contract `atlas-ui/v1` (REST) | Thêm client WebSocket (presence, terminal, DAG progress, thought-tree) phía sau capability; không có WS thì hiển thị "Not observed", không mô phỏng |

Mỗi thư viện mới phải:
- tải lazy, nằm trong ngưỡng JS ban đầu của T-6;
- qua CSP thật;
- giữ axe ở 0 vi phạm.

### 10.2. Kiểm tra UI theo SRS (làm cho mọi màn hình liên quan)

**1. RBAC theo ma trận §3.2 và quyền nguyên tử §3.1**
- Mỗi nút gắn đúng mã quyền (`spec:lock`, `spec:submit_to_ai`, `dag:plan_approve`, `dag:milestone_approve`, `agent:control`, `lock:force_release`, `gov:approve_medium`, `gov:approve_high`, `obs:*`…).
- Lấy quyền qua `capability('<permission_code>')`, không bao giờ suy ra từ tên vai trò.
- Lập bảng `src/data/permissions.ts`: nút → mã quyền → lý do khoá, kèm unit test.
- System Observer là vai trò độc lập: mọi hành động nghiệp vụ trong workspace đều khoá, kèm lý do "Observer sessions are read-only".

**2. Entitlement khác RBAC (ADR §28)**
- Thiếu quyền: "Requires `<perm>`…".
- Gói không có tính năng: "Not included in your organization's plan".
- Vượt quota (ADR §29): "Limit reached: `<resource>`".
- Ba loại lý do này phải có câu chữ và kiểu hiển thị khác nhau. Thêm vào `capability()` một trường `kind: 'permission' | 'entitlement' | 'quota' | 'session'`.

**3. Enum trạng thái theo đúng các máy trạng thái ở SRS §7**

| Đối tượng | Trạng thái |
|---|---|
| SpecDocument | Draft, In_Review, Conflicted, Merged, Locked, Submitted_To_AI, Implemented, Unlocked_Draft |
| TaskDAG | Proposed, Plan_Approved, In_Progress, Completed, Paused, Failed, Rejected, Superseded |
| SubTask | Pending, Ready, Waiting_Human_Checkpoint, Running, Completed, Failed_Paused, Blocked_Budget, Waiting_Lock, Revision_Required |
| Lock | Unlocked, Locked, Released, Expired, Force_Released |
| ApprovalGate | Initiated, Evaluated, Auto_Approved, Pending_Single_Sig, Pending_Multi_Sig, Approved, Rejected, Blocked_Missing_Role, Ready_For_PR |

- Gom tất cả vào `src/data/states.ts`: nhãn hiển thị, tone màu (`toneFor`), icon, và câu "bước tiếp theo an toàn".
- Badge, timeline và lifecycle chain dùng nguồn này; không tự đặt chữ.

**4. Ngưỡng định lượng hiển thị đúng SRS**
- Drift D: ≤ 0,3 In-Sync; 0,3–0,7 Warning; > 0,7 Drift-Blocked (chặn sinh DAG).
- Risk: < 0,3 Low; 0,3–0,7 Medium (1 chữ ký); ≥ 0,7 hoặc Hard Veto: Multi-Sig (Tech Lead + Security Officer). Hiển thị 6 trục và lý do Veto.
- Ngân sách 3 tầng: Key, Workspace/Project, SubTask. Cảnh báo ở 80%; `Blocked_Budget` ở 100%.
- Lock: TTL, heartbeat, hàng đợi 60 s, hiển thị người giữ khoá.
- Lời mời: TTL 72 h, Expired, vai trò mặc định Viewer.
- Mọi ngưỡng là cấu hình động 4 tầng (SRS §12). UI ghi rõ giá trị lấy từ tầng nào (Project, Workspace, Org hay System); không hard-code trong câu chữ.

**5. Luồng E2E trong SRS §10 phải đi được trên UI, không bước nào biến mất khi chưa có service**
- Luồng chính: Lock → **Submit to AI** → Memory Preparation (xem/bổ sung TaskMemoryPackage) → Proposed DAG → Approve Plan → Human Gate → Risk/Gate → PR/CI → Post-merge Drift → Implemented.
- Thêm Episodic draft → Promote.
- Mỗi bước có vị trí trên UI, nút bị khoá kèm lý do, và trạng thái trống "Not observed".
- Kiểm tra các màn hình: Specifications (Lock/Submit/Unlock), Memory, Workflow (Plan-First, `is_human_gate`), Execution, Governance (6 trục, Veto, Multi-Sig, cấm tự duyệt theo BR-GATE-02), Connection (receipts).

**6. Ngoại lệ trong SRS §11 có trạng thái UI tương ứng**
- Ví dụ: EX-SPEC-02 (FCFS reload), EX-AGENT-02 (Blocked_Budget), EX-AGENT-04 (Retry từ snapshot), EX-LOCK-02 (Force release), EX-GOV-01/06 (Blocked_Missing_Role), EX-GOV-04 (CI_Failed), EX-DRIFT-01.
- Đối chiếu với 210 view và scene. Ghi vào báo cáo những ngoại lệ còn thiếu màn hình.

**7. Hiệu năng cảm nhận theo NFR**
- Presence và CRDT < 200 ms.
- Terminal gom batch 50–100 ms, 10–20 FPS; xterm.js ghi theo lô, không re-render React mỗi dòng.
- Thought-tree cập nhật ≤ 200 ms; dùng danh sách ảo hoá khi có nhiều node.

**8. Đa tenant (ADR §2, §30)**
- Thanh trên luôn hiển thị phạm vi Organization / Workspace / Project.
- Đổi org bằng switcher (FR-1.6).
- Không hiển thị dữ liệu khi thiếu tenant context.

## 11. UI-11: Màn hình thực thi multi-agent, refactor từ Figma Archive

**Mục tiêu.** Người dùng rất ưng tính khả dụng của màn hình "Agent execution" trong trang **90 · Archive** (`278:728`), nhưng nó cần refactor. Đây chỉ là một ví dụ: hãy rà các màn hình khác trong Archive theo cùng tiêu chí và đề xuất danh sách cho người dùng chọn.

**Frame nguồn (v9, mới nhất trong Archive)**
- Dark `137:2483` ("UI v9 / workspace / execution"); Light `166:1253`.
- Trạng thái đi kèm (Dark), tất cả trong section `278:741`:
  - `157:27164` parallel; `158:19169` checkpoint; `158:20314` failed; `158:21422` budget; `158:22530` paused; `158:23623` cleanup-error; `158:24740` completed; `157:26466` empty;
  - chi tiết: `158:25831` terminal; `158:26914` artifacts; `158:28075` memory;
  - lệnh: `158:29243` requested; `158:30342` accepted; `158:31444` outcome-unknown;
  - dialog: `158:32555` checkpoint; `158:33703` cancel; `158:34847` resume; `158:35989` retry; `159:31611` snapshot; `159:32718` lineage; `159:33825` manifest;
  - inspector: `159:29489` context; `159:30545` access; `159:35002` permission-viewer;
  - node: `158:37127` agent T-01 … `159:28217` T-07;
  - command requested: `159:36104` approve-gate; `159:37201` cancel; `159:38300` resume; `159:39409` retry.
- Bản Light tương ứng nằm trong section `278:749` (ví dụ `173:20867` parallel, `174:20614` terminal).
- Archive còn có: Agent Hub (`2:332`), Agent Run (`2:926`), Agent Telemetry (`2:1496`), runs (`152:7219`), run-detail (`152:7743`), terminal (`152:8151`), agent-compose (`151:11652`), meta-agent (`151:12102`), default-agent (`150:11372`).
- `get_metadata` trên trang Archive trả về khoảng 14 MB. Lọc frame bằng Python như ở mục 4.

**Phần đáng giữ** (bố cục khả dụng cao)
- Header run: id, tiến độ "x/y completed", số agent đang chạy, chi phí trên ngân sách, badge trạng thái.
- Dải lệnh: Review checkpoint, Pause, Resume, Retry failed, Cancel run (danger), Snapshot, Artifacts, Export.
- **Execution graph** dạng thẻ node: mã task, loại (AGENT / LLM AGENT / HUMAN GATE / SANDBOX TEST / ARTIFACT), tên, vai trò agent, badge trạng thái, attempt và thời gian, các hành động Inspect / Logs / Retry / Review. Có cạnh phụ thuộc, công tắc Graph/List, zoom/fit.
- **Inspector node được chọn**: tab Task / Context / Access; Attempt, Heartbeat, Worker, Tool, Output; File scope (khoá file); Inspect artifacts, Review lineage.
- **Dải dưới**: tab Events / Terminal / Artifacts / Memory, có timestamp.

**Phần phải refactor**
1. **Shell**: bỏ sidebar và top bar cũ của v9; đặt nội dung vào shell Current UI hiện tại (route `/execution` và view `execution/*`). Dùng token và primitive hiện có (typography 12 px cho control, `--text-control`, Badge, Button, Tabs).
2. **Không có dữ liệu giả trong production**: RUN-DEMO-284, $12.80/$50, java-worker-02, `src/auth/*.ts`, T-01…T-07 chỉ xuất hiện trong review build và gắn nhãn "Illustrative". Production hiển thị khung graph, inspector và tab với "Not observed", cùng nút "Connect service".
3. **Gắn hành động theo quyền và trạng thái**:
   - Pause, Resume, Retry, Cancel cần `agent:control`. Review checkpoint cần `dag:milestone_approve`. Force release cần `lock:force_release`.
   - Mỗi nút bị khoá hiển thị lý do ngay bên cạnh (`reasonId` chung cho cả dải).
   - Trên Archive, nút Retry và Inspect hiển thị như đang bật dù không có service. Đây là lỗi; phải sửa.
   - Mọi lệnh đi qua `CommandDialog` / `sendCommand`: tiến trình Requested → Received → Accepted → Effective; mơ hồ thì Unknown, không bao giờ gửi lại tự động.
4. **Trạng thái node theo SRS**: dùng enum SubTask ở mục 10.2.3. Ánh xạ: Human Gate là `Waiting_Human_Checkpoint`; "Blocked" của Archive tách thành `Pending` / `Blocked_Budget` / `Waiting_Lock`; hiển thị `Failed_Paused` kèm snapshot.
5. **Loại node theo ADR-003**: AGENT, TOOL, MCP, SANDBOX, TEST, CONDITION, PARALLEL, HUMAN_GATE, GOVERNANCE_GATE, MEMORY_PREP. Mỗi loại có icon và nhãn chữ, không chỉ dựa vào màu.
6. **Graph**:
   - Dùng React Flow nếu D3 được duyệt; nếu chưa, dùng graph tự vẽ hiện có trong `WorkflowPage`.
   - Bắt buộc có **List view** tương đương cho bàn phím và trình đọc màn hình, đặt là mặc định dưới 1024 px (UI-7).
   - Thẻ node là phần tử bấm được với nhãn đầy đủ. Focus đi theo thứ tự topo.
7. **Inspector**: thêm Budget 3 tầng của SubTask, Lock (file, holder, TTL, heartbeat), Memory slice (TaskMemoryPackage), Output contract, Snapshot gần nhất (BR-SAND-01). Tab Access hiển thị quyền thực tế của session, không suy ra từ vai trò.
8. **Dải dưới**:
   - Terminal dùng xterm.js nếu D3 được duyệt; nếu chưa, dùng khung mono chỉ đọc, gom batch theo NFR-1.2.
   - Thêm tab **Thought tree** (FR-7.3): cây `ThoughtNode` cha-con. Chỉ hiển thị structured state (ADR-004), không hiển thị chain-of-thought thô.
   - Events dùng thời gian tuyệt đối UTC, kèm thời gian tương đối.
9. **Dialog**: checkpoint, cancel, resume, retry, snapshot, lineage, manifest theo các frame dialog ở trên. Cancel và các hành động huỷ hoại cần xác nhận và nêu rõ phạm vi (task, khoá, sandbox bị giải phóng theo BR-DAG-04).
10. **Kiểm tra**:
    - So ảnh Archive với app (Dark/Light, 1440 và 1024).
    - axe 0 vi phạm.
    - E2E: production không có chữ mẫu; nút khoá có lý do; List view thao tác đủ bằng bàn phím.
    - Review build hiển thị đủ 8 trạng thái run.

**Bàn giao UI-11**
- Commit riêng, kèm ảnh Archive và ảnh app.
- Báo cáo nêu rõ phần nào giữ nguyên, phần nào đổi, và vì sao.
