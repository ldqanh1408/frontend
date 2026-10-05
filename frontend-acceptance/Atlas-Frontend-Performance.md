# Atlas — Performance (run 3, GitHub Actions, 2026-10-05)

**FE-05: FAIL** — tải trang và INP đạt budget, nhưng CF-PRE-006 (FND-003, cache) và PERF-008 (FND-022, heap so với budget giả định) FAIL; PERF-006/009/WORKLOAD chưa chạy.

Budget khoá **trước** khi đo (07:30Z), theo ngưỡng "good" của `GoogleChrome/web-vitals`: LCP p75 ≤ 2500 ms · FCP p75 ≤ 1800 ms · CLS p75 ≤ 0.1 · INP ≤ 200 ms; heap ≤ +10%/30 chu kỳ là `ASSUMPTION` (cần chủ sản phẩm xác nhận). Browser: Chromium 141.0.7390.37 (Playwright, GitHub Actions ubuntu-latest).

## PERF-007 — tải trang #home (10 lượt mỗi profile)

| Profile | FCP p50/p75/p95 (ms) | LCP p50/p75/p95 (ms) | CLS p75 | TTFB p75 | load p75 | Budget |
|---|---|---|---|---|---|---|
| cold_desktop | 164/168/244 | 164/168/244 | 0.0008 | 42 | 111 | PASS |
| warm_desktop | 80/80/80 | 80/80/80 | 0 | 18 | 50 | PASS |
| cold_mobile_throttled | 1228/1236/1244 | 1228/1236/1244 | 0 | 42 | 1097 | PASS |

Profile mobile: 375×812 isMobile, CPU 4×, 1.6 Mbps xuống / 0.75 Mbps lên, RTT 150 ms (CDP). Phần cứng runner GitHub, không phải điện thoại thật.

## PERF-INP-001 — 37 tương tác thật (nav ×18, tab ×7, theme ×6, Ctrl+K/Escape ×3, gõ phím)

| Profile | Tương tác | p50 | p75 | p95 | INP | Budget |
|---|---|---|---|---|---|---|
| desktop | 37 | 16 | 16 | 24 | 40 ms | PASS |
| cpu4x | 37 | 16 | 40 | 64 | 72 ms | PASS |

(Tương tác < 16 ms không sinh entry Event Timing và được tính là 16 ms. R3-003 chỉ có 29 tương tác nên đã chạy lại.)

## PERF-008 — 30/60/90 chu kỳ điều hướng (5 route/chu kỳ), heap sau GC

| Mốc | JS heap | Nodes | Listeners |
|---|---|---|---|
| sau warm-up | 3,341,804 | 475 | 197 |
| 30 chu kỳ | 3,966,080 | 552 | 210 |
| 60 chu kỳ | 4,085,588 | 370 | 187 |
| 90 chu kỳ | 4,154,232 | 462 | 200 |

Tăng 18.7% sau 30 chu kỳ (R3-003: 18.6%) ⇒ FAIL so với budget giả định 10% (FND-022, P3). Từ 30→60→90 chỉ +3,0% rồi +1,7%, nodes/listeners dao động ⇒ giống warm-up/cache hơn rò rỉ; cần budget chính thức và soak có mở/đóng editor.

## Chưa chạy
PERF-006 (chi phí import), PERF-009 (gõ/cuộn 1k/10k/100k dòng), PERF-WORKLOAD-001 (10k file, 10k hàng, 100 task + 10k log, 1k node): cần fixture dữ liệu; harness đã có hạ tầng CDP để chạy.
