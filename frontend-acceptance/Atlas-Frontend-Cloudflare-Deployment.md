# Atlas — Cloudflare Deployment (run 2, 2026-10-05)

Mọi dữ liệu dưới đây là `OBSERVED_THIS_RUN` trừ khi ghi khác. Account ID và email đã được che (`[REDACTED]`).

## 1. Danh tính mục tiêu

| Mục | Giá trị | Nguồn |
|---|---|---|
| Provider | Cloudflare | plugin `mcp__cloudflare__execute` (GET) |
| PRIMARY_ACCEPTANCE_URL | `https://sparkling-snow-090d.ekko-okke666.workers.dev` | v2 §4; workers.dev subdomain `ekko-okke666` khớp metadata |
| Phân loại URL | `WORKER_URL` (= PRIMARY_ACCEPTANCE_URL). Không có PAGES_URL, CUSTOM_DOMAIN, DEPLOYMENT_PREVIEW_URL (previews_enabled=false) | `GET …/workers/scripts/sparkling-snow-090d/subdomain` |
| Worker | `sparkling-snow-090d` — assets-only (`has_modules=false`, `has_assets=true`, bindings `[]`), compat `2026-10-04`, usage_model standard | `GET …/workers/scripts` |
| Deployment | `bd44cfc0-1219-40d9-9c1a-b1b7fe84d085` — 2026-10-04T14:54:09.581Z, source `dash`, strategy percentage, "Automatic deployment on upload." | `GET …/deployments` |
| Version | `a8b5bc3a-63c9-4996-84e5-e8bc117775d3` (number 1, 100%) | `GET …/versions` |
| Assets config | `html_handling=auto-trailing-slash`, `not_found_handling=none`, `serve_directly=true`, `run_worker_first=false`, `base_path=/` | `GET …/versions/a8b5bc3a…` |
| Settings | observability.enabled=false (logs persist=true, invocation_logs=true), logpush=false, tail_consumers none | `GET …/settings` |
| Pages | không có project | `GET …/pages/projects` |
| Custom domain | không có | `GET …/workers/domains` |
| Zone / routes | account không có zone ⇒ không có zone route | `GET /zones?account.id=…` |
| So với run 1 | **MATCH** (worker, deployment, version, assets-only, compat, không Pages/domain/route) | — |
| Ghi chú | `script.modified_on` 2026-10-04T16:47:20Z muộn hơn deployment nhưng không có version/deployment mới ⇒ thay đổi settings (logs), không phải release | — |

## 2. Release / tương đương local–remote

| Mục | Kết quả |
|---|---|
| `/release-manifest.json` | `atlas-static-release/v1`, createdAt `2026-10-04T10:09:42.397Z`, 120 payload, bytes SHA-256 `0bf5b0288ac6ca988130961b8da55d18637a07dbf9a3d09ca97d5e1e4c09edd3` (20,241 B) |
| Băm lại trong browser | **120/120 khớp** SHA-256 + kích thước (19,291,874 B) — `CF-PRE-002` PASS, `EV-CF-501` |
| Trường lạ trong manifest | `status: BUILT_NOT_DEPLOYED_NOT_PRODUCTION_CERTIFIED`, `manifestSelfHash: null`, `backendE2E: NOT_RUN`, `browserAT: NOT_RUN` ⇒ FND-020 (P3) |
| Source revision | **UNVERIFIED** — không có source/commit trong phiên |
| Local build | **UNVERIFIED** — không có build log/artefact local |
| Remote/local equivalence | **UNVERIFIED** (chỉ chứng minh remote == manifest, không chứng minh manifest == source) |
| Bundle vào | `/assets/index-CNIcNnJO.js` (335,014 B), `/assets/ui-BHoQ7tHD.js` (modulepreload), `/assets/index-CGLbd-qV.css` — khớp bảng run 1 |
| Router | hash (`#home … #connection`, 18 module; query trong hash `#agents?authority=definitions&definition=…`) |

## 3. HTTP behaviour

| Kiểm tra | Kết quả | Case |
|---|---|---|
| Root | 200 `text/html`, zstd, `cf-cache-status: HIT` | CF-PRE-001 PASS |
| MIME | js `application/javascript` ×110 (gồm 6 worker), css `text/css` ×4, ttf `font/ttf` ×2, woff2 `font/woff2`, txt `text/plain` ×2, html | CF-PRE-003 PASS |
| Asset không tồn tại | `/assets/__atlas_probe_missing__.{js,css}` ⇒ 404, 0 B, không trả shell | CF-PRE-004 PASS |
| Security headers | **Không có** CSP, X-Content-Type-Options, Referrer-Policy, X-Frame-Options/frame-ancestors, Permissions-Policy, HSTS, COOP | CF-PRE-005 FAIL (FND-002) |
| Cache | **Mọi** payload (kể cả asset băm) `public, max-age=0, must-revalidate` + weak ETag (119/120) — đúng mặc định Workers static assets | CF-PRE-006 FAIL (FND-003) |
| Path-style deep link | `/home`, `/connection` ⇒ 404 (not_found_handling=none) — ngoài hợp đồng router hash | CF-PRE-007 N/A |
| Hash deep link + refresh | 18/18 route đúng h1 sau direct load và reload; Back/Forward; query giữ sau reload; route lạ có trạng thái "Workspace view not found" | CF-PRE-008, FE01-ROUTE-001…003 PASS |

## 4. Plugin / công cụ đã dùng

| Công cụ | Dùng cho | Trạng thái |
|---|---|---|
| `mcp__cloudflare__execute` GET | scripts, deployments, versions, settings, subdomain, domains, pages, zones | OK (chỉ đọc) |
| `mcp__cloudflare__execute` POST `browser-rendering/content` | Chromium phía Cloudflare tải URL public; script audit chèn bằng `addScriptTag`; **không** đổi cấu hình account | OK tới 07:27Z, sau đó `2001 Rate limit exceeded` (`BLOCKED_CLOUDFLARE_BROWSER_QUOTA`, gói Free 10 phút/ngày) |
| `mcp__cloudflare__docs` | tài liệu headers/cache static assets, giới hạn Browser Run | OK |
| Không dùng | token/API riêng, wrangler, bất kỳ PUT/PATCH/DELETE hoặc POST thay đổi cấu hình | — |

Sandbox shell không truy cập được `workers.dev` (proxy CONNECT 403). Không có pane Browser trong phiên cloud này.

## 5. Redaction

Account ID, email tác giả deployment (`author_email`), NEL report token: đã che/loại khỏi evidence. Không có secret, token, CSRF hoặc auth header nào được thu thập.
