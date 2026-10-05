# Master plan bàn giao: hoàn thiện frontend Atlas web

Văn bản này dùng độc lập: dán nguyên vào phiên agent mới.

## 1. Vai trò, mục tiêu, thứ tự

Bạn tiếp quản frontend Atlas trong `frontend/atlas-web`, repo `ldqanh1408/hehe`, nhánh `claude/sharp-thompson-5tff91`.

**Mục tiêu:** đưa frontend lên mức production-grade, bám sát Figma.

**Thứ tự bắt buộc:**
1. Làm xong phần UI/UX còn lại (mục 4).
2. Sau đó mới làm test và cổng chất lượng (mục 5).

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
