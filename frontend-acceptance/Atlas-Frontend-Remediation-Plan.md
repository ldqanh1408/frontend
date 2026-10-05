# Atlas — Remediation Plan (đề xuất, AUDIT_ONLY)

Không có thay đổi nào được áp dụng vào sản phẩm hoặc Cloudflare. Mỗi mục là đề xuất kèm acceptance criteria và retest. Mọi closure cần: fix/build ref, repro trước sửa, retest cùng profile, regression, và **retest trên remote**.

## R-01 · FND-002 (P2) — Security headers / CSP
**Đề xuất patch** — thêm file `_headers` (không đuôi) vào thư mục static assets của build (Cloudflare Workers static assets đọc file này; nguồn: developers.cloudflare.com/workers/static-assets/headers/):

```txt
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; worker-src 'self' blob:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Cross-Origin-Opener-Policy: same-origin
```
**Rủi ro**: Monaco dùng inline style và có thể tạo worker từ `blob:`; `connect-src` phải chứa endpoint dịch vụ thật (Connection cho phép HTTPS tuỳ ý ⇒ cân nhắc allowlist). Thử trước ở chế độ `Content-Security-Policy-Report-Only`.
**Acceptance**: CF-PRE-005 PASS; 0 vi phạm CSP trong console khi mở Specifications/Code editor (6 worker khởi tạo), Connection tới fixture, import file.
**Regression**: FE04-WORKER-001, CODE-008, SPEC-*, FX-SERVICE-001, FE01-RUNTIME-001.

## R-02 · FND-003 (P2) — Cache asset băm
**Đề xuất patch** (cùng file `_headers`):
```txt
/assets/*
  Cache-Control: public, max-age=31536000, immutable
/fonts/*
  Cache-Control: public, max-age=31536000, immutable
```
Giữ `index.html` và `/release-manifest.json` ở mặc định revalidate. Lưu ý: `/fonts/*` không có hash trong tên ⇒ chỉ áp `immutable` nếu đổi tên khi thay nội dung (hoặc để `max-age=86400`).
**Acceptance**: CF-PRE-006 PASS; warm load không phát sinh request revalidate cho `/assets/*`.
**Regression**: PERF-007 warm, CF-PRE-002 (hash vẫn khớp).

## R-03 · FND-004 (P1, kế thừa) — 3/49 definition type không tạo được
Đề xuất: sinh tên mặc định không chứa "/" (hoặc nới validator cho phép "/" nếu spec cho phép). Acceptance: DEF-RETEST-FND-004 49/49. Cần `Atlas-Field-Dictionary.csv` + `schema_oracle.json` để retest.

## R-04 · FND-017 (P3) — Tiêu đề trang theo view
Đề xuất: trong effect đổi route, đặt `document.title = \`${viewTitle} · Atlas Workspace\`` (và cho trạng thái lỗi/không tìm thấy). Acceptance: FE01-TITLE-001 18/18 khác nhau và mô tả view; route lạ có tiêu đề riêng.

## R-05 · FND-018 (P2) — Target size breadcrumb ở light theme, mobile
Bước 1 (chẩn đoán, FE02-TARGET-001): đo rect breadcrumb link và nút "Navigation" ở dark vs light @320/375 để tìm style khác biệt theo theme. Bước 2: đảm bảo link breadcrumb có `min-height: 24px` (padding dọc) hoặc khoảng cách ≥ 12 px tới nút lân cận ở cả hai theme. Acceptance: A11Y-TARGET-001 và FE02-AUTO-216-320/375 PASS ở cả dark/light.

## R-06 · FND-019 (P3) — h1 cho trạng thái "Workspace view not found"
Đề xuất: render tiêu đề trạng thái bằng `<h1>`. Acceptance: FE01-ROUTE-003 có đúng một h1.

## R-07 · FND-020 (P3) — Metadata release
Đề xuất: tách manifest build và manifest deployment (hoặc cập nhật `status` khi deploy), điền `manifestSelfHash` (SHA-256 của manifest chuẩn hoá không gồm trường hash) và ký nếu có thể. Acceptance: manifest phản ánh deployment `bd44cfc0…`; self-hash kiểm được.

## R-08 · Môi trường nghiệm thu (không phải sản phẩm)
Để đóng các case BLOCKED: (a) cài Claude GitHub App cho `ldqanh1408/hehe` để push harness và chạy workflow Playwright (Chromium/Firefox/WebKit, trusted input, CDP throttling); hoặc (b) giữ pane Browser hiển thị trong Claude desktop; (c) cung cấp gói run 1 + CSV đầu vào + source; (d) AT thật.
