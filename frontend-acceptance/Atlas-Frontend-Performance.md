# Atlas — Performance (run 2, 2026-10-05)

**FE-05: FAIL** (CF-PRE-006 / FND-003 tái hiện) **và không có số đo hiệu năng nào trong run này** — mọi chỉ số là `null` với lý do trong `Atlas-Frontend-Performance.json`.

## Budget đã khoá trước khi đo
Không có budget v1 §11.5 trong phiên ⇒ khoá mặc định theo ngưỡng "good" của `GoogleChrome/web-vitals` (đọc 2026-10-05, xem `evidence/standards/`): LCP p75 ≤ 2500 ms · FCP p75 ≤ 1800 ms · CLS p75 ≤ 0.1 · INP p75 ≤ 200 ms (`ASSUMPTION`, cần chủ sản phẩm xác nhận).

## Trạng thái case

| Case | Yêu cầu | Trạng thái | Blocker |
|---|---|---|---|
| PERF-007 | ≥10 cold + ≥10 warm, desktop + mobile (CPU 4×, 1.6/0.75 Mbps, 150 ms) | BLOCKED | Hết quota Browser Rendering; throttling cần CDP |
| PERF-INP-001 | ≥30 tương tác, p50/p75/p95 | BLOCKED | Không có trusted input (Event Timing bỏ qua event tổng hợp) |
| PERF-006 | chi phí import theo kích thước thư viện | BLOCKED | quota |
| PERF-008 | 30 chu kỳ mở–đóng editor/route | BLOCKED | quota + trusted input |
| PERF-009 | gõ/cuộn file 1k/10k/100k dòng | BLOCKED | trusted input |
| PERF-WORKLOAD-001 | Code 10k file, Observation 10k hàng, Execution 100 task + 10k log, Graph 1k node | BLOCKED | quota |
| CF-PRE-006 | asset băm `immutable` | **FAIL** | FND-003 |

## Dữ kiện tĩnh (không phải số đo)
- 120 payload, 19,291,874 B; lớn nhất: `ts.worker` 6.93 MB, `semantic.worker` 3.46 MB, `editor.api` 2.74 MB, `editor-engine` 1.32 MB, `css.worker` 1.08 MB.
- Entry: `index-CNIcNnJO.js` 335 KB, `ui-BHoQ7tHD.js` 25 KB, `index-CGLbd-qV.css` 33 KB; nén zstd.
- Mọi payload `max-age=0, must-revalidate` ⇒ mỗi lần tải lại phải revalidate (304) toàn bộ asset đã tải.

## Cách nghiệm thu tiếp
Harness Playwright trong `harness/` + workflow `.github/workflows/atlas-acceptance.yml` (cần cài Claude GitHub App để push) cho phép CDP throttling, trusted input và ≥10 run; hoặc pane Browser hiển thị trong Claude desktop; hoặc chạy lại Browser Rendering sau khi quota reset (00:00 UTC) cho phần cold/warm không throttling.
