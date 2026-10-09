# Master plan bàn giao: hoàn thiện frontend Atlas web

> Điểm tiếp quản hiện tại: repo `ldqanh1408/frontend`, branch `handoff/frontend-e2e`. Người dùng đã cho phép push. Xem `docs/UI-UX-ACCEPTANCE.md`, `docs/UI-UX-DESIGN-SYSTEM.md` và `docs/SRS-ADR-CONFORMANCE.md` trước khi dùng các checkpoint lịch sử bên dưới. Ảnh kiểm thử mới được giữ trong evidence riêng theo `docs/VISUAL-EVIDENCE.md`; CI công khai kiểm tra layout, chức năng, accessibility và hiệu năng. Chưa có nghiệm thu backend hoặc production.

Văn bản này dùng độc lập: dán nguyên vào phiên agent mới.

## 1. Vai trò, mục tiêu, thứ tự

Bạn tiếp quản frontend Atlas trong `frontend/atlas-web`, repo `ldqanh1408/frontend`, nhánh `handoff/frontend-e2e`.

**Mục tiêu:** đưa frontend lên mức production-grade, bám sát Figma.

**Thứ tự bắt buộc:**
1. Đối chiếu các quyết định kiến trúc đã ghi nhận ở mục 10.1 và báo cáo conformance hiện tại; chỉ hỏi khi có quyết định mới thực sự chưa xác định.
2. Làm xong phần UI/UX còn lại: mục 4, cộng thêm mục 10 (bám Tech stack ADR + SRS v1.1) và mục 11 (UI-11: tái sử dụng các mẫu UI khả dụng cao trong Figma Archive, có refactor).
3. Sau đó mới làm test và cổng chất lượng (mục 5).

**Hai tài liệu chuẩn bổ sung** do người dùng cung cấp: "Atlas — Tech Stack & ADR" (2026-10-01) và "SRS v1.1". Khi Figma, ADR và SRS mâu thuẫn:
- **SRS** quyết định nghiệp vụ: trạng thái, quyền, ngưỡng, luồng.
- **ADR** quyết định công nghệ.
- **Figma** quyết định hình thức.

Mọi lệch còn lại phải ghi vào báo cáo.

**Không deploy** lên staging hay production, và không gọi API ghi của Cloudflare.

## 2. Ràng buộc (giữ nguyên từ master prompt gốc)

**Git**
- Commit và push lên `handoff/frontend-e2e` trong repo `ldqanh1408/frontend` theo phạm vi bàn giao hiện tại đã được người dùng cho phép.
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

## 11. UI-11: Tái sử dụng mẫu UI từ Figma Archive (có refactor)

**Bối cảnh.** Người dùng đánh giá trang **90 · Archive** (`278:728`) có **nhiều** mẫu UI khả dụng cao hơn so với Current UI. Màn hình thực thi multi-agent (mục 11.4) chỉ là **một ví dụ**. Việc của UI-11 là rà toàn bộ Archive, chọn ra các mẫu đáng dùng, rồi refactor để chúng vào app hiện tại.

### 11.1. Kho frame đã kiểm kê

`design-source/archive-frames.json` liệt kê 873 frame cấp cao của Archive theo section, kèm id và tên:

| Section | Id | Số frame |
|---|---|---|
| 04 · Previous workspace · Dark (v9) | `278:741` | 194 |
| 06 · … Light (v9) | `278:749` | 194 |
| 05 · Previous Observer · Dark (v9) | `278:745` | 16 |
| 07 · … Light (v9) | `278:753` | 16 |
| 02 · Earlier workspace designs (v2–v8) | `278:733` | 412 |
| 03 · Earlier Observer designs (v7–v8) | `278:737` | 32 |
| 01 · Prior foundations and components (v2–v8) | `278:729` | 8 |
| 08 · Previous review index (v9) | `278:757` | 1 |

- **Ưu tiên v9** (section 04/06/05/07). v2–v8 chỉ dùng khi v9 không có màn hình tương đương.
- Tên frame có dạng `UI v9 / workspace / <key>`. Bản Light cùng `<key>` nằm trong section `278:749`.

### 11.2. Nhóm ứng viên trong v9

Ghép theo SRS và theo route hiện tại. Đây là điểm xuất phát; agent tự soát thêm.

