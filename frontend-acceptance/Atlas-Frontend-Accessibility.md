# Atlas — Accessibility (run 2 + run 3, 2026-10-05)

Môi trường: Cloudflare Browser Rendering (Chromium, synthetic-DOM) cho detector ở run 2; GitHub Actions + Playwright 1.56.1 (Chromium 141, Firefox 142, WebKit 26) với **trusted keyboard/pointer** ở run 3. **Automated ≠ keyboard ≠ screen reader**: không có kết luận WCAG tổng thể khi AT thật chưa chạy.

Chuẩn đã đọc: `evidence/standards/README.md` (WCAG 2.2 SC + Understanding, APG Tree/Dialog/Combobox/Tabs từ nguồn biên tập chính thức).

## 1. Kết quả theo tiêu chí

| WCAG 2.2 / APG | Phương pháp | Kết quả | Case / Finding |
|---|---|---|---|
| 1.4.10 Reflow (AA) | Detector (overflow, control ngoài viewport), 18 route × 6 width × dark/light | 0 overflow, 0 control ngoài viewport ở mọi width/engine (trạng thái mặc định). Zoom 200/400% thật chưa script | FE02-AUTO-216*, FE02-ZOOM-001 |
| 2.5.8 Target Size (Minimum) (AA) | Target <24×24 + ngoại lệ Spacing; hit-test sau điều hướng | **FAIL** — sau khi đổi view từ ngoài `<main>` (menu mobile, sidebar desktop, nút header) trang cuộn 52–60 px, link breadcrumb "Workspace" nằm dưới header cố định (bị nút menu/thanh header che). Chromium + WebKit; Firefox không bị | A11Y-TARGET-001, FE02-SCROLL-001-* · **FND-018 (P2)** |
| 1.4.3 Contrast (Minimum) (AA) | Computed style + axe `color-contrast` | 0 vi phạm (dark + light) | FE02-AUTO-216*, A11Y-AXE-001, A11Y-AXE-002-DEFAULT |
| 4.1.2 Name, Role, Value (A) | Detector + axe | 0 control thiếu tên; **FAIL** quan hệ tab↔tabpanel (không `aria-controls`, không `role=tabpanel`) | **FND-001 (P2)** — FE03-KBD-TABS* |
| 2.4.2 Page Titled (A) | `document.title` mỗi route | **FAIL** — "Atlas · Workspace" cho cả 18 view | FE01-TITLE-001 · FND-017 (P3) |
| 2.4.1 Bypass Blocks (A) | Tab#1 + Enter (trusted) | PASS 3 engine: "Skip to workspace" → focus vào `main`, view giữ nguyên `#home` | FE03-KBD-SKIP* |
| 2.1.1 / 2.4.3 / 2.4.7 / 2.4.11 | Chuỗi Tab tới hết trang (39 điểm dừng), so style focus/unfocus, hit-test | PASS 3 engine: mọi điểm dừng hiển thị, trong viewport, không bị che, có chỉ báo focus khác trạng thái thường. Firefox có thêm điểm dừng ở vùng cuộn `nav` | FE03-KBD-TABSEQ* |
| 2.4.3 sau đổi view | Enter trên link nav (trusted) | PASS 3 engine: hash đổi, focus vào `main#main` | FE01-ROUTE-004* |
| APG Combobox | Ctrl+K, gõ, ArrowDown, Enter, mở lại + Escape | PASS 3 engine: dialog modal + combobox, `aria-activedescendant` di chuyển, Enter điều hướng, Escape đóng và trả focus về "Open workspace search" | FE03-KBD-SEARCH* |
| APG Dialog (Modal) | Help & recovery, Display preferences | PASS 3 engine: `role=dialog aria-modal`, nền inert, Tab giữ trong dialog 14/14, Escape đóng, focus về nút mở | FE03-KBD-DIALOG-* |
| Drawer mobile | 375 px, Tab → Enter → Escape | PASS 3 engine: `aria-expanded` true, dialog modal với 18 link, focus vào "Close", Escape đóng, focus về nút menu | FE03-KBD-NAV-MOBILE* |
| APG Tabs | Arrow/Home/End, roving tabindex | Tablist "Document inspector": PASS hành vi phím; tablist "Specifications workspace": **FAIL** — ArrowRight làm view đổi và focus rơi về `<body>` (3 engine) | **FND-021 (P2)** |
| APG Tree View | — | N/A: thư viện trống trên profile mới (cần seed tài liệu) | FE03-KBD-TREE* |
| axe-core 4.10.2 | 18 route, dark + light, trạng thái mặc định | **0 vi phạm** (wcag2a/2aa/21a/21aa/22aa). Trạng thái kết nối + dialog mở chưa quét | A11Y-AXE-001, A11Y-AXE-002-DEFAULT, A11Y-AXE-002 (NOT_RUN) |
| 1.3.1 / 2.4.6 Headings | 1 h1/route, không nhảy cấp | PASS 18 route; route lạ không có h1 | FND-019 (P3) |
| 1.4.12, reduced-motion, forced-colors | — | NOT_RUN (chưa script; Playwright emulateMedia có sẵn) | FE03-MOTION-001 |
| AT thật | NVDA/VoiceOver | **NOT_RUN_AT** | FE03-AT-001 |

Kế thừa run 1 chưa retest: FND-011 (vùng cuộn bảng không focus được — bảng journal chỉ có dữ liệu khi đã gửi lệnh; cần thêm bước vào suite fxservice).

## 2. Kiểm chứng công cụ
- Detector: probe 6 lỗi cố ý mỗi batch viewport, `valid=true` ở mọi lượt (Cloudflare và GitHub).
- Keyboard: R3-003 có 4 kiểm tra lỗi harness (cuối chuỗi Tab tính là "ẩn", mở lại search bắt đầu trong `main`, tablist bị remount, đọc `aria-expanded` sai phần tử). Đã sửa, kiểm lại trên mirror cục bộ, chạy lại ở R3-004; kết quả R3-003 cho các case đó bị thay thế, không tính FAIL.

## 3. Kịch bản thủ công cho AT (FE03-AT-001)
NVDA 2024+ với Firefox ESR và Chrome; VoiceOver với Safari (macOS 15 / iOS 18). Ghi thông báo đọc được, vai trò, trạng thái, vị trí focus.
1. `/#home`: tiêu đề trang; landmark (header, navigation "Workspace navigation", main, breadcrumb); skip link.
2. Header: "Open workspace search", "Switch display theme", "Display preferences", "Help & recovery" (tên đặt bằng `title`), menu mobile (`aria-expanded`).
3. Ctrl+K: combobox đọc số kết quả? option đang chọn được đọc khi ArrowDown?
4. `#specifications`: tab IDE/Definitions/Service records (FND-021 — focus mất?), tab Outline/Details/Properties/Acceptance (FND-001 — panel có được liên kết?).
5. Dialog Help & recovery / Display preferences: tên dialog (hiện `aria-label` rỗng trong DOM — cần kiểm tra `aria-labelledby`).
6. `#connection`: lỗi endpoint có được đọc (4.1.3)? toast `role=status/alert`? sau khi ngắt kết nối, toast cũ (FND-005) có được đọc lại?
7. Bảng journal sau khi gửi lệnh: vùng cuộn có focus/tên (FND-011)?
8. Lặp lại ở light theme và 320 px.
