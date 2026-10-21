# Atlas — Handoff frontend, kiểm tra đầy đủ và SRS/ADR, 08/10/2026

Đã hoàn tất một lượt kiểm tra frontend đầy đủ trên source mới. Người dùng chốt phạm vi frontend trong repo này; backend là phần tích hợp riêng. Repo người dùng xác nhận: [ldqanh1408/frontend](https://github.com/ldqanh1408/frontend). **Chưa nghiệm thu E2E nghiệp vụ backend hoặc deploy/staging.** Chưa push hay thay đổi PR; gate duyệt UI trước deploy vẫn giữ.

## Kết quả trên source hiện tại

| Kiểm tra | Kết quả |
|---|---|
| Typecheck, production build, review build | Đạt |
| Unit/component | 78 đạt, 0 lỗi |
| Release tooling | 7 đạt, 0 lỗi |
| Full functional, Chromium/Firefox/WebKit | 1,701 đạt, 9 skip, 0 lỗi, 0 flaky |
| Visual Linux Chromium | 150 đạt, giữ ngưỡng diff 0,5% |
| Performance desktop local | 8 đạt; LCP <2.500 ms, CLS <0,1, JS ban đầu <512 KiB |
| Review UI, ba engine | 174 đạt, 0 lỗi |
| Release reproducibility cùng runtime digest, checkpoint 15 | 126/126 file giống hash |

Đây là một pipeline mới `20261008-complete` đạt từ đầu đến cuối, không ghép các lượt sửa/kiểm lại. Mỗi engine có 567 ca functional đạt và 3 ca release/staging có điều kiện skip do chưa có target đã deploy. Các raw FAIL của checkpoint cũ vẫn giữ riêng. Test/config/baseline 172 file khớp commit local `0e3dfc9`; snapshot này lấy trong khi chạy, không được mô tả là đo trước khi chạy. Runtime digest được runner kiểm đầu/cuối không đổi.

Digest: `77cdc3b38905142365bb758b060be0a16e4f7b5335fe91c4c7a79d1054ce8bf3`. Release archive `local-conformance`, buildId `source-77cdc3b389051423`, sourceCommit null. Runtime không đổi nên dùng lại bằng chứng build/rebuild checkpoint 15; không tuyên bố đã tạo release Git-pin hoặc deploy mới. Local Linux visual/performance chưa chứng minh Ubuntu CI, mạng production hoặc NFR realtime. Timing peer có overhead test; quan sát presence cao nhất trong lượt đầy đủ là 534 ms (checkpoint 15 focused: 429 ms), không chứng nhận NFR <200 ms.

## PR fix/secret-handling

[PR #1](https://github.com/ldqanh1408/frontend/pull/1) vẫn ở head `0e8cf8340f0f90bc3dee5a5e37019450bfcda24f`, chưa merge, chưa có commit status/check run trên head. **Cần sửa trước merge:**

| Mức | Lỗi tái hiện tại PR head |
|---|---|
| P1 | Environment map KEY/name/key/env/variable bỏ qua secret policy |
| P1 | Hash secret thành `[secret]`, làm hai input khác nhau cùng fingerprint |
| P1 | Import tạo draft/revision trước khi kiểm secret, lưu plaintext IndexedDB |
| P1 | Rejected reason/effect có thể echo secret vào journal/UI |

29 test gốc của PR đạt; 4 kiểm tra bảo mật mới đều thất bại. Source handoff đã sửa trước persistence/download, giữ exact canonical fingerprint, che/clear input và bỏ sensitive response khi reconcile. Backend vẫn phải redact logs/traces/artifacts và scan toàn bộ generated diff bằng regex+entropy. Chi tiết/permalink/raw trong `ui-review/PR-1-SECRET-HANDLING-REVIEW.md` và `ui-review/evidence/conformance-20261008/pr-review/`. Remote PR chưa được sửa; không tính số test trong PR body là CI độc lập.

## SRS/ADR và nghiệm thu thật

Hai tài liệu giữ nguyên byte/hash trong `docs/specifications/`. Ma trận đủ 35 FR, 10 NFR, 40 BR, 27 EX, 19 ADR, 14 giả định, 19 cấu hình. `docs/SRS-ADR-CONFORMANCE.md` ghi phần frontend và nghĩa vụ còn lại; `docs/LIVE-E2E-ACCEPTANCE.md` định nghĩa Luồng 0–7 và Observer, happy/negative/recovery cùng effect/audit/artifact proof.

Repo remote hiện có hai nhánh, default `claude/sharp-thompson-5tff91` ở `4737b155e9f106bc7351c271d19ef207cfbb9a66`. Kiểm cây commit này không tìm thấy Java, Maven/Gradle hoặc Compose/Dockerfile theo các filename đã ghi. Điều đó chưa xác định được backend bên ngoài repo. Cần source/endpoint backend, contract được duyệt, GitHub App test installation, tenant fixtures và hai HTTPS origin với audience/cookie độc lập để chạy J0–J7/O1. Các journey vẫn NOT_RUN; UI/journal/protocol peer không thay bằng chứng nghiệp vụ.

Bảy xung đột SRS/ADR còn cần chốt: snapshot latest commit vs exact base_commit; raw reasoning vs structured state; ngưỡng drift; latency terminal; allowed config layers; enum mapping; BR-GAP-05 thiếu định nghĩa. Handoff theo exact snapshot base và structured progress của ADR-004, chưa coi backend đã giải quyết tất cả.

## Tiếp quản và triển khai

Checkpoint 16 trong `HANDOFF.md`; kết quả mới `ui-review/verification-complete-20261008.json`, raw/hash tại `ui-review/evidence/complete-20261008/`. Checkpoint 13–15 giữ làm lịch sử. Nhánh local `handoff/frontend-e2e`; patch mới nối tiếp local `0e3dfc9`, provenance ở `ui-review/complete-source.json`. Source ZIP đã chứa thay đổi, không apply patch lần nữa.

Chạy lại từ `frontend/atlas-web`: `npm ci`, cài ba browser bằng `npx playwright install --with-deps chromium firefox webkit`, rồi `npm run verify`. Container này dùng `ATLAS_CONTAINER_BROWSER=1`; CI giữ sandbox bình thường. Review UI: `npm run build:review` rồi `npm run preview:review`, cổng 4174.

GitHub đủ cho review/CI/source; Cloudflare giúp kiểm version/config/log và deploy sau gate UI. Playwright đã có sẵn; không cần thêm plugin để kiểm frontend. `docs/DEPLOY-ACCEPTANCE.md` giữ các gate release Git-pin, hai origin, exact build ID và nghiệm thu backend/manual NVDA/VoiceOver.

Automatic approval review trước đó đã từ chối push dry-run vì chưa xác nhận xuất source/evidence tới remote. Link repo hiện xác định target; chưa gửi lại push hoặc dùng connector để vượt qua từ chối. Chưa có GitHub/Cloudflare write.