| Nhóm SRS | Frame v9 (`<key>`) | Đích trong app hiện tại |
|---|---|---|
| M1 Onboarding & tenancy | onboarding, setup-readiness, setup-complete, organizations, workspaces, workspace-settings, projects, project-new, scope-workspaces, greenfield | `/tenancy`, Overview, trang account |
| M1 Thành viên & RBAC (FR-1.2, FR-1.6) | members, invitations, invite, invite-identity, roles, role-editor, access, access-revoked, offboarding, state-wrong-account, state-expired-invitation, state-access-changed | `/identity`, trang account (UI-4) |
| M1 LLM Gateway & ngân sách 3 tầng (FR-1.3) | gateway, routing, budgets, budget-ledger, state-budget-blocked | `/gateway`, `/saas` |
| M1 Agent Customization Hub (FR-1.4) | hub, skills, rules, plugins, hooks, sidecars, default-agent, sandbox-templates, runtime-settings, integrations | `/agents`, `/resources`, `/configuration` (draft workbench) |
| M1 Memory Hub (FR-1.5, FR-4.5) | memory, memory-settings, memory-import, curation, memory-layers, memory-lineage, memory-prep, ai-context, state-memory-deprecated | `/memory` |
| M2 Spec, merge, lock (FR-2.x) | editor, specs, locked, history, spec-diff, merge, conflicts, stale-merge, draft-recovery, state-merge-stale, state-offline-draft, ide-state-* | `/specifications` |
| M3 Code intelligence (FR-3.x) | code, search-code, evidence, scan, drift, code-symbols, repo-reconcile, state-empty-repository, state-scanner-unavailable | `/code` |
| M4 Workflow & plan-first (FR-4.1–4.3) | workflow, workflow-templates, workflow-proposal, wf-review, meta-agent, agent-compose, contracts, plans, plan-detail, generation-job, admission, input-lineage, state-generation-failed, state-input-superseded, v6-state-multi-spec-plan, v6-state-context-* | `/workflow` |
| M4/M5 Thực thi & sandbox (FR-4.4, FR-5.x) | execution (mục 11.4), execution-*, runs, run-detail, terminal, activity-tree, artifacts, snapshot, sandboxes, locks, recovery, cleanup, artifact-handoff, state-checkpoint-required, state-snapshot-unavailable, state-cleanup-held, state-restore-reconcile | `/execution`, `/desktop` |
| M6 Governance (FR-6.x) | gates, gate-detail, gate-medium, risk-policy, risk-review, diff-review, security, secret-triage, reviewer-eligibility, signature-history, pull-request, pr-reconcile, ci-failed, pr-conflict, post-merge, acceptance, audit, exceptions, policy-impact, state-secret-confirmed, state-reviewer-missing, state-old-head-ci, state-pr-unknown, state-partial-merge, state-acceptance-failed, state-verification-unknown | `/governance`, `/configuration` |
| M7 Collaboration & notifications (FR-7.2–7.5) | notifications, activity-tree (Thought tree), design-journeys, business-states | `/collaboration`, top bar |
| Observer console (FR-7.6, NFR-2.4) | obs-overview, obs-login, traces, trace-detail, metrics, profiler, telemetry, infra, saturation, obs-audit, exports, export-job, data-quality, profile-compatibility, diagnostic-handoff | `/observer/*` (hoặc SPA `telemetry-console` nếu D2 được duyệt) |

### 11.3. Quy trình bắt buộc

1. **Chụp và chấm điểm.** Với mỗi nhóm, chụp frame v9 Dark (`get_screenshot` base64) và màn hình app tương ứng. Chấm 0–2 theo 5 tiêu chí:
   - khả dụng: thông tin then chốt nhìn thấy ngay, ít thao tác;
   - bám SRS: đúng trạng thái, quyền, ngưỡng, luồng;
   - mức hiện tại thiếu: app chưa có, hoặc có nhưng kém;
   - chi phí refactor;
   - rủi ro a11y hoặc hiệu năng.
