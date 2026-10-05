# Chuẩn tham chiếu đã đọc (v2 §8.5) — 2026-10-05

Đường truy cập: `www.w3.org` và `web.dev` bị proxy egress chặn (WebFetch trả `EGRESS_BLOCKED`), nên đọc **nguồn biên tập chính thức** trên GitHub (raw.githubusercontent.com). Mỗi file có URL + SHA-256 trong `standards-index.json`.

| Chuẩn | Nguồn đã đọc | Ghi chú dùng trong run |
|---|---|---|
| WCAG 2.2 SC 1.4.10 Reflow, 2.5.8 Target Size (Minimum), 1.4.3 Contrast (Minimum), 1.4.11 Non-text Contrast, 2.1.1 Keyboard, 4.1.2 Name/Role/Value, 4.1.3 Status Messages, 2.4.11 Focus Not Obscured (Minimum), 2.4.2 Page Titled, 1.4.12 Text Spacing | `w3c/wcag@main` `guidelines/sc/**` | Văn bản SC dùng làm oracle cho detector FE02 (320 CSS px, 24×24 + ngoại lệ spacing bằng vòng tròn 24 px, 4.5:1 / 3:1 large ≥24px hoặc ≥18.66px bold) |
| Understanding: Reflow, Target Size Minimum, Contrast Minimum, Non-text Contrast, Keyboard, Name/Role/Value, Status Messages, Focus Not Obscured | `w3c/wcag@main` `understanding/**` | |
| WAI-ARIA APG: Tree View, Dialog (Modal), Combobox, Tabs | `w3c/aria-practices@main` `content/patterns/**` | Kịch bản bàn phím FE03-KBD-001 (chưa chạy được vì không có trusted input) |
| Core Web Vitals thresholds | `GoogleChrome/web-vitals@main` `src/on{LCP,INP,CLS,FCP}.ts` | LCP [2500, 4000] ms · INP [200, 500] ms · CLS [0.1, 0.25] · FCP [1800, 3000] ms (p75) |
| ui-ux-pro-max-skill | pin `09170eec67eefd46a7ae85de61b40c194020f997` README | Chỉ tham khảo heuristics; không coi là chứng nhận |
| Cloudflare Workers static assets — Headers | `developers.cloudflare.com/workers/static-assets/headers/` (Last updated Sep 22, 2026) qua `mcp__cloudflare__docs` | Mặc định `Cache-Control: public, max-age=0, must-revalidate` + ETag; header tuỳ biến qua file `_headers` (CSP, nosniff, `immutable` cho asset băm) |

Không tài liệu nào ở trên được coi là chứng nhận tuân thủ; chúng chỉ là oracle cho expected result.
