# Atlas — Handoff đối chiếu SRS/ADR và review PR, 08/10/2026

Đã cập nhật frontend và gói bàn giao theo hai tài liệu. **Chưa nghiệm thu toàn bộ E2E nghiệp vụ:** source cung cấp chưa có backend Java/Temporal/database/Compose; contract và môi trường thật còn thiếu. Chưa push, merge hoặc deploy; gate duyệt UI vẫn giữ.

## PR fix/secret-handling

[PR #1](https://github.com/ldqanh1408/frontend/pull/1), head `0e8cf8340f0f90bc3dee5a5e37019450bfcda24f`: **cần sửa trước merge**. 29 test hiện có đạt nhưng 4 kiểm tra mới tái hiện lỗi đều thất bại:

| Mức | Vấn đề | Hệ quả |
|---|---|---|
| P1 | Environment map KEY/name/key/env/variable được bỏ qua | Literal secret không bị chặn |
| P1 | Secret bị đổi thành `[secret]` trước khi hash | Hai secret khác nhau có cùng fingerprint; mất binding với input thật |
| P1 | Import tạo draft/revision trước kiểm tra UI | Plaintext được lưu IndexedDB |
| P1 | Rejected reason có thể echo input | Secret được ghi vào journal và feedback |

Remote PR chưa thay đổi. Các sửa trong handoff được áp dụng vào source continuation mới nhất, giữ các tích hợp scope/realtime/Observer/release. Chi tiết và permalink dòng code trong `ui-review/PR-1-SECRET-HANDLING-REVIEW.md`; reproduction/raw logs ở `ui-review/evidence/conformance-20261008/pr-review/`. GitHub hiện chưa có status/check run trên head này; số Playwright trong PR body không được coi là CI độc lập đã xác minh.

## Các sửa đã hoàn thành

- Shared secret policy trước create/save/import/duplicate/export, cả preserved fields, legacy revisions và unsaved/recovery downloads; thất bại không tạo draft/revision mới. Cho phép vault maps và descriptor rõ ràng, chặn exemption theo tên map. Không sửa/xoá lịch sử dữ liệu người dùng.
- Service input được che và clear trên mọi outcome; fingerprint vẫn hash exact canonical payload. Không lưu input; sensitive response reason/evidence bị loại khỏi receipt kể cả reconcile sau reload. Fingerprint không phải mã hóa; backend phải bảo vệ/log-redact secret và scan toàn bộ generated diff bằng regex+entropy.
- Sửa null config inheritance, giữ zero/false/source/revision. Bổ sung PR-triggered frontend CI. Workflow audit lịch sử chỉ đọc/upload artifact, không tự commit/push và không ignore failure. CI này mới nằm local.

## Kiểm chứng source cuối

| Kiểm tra | Kết quả / phạm vi |
|---|---|
| Typecheck + production build | Đạt |
| Unit/component | 78/78 |
| Release tooling | 7/7 |
| Browser focused | 57/57, Chromium/Firefox/WebKit; definitions, service, realtime, scope switch |
| Release build/rebuild | 126/126 file cùng hash |
| Full-system/backend E2E, deploy/staging, NVDA/VoiceOver | Chưa chạy |

Release `local-conformance`: buildId `source-77cdc3b389051423`, digest `77cdc3b38905142365bb758b060be0a16e4f7b5335fe91c4c7a79d1054ce8bf3`; sourceKind archive, sourceCommit null, chưa cấu hình origin production. Release này không thể thay artifact Git-pin cho deploy. Release `local-acceptance` và bằng chứng broad/visual/perf trước đây giữ làm lịch sử; không dùng để tuyên bố source mới có một full-suite PASS. Raw unit assertion thất bại ở một lượt sửa message vẫn được giữ, cùng lượt kiểm lại đạt.

Một quan sát presence local là276ms; test gồm overhead của Playwright. Không chứng nhận NFR<200ms từ các test functional này. Cần đo realtime/terminal throughput và AST/conflict latency trên backend/mạng thật.

## Đối chiếu hai tài liệu

Giữ nguyên hai tài liệu và hash trong `docs/specifications/`. Registry truy vết **35 FR, 10 NFR, 40 BR, 27 EX, 19 ADR, 14 giả định, 19 cấu hình**; mỗi mục ghi rõ phần frontend và nghĩa vụ backend/live còn lại. Báo cáo chính: `docs/SRS-ADR-CONFORMANCE.md`, registry: `docs/requirements-traceability.json`.

Bảy điểm cần chốt gồm: snapshot latest commit vs exact base_commit; raw chain-of-thought vs structured state; drift warning0.5 vs in-sync0.3; terminal<200ms vs peak<=300ms; allowed config layers; enum mapping; BR-GAP-05 chưa có định nghĩa. Handoff theo ADR-004 cho exact snapshot base và structured progress/resume, nhưng không tự tuyên bố backend đã giải quyết các mâu thuẫn.

`docs/LIVE-E2E-ACCEPTANCE.md` lập đầy đủ Luồng0–7 và Observer: onboarding → spec/merge/lock → explicit Submit → memory/AST → Proposed DAG → human approval/checkpoint → sandbox/lock/budget/recovery → secret/risk/multi-sig → PR/CI → post-merge drift/Implemented/cleanup → episodic human curation. Có ca lỗi và yêu cầu effect/audit/artifact proof từng bước. Tất cả hiện **NOT_RUN** vì thiếu backend source/API contract, GitHub App test installation, scoped fixtures và hai HTTPS origin/cookie độc lập. Không dùng UI screenshot/journal hoặc test peer làm bằng chứng nghiệp vụ.

## Deploy và plugin

GitHub đã đủ cho review source/PR và kiểm CI; Playwright đã có sẵn cho browser checks. Cloudflare phù hợp khi deploy Workers/version/log sau duyệt UI và authorization. Plugin không thay được backend, contract và các bằng chứng E2E còn thiếu. Không cần cài thêm plugin chỉ để chạy phần kiểm chứng frontend đã hoàn thành.

Handoff hiện tại ở checkpoint15 của `HANDOFF.md`; kết quả/hash/raw tại `ui-review/verification-conformance-20261008.json` và `ui-review/evidence/conformance-20261008/`. Các patch local tiếp nối checkpoint14, remote chưa thay đổi.

Automatic approval review trước đó đã chặn push dry-run do chưa xác nhận xuất source/evidence tới remote. Phiên này không gửi lại push và không thực hiện GitHub/Cloudflare write. Deployment vẫn cần duyệt UI theo handoff.
