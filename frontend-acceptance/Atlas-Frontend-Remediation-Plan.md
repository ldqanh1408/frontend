# Atlas — Remediation Plan (đề xuất, AUDIT_ONLY)

Không thay đổi nào được áp dụng vào sản phẩm hoặc Cloudflare. Closure cần: fix/build ref, repro trước sửa, retest cùng profile, regression và **retest trên remote** (workflow `atlas-frontend-acceptance` chạy lại được bằng cách sửa `frontend-acceptance/run-request.json`).

## R-01 · FND-002 (P2) — Security headers / CSP
Thêm file `_headers` (không đuôi) vào thư mục static assets (Workers static assets; nguồn: developers.cloudflare.com/workers/static-assets/headers/):
```txt
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; worker-src 'self' blob:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Cross-Origin-Opener-Policy: same-origin
```
Rủi ro: Monaco cần inline style và có thể tạo worker từ `blob:`; `connect-src` phải chứa endpoint dịch vụ thật. Thử `Content-Security-Policy-Report-Only` trước. Acceptance: CF-PRE-005 + CF-PRE-005-GH PASS; 0 vi phạm CSP khi mở editor (6 worker), kết nối fixture, import file. Regression: FE04-WORKER-001, CODE-008, FX-SERVICE-001, FE04-XENGINE-ROUTES-*.

## R-02 · FND-003 (P2) — Cache asset băm
```txt
/assets/*
  Cache-Control: public, max-age=31536000, immutable
```
Giữ `index.html`, `/release-manifest.json` ở mặc định revalidate; `/fonts/*` không có hash ⇒ `max-age=86400` hoặc đổi tên khi đổi nội dung. Acceptance: CF-PRE-006(-GH) PASS; warm load không revalidate `/assets/*`. Regression: PERF-007-WARM, CF-PRE-002.

## R-03 · FND-004 (P1, kế thừa) — 3/49 definition type
Tên mặc định không chứa "/" (hoặc validator chấp nhận nếu spec cho phép). Acceptance: DEF-RETEST-FND-004 49/49 (cần Field-Dictionary + schema_oracle).

## R-04 · FND-017 (P3) — Tiêu đề trang theo view
`document.title = \`${viewTitle} · Atlas Workspace\`` khi đổi route (cả trạng thái không tìm thấy). Acceptance: FE01-TITLE-001.

## R-05 · FND-018 (P2) — Breadcrumb nằm dưới header cố định sau khi đổi view
Nguyên nhân (run 3): khi focus đang ở ngoài `<main>`, đổi view → app gọi `main.focus()` → trình duyệt cuộn để đưa `main` vào tầm nhìn nhưng không tính header `position: fixed` (Chromium/WebKit cuộn 52–60 px; Firefox không cuộn).
Đề xuất: `main.focus({ preventScroll: true })` rồi `window.scrollTo(0, 0)` khi đổi view; và/hoặc `html { scroll-padding-top: var(--appbar-height) }` + `main { scroll-margin-top: var(--appbar-height) }`.
Acceptance: FE02-SCROLL-001-CHROMIUM/WEBKIT/FIREFOX 0/15 bị che; FE02-AUTO-216-320/375 (+GH, +WEBKIT) PASS; A11Y-TARGET-001 PASS. Regression: FE01-ROUTE-004 (focus vẫn vào main), FE03-KBD-SKIP.

## R-06 · FND-019 (P3) — h1 cho "Workspace view not found"
Render tiêu đề trạng thái bằng `<h1>`. Acceptance: FE01-ROUTE-003.

## R-07 · FND-020 (P3) — Metadata release
Cập nhật `status` khi deploy (hoặc manifest deployment riêng), điền `manifestSelfHash`. Acceptance: manifest phản ánh deployment `bd44cfc0…`.

## R-08 · Môi trường nghiệm thu
Đã có: GitHub Actions + Playwright (trusted input, Firefox/WebKit, CDP). Còn cần: gói run 1 + CSV đầu vào + source (210 view, DEF, journey, UAT); Figma page per-view; AT thật; dữ liệu seed (tài liệu, source snapshot) để script SPEC/CODE/worker/tree.

## R-09 · FND-005 (P2) — Toast thành công cũ sau 401 / hết phiên
Khi client chuyển sang disconnected (401 hoặc `expiresAt`), gỡ các toast thành công/phiên còn hiển thị và hiện một toast/status duy nhất "Service session ended — reconnect" (`role=status`). Acceptance: FX-SERVICE-FND-005, FX-SVC-EXPIRY PASS. Regression: FX-SVC-* (stage toast vẫn đúng khi còn phiên).

## R-10 · FND-001 + FND-021 (P2) — Tabs
(a) Mỗi `role=tab` có `id` và `aria-controls` → container `role=tabpanel` có `aria-labelledby` ngược lại (`tabindex=0` nếu panel không chứa phần tử focus được).
(b) Tablist đổi view (IDE/Definitions/Service records): hoặc dùng kích hoạt thủ công (Arrow chỉ di chuyển focus, Enter/Space mới đổi view), hoặc sau khi view đổi khôi phục focus vào tab vừa chọn (giữ cùng DOM node bằng `key` ổn định).
Acceptance: FE03-KBD-TABS / -FIREFOX / -WEBKIT PASS (panelsLinked = số tab; arrowRight = tab kế; không rơi về body).

## R-11 · FND-022 (P3) — Heap sau chu kỳ điều hướng
Chủ sản phẩm chốt budget heap (thay giả định 10%). Nếu cần: kiểm tra subscriptions/listeners khi unmount module (ServiceModule, Definitions), cache theo route. Acceptance: PERF-008 theo budget chính thức; soak có mở/đóng editor.
