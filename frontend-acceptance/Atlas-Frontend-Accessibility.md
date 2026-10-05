# Atlas — Accessibility (run 2, 2026-10-05)

Phạm vi đo: 18 module route ở trạng thái mặc định (chưa kết nối service), Chromium phía Cloudflare (Browser Rendering), `input_mode=synthetic-DOM`. **Automated ≠ keyboard ≠ screen reader**: không có kết luận WCAG tổng thể.

Chuẩn đã đọc: xem `evidence/standards/README.md` (WCAG 2.2 SC + Understanding, APG Tree/Dialog/Combobox/Tabs từ nguồn biên tập chính thức trên GitHub; www.w3.org bị chặn egress).

## 1. Kết quả theo tiêu chí

| WCAG 2.2 | Phương pháp | Kết quả | Case / Finding |
|---|---|---|---|
| 1.4.10 Reflow (AA) | Detector: `scrollWidth > clientWidth`, control nằm ngoài viewport (trừ vùng cuộn ngang hợp lệ) ở 320/375/768/1280/1440, dark+light | 180/180 tổ hợp đo được: 0 overflow, 0 control ngoài viewport (trạng thái mặc định). 1920 BLOCKED. Zoom 200/400% thật NOT_RUN | FE02-AUTO-216-*, FE02-ZOOM-001 |
| 2.5.8 Target Size (Minimum) (AA) | Target <24×24 và vòng tròn 24 px giao target khác (đúng ngoại lệ Spacing) | **FAIL** — light@320/375: breadcrumb "Workspace" 64×18 sát nút "Navigation" (<12 px), 36 tổ hợp; dark và ≥768 px: 0 | A11Y-TARGET-001 · **FND-018 (P2)** |
| 1.4.3 Contrast (Minimum) (AA) | Tính từ computed style, trộn alpha nền; ≥4.5:1 (3:1 large) | 0 vi phạm trên 180 tổ hợp (≈30–85 phần tử text/route). Nền gradient/ảnh: 0 "unknown". Non-text contrast (1.4.11) chưa đo | FE02-AUTO-216-* |
| 4.1.2 Name, Role, Value (A) | Control hiển thị không có accessible name (xấp xỉ accname) | 0 control thiếu tên. Ghi chú: các nút icon header (theme, display preferences, help, navigation) đặt tên bằng `title` — hợp lệ theo accname nhưng nên có `aria-label` | FE02-AUTO-216-* |
| 2.4.2 Page Titled (A) | `document.title` sau mỗi route | **FAIL** — "Atlas · Workspace" cho cả 18 view | FE01-TITLE-001 · **FND-017 (P3)** |
| 1.3.1 / 2.4.6 Headings | đúng một h1 trong main; không nhảy cấp | 18/18 route: 1 h1, 0 nhảy cấp. Route lạ: không có h1 | FND-019 (P3) |
| 2.4.3 Focus order sau đổi view | `document.activeElement` sau hashchange | Quan sát: focus chuyển tới `MAIN#main` (programmatic). Chưa xác nhận bằng phím thật ⇒ NOT_RUN | FE01-ROUTE-004 |
| 2.1.1 Keyboard, 2.4.7, APG widgets | Phím thật | **BLOCKED** (không có trusted input) | FE03-KBD-001 |
| axe-core 4.10.2 | dark/light, 18 route + trạng thái kết nối + dialog | **BLOCKED** (quota Browser Rendering) | A11Y-AXE-001/002 |
| 1.4.12 Text spacing, reduced-motion, forced-colors | — | **BLOCKED** | FE03-MOTION-001 |
| AT thật | NVDA/VoiceOver | **NOT_RUN_AT** | FE03-AT-001 |

Kế thừa từ run 1 (`INHERITED_EVIDENCE`, chưa retest): FND-001 (tab/tabpanel), FND-011 (vùng cuộn bảng không focus được).

## 2. Kiểm chứng detector

Mỗi batch viewport chạy probe trong iframe `srcdoc` cùng origin với 6 lỗi cố ý (div rộng hơn viewport 300 px, nút `aria-label=""`, 2 nút 10×10 sát nhau, chữ #777 trên #888 = 1.26:1, h1→h3, nút lệch ra ngoài viewport). Probe hợp lệ (`valid=true`) ở cả 5 viewport đã chạy. Validate local trước bằng Playwright Chromium (`probe.html`) cho cùng kết quả.

## 3. Kịch bản thủ công cho AT (FE03-AT-001) — cần người thực hiện

Môi trường: NVDA 2024+ với Firefox ESR và Chrome stable (Windows); VoiceOver với Safari (macOS 15 / iOS 18). Deployment `bd44cfc0…`, URL ở trên. Ghi lại cho từng bước: thông báo đọc được, vai trò, trạng thái, vị trí focus.

1. Tải `/#home`: tiêu đề trang đọc là gì? Landmark list (header, navigation "Workspace navigation", main, breadcrumb) có đủ? Skip link "Skip to workspace" đưa focus vào main?
2. Tab qua header: "Open workspace navigation" (aria-expanded), "Open workspace search", "Switch display theme", "Display preferences", "Help & recovery" — tên/trạng thái có được đọc?
3. Mở workspace search (⌘K / Ctrl+K nếu có): combobox có `aria-expanded`, `aria-activedescendant` di chuyển theo phím mũi tên, Enter điều hướng, Escape đóng và trả focus (APG Combobox).
4. `#specifications`: tree "Library" — mũi tên lên/xuống/trái/phải, Home/End, typeahead (APG Tree View); tablist IDE/Definitions/Service records và Outline/Details/Properties/Acceptance — mũi tên trái/phải, Home/End, `aria-selected` (APG Tabs; FND-001).
5. Mở một dialog (ví dụ New document) rồi dialog lồng nếu có: focus vào dialog, nền inert, chỉ dialog trên cùng nhận Escape, đóng trả focus về nút mở (APG Dialog Modal).
6. `#connection`: nhập endpoint sai ⇒ thông báo lỗi có được đọc tự động (4.1.3 Status Messages)? Toast thành công/thất bại có `role=status`/`alert`?
7. Bảng operation journal (khi có dữ liệu): vùng cuộn có focus được và có tên (FND-011)?
8. Lặp lại 1–7 ở light theme và ở 320 px (VoiceOver iOS).