2. **Hỏi người dùng chọn.** Gửi bảng shortlist: tên, id frame, điểm, ảnh thu nhỏ Archive và app, đề xuất "dùng / dùng một phần / bỏ". Đánh dấu ví dụ màn hình thực thi là đã được chọn. Không tự triển khai cả loạt khi người dùng chưa duyệt.
3. **Refactor từng mẫu đã chọn** theo các quy tắc chung (áp dụng cho mọi mẫu, không chỉ màn hình thực thi):
   - Bỏ shell, nav, top bar cũ của v9; đặt vào shell Current UI. Dùng token và primitive hiện có, typography Current UI (control 12 px).
   - Trong Archive có nhiều nút trông như đang bật (Retry, Approve, Inspect…) và dữ liệu mẫu (Acme, RUN-DEMO, $, SHA, tên người). Production phải khoá kèm lý do và hiển thị "Not observed". Dữ liệu mẫu chỉ có trong review build, gắn "Illustrative".
   - Quyền, trạng thái, ngưỡng và luồng theo mục 10.2; lệnh đi qua `sendCommand` với tiến trình Requested → Received → Accepted → Effective / Unknown.
   - Thư viện theo quyết định D1–D4 ở mục 10.1.
   - Không làm mất màn hình hay nhãn đang đạt parity Current UI (451/457), trừ khi người dùng đồng ý thay. Nếu mẫu Archive thay một frame Current UI, cập nhật `e2e/figma-parity.spec.ts` có chủ đích và ghi lý do.
   - Mỗi mẫu có List hoặc bảng tương đương cho bàn phím và trình đọc màn hình; responsive theo UI-7; axe 0 vi phạm.
4. **Commit và bằng chứng.** Mỗi mẫu một commit nhỏ. Báo cáo kèm ảnh Archive / app before / app after (Dark/Light), phần giữ, phần đổi, lý do.

### 11.4. Ví dụ đã được người dùng chọn: màn hình thực thi multi-agent

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

**Bàn giao mẫu này**
- Commit riêng, kèm ảnh Archive và ảnh app.
- Báo cáo nêu rõ phần nào giữ nguyên, phần nào đổi, và vì sao.

## 12. Checkpoint UI review — 07/10/2026

Tiếp tục từ archive/remote base `4737b155e9f106bc7351c271d19ef207cfbb9a66`, giữ nhánh `claude/sharp-thompson-5tff91`. Chưa deploy, chưa staging acceptance, chưa ghi Cloudflare. Commit mới hiện chỉ local vì push dry-run thiếu credential. Không tính CI lịch sử là kết quả của bản sửa này.

- Scene chuyên biệt và account layout đã tách; GAP name map cập nhật có 655 binding thực mỗi theme, 96 scene còn lại dùng template. Giữ 210 view / 751 scene và các count nguồn.
- Execution v9 đã vào Current shell: Graph/List, inspector, activity tabs, 8 review state; production không có dữ liệu minh hoạ. Mutation prototype links bị chặn; command cần grant, scope, revision và contract.
- Spec/Code responsive có Explorer/Editor/Inspector; CodeEditor lazy và route prefetch. Sửa purge document còn sót draft và timestamp import làm Explorer dịch bố cục.
- Local: typecheck, 44 unit/component, 520 Chromium functional (3 release/staging skip gốc), 19 test kiểm lại, 150 visual và 22 review qua. Visual giữ ngưỡng 0,5%; baseline tạo/verify tại container Linux này, chưa xác nhận Ubuntu CI.
- Text parity thực tế 450/457: 7 ngoại lệ được mục UI-9 liệt kê (Resources 1 + Memory 3 + Configuration 3). Tổng 451/457 và “6 nhãn” ở phần bàn giao cũ không khớp danh sách; không sửa Field Dictionary để đạt số đó.
- Đã lưu reference 18 state + 7 definition state cả Dark/Light, chụp các state definition bằng thao tác local và Execution review. UI-2 còn thiếu nghiệm thu pixel toàn bộ business state cần backend; không coi ảnh module liên quan là bằng chứng state thật.
- Firefox kẹt lúc tạo page; WebKit thiếu OS dependency và cài đặt bị chặn mạng package manager. CI đã cấu hình 3 engine; T-1/T-8 còn chưa xác nhận.
- NVDA/VoiceOver chưa chạy thủ công; checklist ở `ui-review/AT-CHECKLIST.md`.
- Đã hỏi D1–D4 một lần, chưa có lựa chọn. Không tự migrate stack; backend `atlas-ui/v1` vẫn là đề xuất, chưa tích hợp live WS/config resolver/scope switch.
- Shortlist Archive 12 nhóm ở `ui-review/archive-shortlist.json`; chỉ Execution đã được chọn và refactor. 11 nhóm khác chờ user lựa chọn.

Báo cáo đầy đủ: `ui-review/Atlas-UI-Review.md`, số đo: `ui-review/verification.json`, ảnh/test evidence: `ui-review/evidence/`. Gallery offline `Atlas-UI-Review.html` bàn giao riêng. Chạy app review bằng `npm run build:review && npm run preview:review`, cổng 4174, thư mục `dist-review`. Không chạy release/deploy khi user chưa xem và xác nhận UI.

## 13. Checkpoint triển khai và nghiệm thu local — 07/10/2026

Checkpoint này thay trạng thái công việc ở mục 12; giữ mục 12 làm lịch sử. Yêu cầu tiếp theo “triển khai và nghiệm thu toàn bộ” được dùng để tiếp tục stack D1–D4 và các phần khuyến nghị của 12 nhóm Archive. Điều kiện người dùng xem và duyệt UI trước deploy vẫn giữ. Chưa deploy, chưa staging, chưa ghi Cloudflare, chưa tạo PR.

- D1–D4 đã vào source: Monaco/Yjs có room theo scope/branch/document và server-owned initial content; hai entry Workspace/Observer độc lập; React Flow có Graph/List; xterm chỉ đọc có bounded batching/backpressure; TanStack Query và Zustand; scoped WebSocket kiểm sequence/resource/grant/expiry. Configuration resolver giữ source/revision và ưu tiên Project > Workspace > Org > System. Scope switch chỉ đổi session sau matching Effective readback; Unknown không tự gửi lại.
- Đã thêm đúng 18 native state Current UI, hai theme; OB-Stale thuộc Observer entry. Các frame nguồn quyết định heading/purpose/panel/scope/action. Ảnh đúng state có trong gallery; không coi ảnh là bằng chứng business state hoặc pixel parity. Production giữ Not observed, review ghi Illustrative.
- 12 nhóm Archive đã dùng phần khuyến nghị vào Current primitives: onboarding, membership, gateway/budget, resource hub, memory, editor, code, plan-first workflow, execution, governance, inbox/collaboration, Observer. Execution tích hợp đầy đủ mẫu UI được chọn; 11 nhóm còn lại tích hợp phần hữu ích, không phục hồi toàn bộ shell v9. `ui-review/archive-shortlist.json` và báo cáo ghi phần giữ/đổi cùng ảnh reference/app before/app after cả Dark/Light.
- Sửa focus khi lazy route mount để skip link đến heading và không chen vào nhập liệu/dialog; draft Memory giữ tên vừa nhập. Scope bar/breadcrumb mobile không chồng chữ và đạt mục tiêu chiều cao. Monaco chỉ tải sau khi mở file/document, tắt word-only suggestions; chưa có remote LSP.
- Typecheck hai config, production/review build đạt. Unit 54/54. Functional coverage tổng hợp 1.695 ca có kết quả đạt gần nhất trên ba engine (565 mỗi engine), 9 release/staging skip gốc. Đây là nhiều lượt có kiểm lại, không phải một raw run toàn bộ xanh: lượt đầu 1.683 đạt/6 lỗi/9 skip; lượt UI rộng 274 đạt/5 lỗi; lượt focus 65 đạt/1 timeout Monaco. Các lỗi đều có kiểm lại đạt, giữ raw JSON/log. IDE chạy riêng cuối 12/12 đạt; a11y route timeout kiểm lại 6/6, không tăng timeout.
- Review 174/174 trên Chromium/Firefox/WebKit. Visual 150/150 (25 target × 2 theme × 3 width); sau sửa mobile spacing cuối, 50/50 ảnh 390 px kiểm lại đạt. Giữ ngưỡng diff 0,5%. Đây là Linux local, chưa chứng minh baseline Ubuntu CI.
- Perf 8/8, desktop không throttling: LCP <2.500 ms, CLS <0,1, JS ban đầu <512 KiB; số đo từng route trong verification.json. Lượt perf đầu nhận nhầm LazyCodeEditor wrapper là editor; sửa nhận diện chunk thật và thêm kiểm DOM chưa mount, giữ raw lỗi. Không nới ngân sách.
- Kiểm ảnh lớn cuối phát hiện SVG cạnh DAG bị global max-width reset co về 0 px. Đã sửa CSS riêng vùng graph và dùng stroke/arrow Current token, kiểm lại 6 case Execution ở 3 engine × 2 theme (paint viewport, 8 state, axe, inspector và keyboard/List) cùng 12 ảnh Workflow/Execution production. Gallery Execution được chụp lại sau sửa; không cộng lượt kiểm lại thành test độc lập mới.
- Parity hiện **451/457** trên cả ba engine. Panel Memory mới làm “Knowledge type” hiện diện trong tìm kiếm/bảng, nên còn 6 nhãn thiếu (Resources 1 + Memory 2 + Configuration 3), tất cả thuộc danh sách ngoại lệ UI-9. Không đổi Field Dictionary để tăng số.
- Firefox/WebKit đã chạy được local sau cài dependency và launch prefs phù hợp container. CI chia ba verify job độc lập theo engine; giữ budget 45 phút, Chromium kiểm visual/performance/reproducibility. Chưa có CI của commit mới; commit hiện local: dry-run trước thiếu credential và lần push cuối bị kiểm duyệt tự động chặn vì remote/quyền gửi source-bằng chứng chưa được xác minh. Không tính CI lịch sử.
- Backend `atlas-ui/v1` vẫn là đề xuất; REST/WS/Yjs trong test là protocol peer. Chưa nghiệm thu live persistence/freeze/lock/AI/PR/CI/Implemented, domain/cookie production hay NVDA/VoiceOver thủ công. Không dùng timing peer local làm chứng nhận NFR mạng production. DTO/server obligations ở `docs/INTEGRATION.md`.

Báo cáo: `ui-review/Atlas-UI-Review.md`; số đo và hash raw: `ui-review/verification.json`; coverage tổng hợp có nguồn từng case: `ui-review/evidence/e2e-coverage.json`. Gallery offline bàn giao riêng. Review local: `npm ci && npm run build:review && npm run preview:review`, cổng 4174. Giữ gate duyệt UI trước mọi deployment.

## 14. Checkpoint release và nghiệm thu continuation — 08/10/2026

Checkpoint này cập nhật phần release/QA sau mục 13. Chưa push, chưa deploy, chưa staging acceptance thật, chưa ghi Cloudflare. Giữ gate người dùng xem và duyệt UI trước deployment.

- Release ghi hai entry Workspace/Observer, source digest, độ dài/SHA-256 từng file. Worker generator tách hai audience và fallback HTML, kiểm integrity cả cache/upstream, giữ security headers, HEAD/ETag và lỗi rõ ràng. URL artifact dùng repo canonical `ldqanh1408/frontend`; tên `hehe` trong handoff trỏ tới repo này.
- Staging acceptance yêu cầu hai HTTPS origin độc lập và đúng `EXPECTED_BUILD_ID`, kiểm GET/HEAD trên ba engine. Thiếu cấu hình hoặc test lỗi làm gate thất bại. CI chỉ đọc và upload artifact; bỏ auto commit/push evidence và cơ chế bỏ qua lỗi staging. CI build/rebuild source của commit hiện tại, không so với release lịch sử; giữ manifest/output làm artifact. Chính lệnh CI đã kiểm local: 125/125 file giống nhau, chưa phải GitHub run.
- `npm run verify` tạo evidence mới cho mỗi run, dừng khi gate lỗi, ghi source digest và trạng thái ngắt. Không ghép rerun vào một summary toàn bộ xanh. Playwright dùng hai worker; tắt Firefox updater trong automation, chỉ nới sandbox khi có `ATLAS_CONTAINER_BROWSER=1` ở container.
- Sửa `useRouteFocus` để StrictMode replay mount không chuyển focus ban đầu. Đây là lỗi riêng được unit test xác nhận. Lỗi skip-link WebKit ở lượt full-suite do gửi Tab khi React chưa mount: trace có root rỗng. E2E chờ control hiển thị trước Tab/Ctrl+K; giữ assertion và timeout.
- Typecheck, production/review build đạt; unit **56/56**, tooling **7/7**. Lượt full functional **1.694 đạt / 1 lỗi / 9 skip**, giữ raw FAIL. Sau sửa, shell/IDE **48/48** trên ba engine, skip-link lặp **30/30**, visual **150/150** với ngưỡng 0,5%, perf **8/8**, review **174/174**. Coverage gần nhất tổng hợp **1.695 đạt / 9 skip** có nguồn từng case; không phải một lượt toàn bộ xanh của source cuối. Các run ngắt cũng được giữ riêng.
- Release `local-acceptance` build hai lần: **125/125 file giống hash**, buildId `source-64e0c7e1432138b0`. Đây là source ZIP (`sourceKind: archive`, `sourceCommit: null`), chưa cấu hình origin production; không dùng để deploy Worker pin Git. Guard này đã kiểm thất bại đúng khi thử tạo Worker từ archive.
- GitHub đã kết nối và xác minh repo/nhánh/quyền push. Remote head quan sát là `4737b155e9f106bc7351c271d19ef207cfbb9a66`; CI xanh gần nhất thuộc commit `9e4b411fb64c091e5d6391895fe380297462459c`, không chứng minh source hiện tại. Automatic approval review đã chặn push dry-run vì chưa có xác nhận xuất source/evidence tới remote; cần người dùng cho phép push cụ thể trước lần gửi tiếp.
- Cloudflare chỉ GET: có `atlas-web-staging` và `sparkling-snow-090d`, chưa thấy Worker Observer độc lập. Deployment staging 05/10 có trước source này. Backend `atlas-ui/v1`, persistence/freeze/lock/AI/PR/CI/Implemented, domain/cookie thật và NVDA/VoiceOver thủ công vẫn chưa nghiệm thu.

Source/diff: `ui-review/continuation-source.json`, `ui-review/continuation-patches/`. Kết quả mới: `ui-review/verification-20261008.json`; raw và hash: `ui-review/evidence/acceptance-20261008/`. Hướng dẫn deploy sau duyệt UI: `docs/DEPLOY-ACCEPTANCE.md`. Các báo cáo ở checkpoint 13 giữ nguyên làm lịch sử.

## 15. Checkpoint đối chiếu SRS/ADR và PR secret-handling — 08/10/2026

Checkpoint này ghi trạng thái tại mục15; mục16 cập nhật kiểm tra đầy đủ. Mục 12–14 và các release/evidence cũ giữ làm lịch sử. Handoff hiện chỉ triển khai frontend; chưa thể xác nhận toàn bộ Atlas E2E. Chưa push, merge, deploy hay staging; vẫn giữ gate duyệt UI.

- Hai tài liệu người dùng cung cấp được giữ nguyên byte tại `docs/specifications/`, kèm SHA-256. Ma trận đủ 35 FR, 10 NFR, 40 BR chính thức, 27 ngoại lệ, 19 ADR, 14 giả định, 19 cấu hình; tất cả có nghĩa vụ nghiệm thu còn lại. Báo cáo: `docs/SRS-ADR-CONFORMANCE.md`, registry: `docs/requirements-traceability.json`.
- PR #1 `fix/secret-handling`, head `0e8cf8340f0f90bc3dee5a5e37019450bfcda24f`: 29 test gốc đạt nhưng 4 kiểm tra bảo mật mới thất bại. Lọt environment map KEY, import bỏ qua policy, hai secret có cùng fingerprint và lỗi dịch vụ lưu secret vào journal. Khuyến nghị sửa trước merge; remote PR không bị thay đổi. Chi tiết: `ui-review/PR-1-SECRET-HANDLING-REVIEW.md`.
- Source continuation đã sửa các vấn đề này, thêm policy trước persistence/download cho cả preserved/legacy/unsaved/recovery; giữ fingerprint exact payload, che/clear input, loại sensitive response khỏi journal kể cả reconcile sau reload. Đây là heuristic phía client; backend vẫn phải scan toàn bộ diff bằng regex+entropy và redact logs/traces/artifacts.
- Cấu hình null kế thừa từ cha, zero/false vẫn giữ. CI local đã bổ sung pull_request trigger; workflow audit lịch sử chuyển sang artifact-only/read permission, bỏ tự commit/push và ignore lỗi. Chưa chạy CI mới trên GitHub.
- Cuối: typecheck/build đạt, **78 unit/component**, **7 tooling**, **57 browser focused** trên ba engine đều đạt. Release archive `local-conformance`: **126/126 file giống nhau**, buildId `source-77cdc3b389051423`, digest `77cdc3b38905142365bb758b060be0a16e4f7b5335fe91c4c7a79d1054ce8bf3`. Không gán SHA Git hay origin production chưa quan sát. Không có lượt toàn bộ functional/visual/perf mới cho source này; các kết quả broad cũ vẫn ghi đúng phạm vi lịch sử. Một quan sát presence local276ms không được tính là NFR<200ms đạt.
- SRS và ADR còn 7 điểm cần chốt, đặc biệt snapshot latest commit vs exact base_commit, raw chain-of-thought vs structured progress, ngưỡng drift và latency. Handoff dùng thiết kế an toàn của ADR-004, nhưng chưa tự coi là giải quyết mâu thuẫn cho backend.
- Nghiệm thu thật Luồng0–7 và Observer được mô tả trong `docs/LIVE-E2E-ACCEPTANCE.md`, đủ happy path, lỗi/recovery, actor/scope/revision/fingerprint/effect/audit/artifact proof. Toàn bộ hiện NOT_RUN: thiếu backend Java/Spring/Modulith/Temporal/database/Compose, contract được duyệt, GitHub App test và hai origin/cookie độc lập. UI/journal/protocol peers không thay các yêu cầu đó.

Bằng chứng mới: `ui-review/verification-conformance-20261008.json`, raw logs/hash tại `ui-review/evidence/conformance-20261008/`. Patch local kế tiếp nằm trong `ui-review/continuation-patches/`; chưa xuất lên GitHub. Hướng dẫn deploy và các điều kiện nghiệm thu trong `docs/DEPLOY-ACCEPTANCE.md`.

## 16. Checkpoint một lượt kiểm tra frontend đầy đủ — 08/10/2026

Đây là checkpoint hiện tại; mục 12–15 và evidence cũ giữ làm lịch sử. Người dùng đã chốt phạm vi frontend trong repo này; backend là phần tích hợp riêng chưa nghiệm thu. Repo người dùng xác nhận `https://github.com/ldqanh1408/frontend`; remote default head vẫn `4737b155e9f106bc7351c271d19ef207cfbb9a66`, PR #1 vẫn `0e8cf8340f0f90bc3dee5a5e37019450bfcda24f`, không có check/status trên PR head. Không push, merge, deploy hay chạy staging thật.

- `npm run verify`, run `20261008-complete`: toàn bộ sáu gate đạt trong một lượt mới. 78 unit/component, 7 tooling, 1701 functional đạt/9 release-staging skip/0 lỗi/0 flaky, 150 visual giữ ngưỡng 0,5%, 8 performance giữ budget, 174 review trên ba engine. Mỗi engine functional 567 đạt/3 skip. Không ghép raw runs để tạo PASS.
- Runtime digest `77cdc3b38905142365bb758b060be0a16e4f7b5335fe91c4c7a79d1054ce8bf3` không đổi đầu/cuối; 172 file test/config/baseline khớp local `0e3dfc9`, snapshot lấy trong khi chạy và được kiểm lại. Không sửa source, test, timeout hoặc visual baseline trong lượt này. Release 126 file cùng digest đã kiểm reproducibility ở checkpoint 15; không có rebuild/release/deployment mới.
- Source handoff đã sửa bốn lỗi secret-handling và null inheritance tại checkpoint 15. PR remote vẫn cần sửa trước merge; giữ nguyên raw 29-pass/4-fail và permalink. GitHub CI hiện chưa xác minh source handoff.
- Source remote dưới các filename Java/Maven/Gradle/Compose/Dockerfile đã kiểm không chứa backend. Backend ngoài repo chưa được xác định. Ma trận SRS/ADR, bảy xung đột và J0–J7/O1 vẫn theo `docs/SRS-ADR-CONFORMANCE.md`/`docs/LIVE-E2E-ACCEPTANCE.md`; journey backend NOT_RUN. Local tests/peer timing không chứng nhận NFR, tenant/auth isolation hay domain effects. Presence trong lượt full có max534 ms; focused checkpoint 15 max 429 ms. Cả hai gồm observation overhead và không được tính là NFR <200 ms đạt.
- Giữ gate duyệt UI trước deploy; còn cần authorization xuất source/evidence, CI commit mới, backend/contract/test resources, hai HTTPS origin/cookie độc lập, staging và NVDA/VoiceOver thủ công.

Kết quả: `ui-review/verification-complete-20261008.json`; raw/case index/hash: `ui-review/evidence/complete-20261008/`; remote observation: `ui-review/github-source-observation-20261008.json`; báo cáo tiếp quản: `ui-review/CONTINUATION-REPORT-20261008.md`.
