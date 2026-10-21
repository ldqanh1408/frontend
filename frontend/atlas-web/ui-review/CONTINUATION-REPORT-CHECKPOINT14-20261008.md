# Atlas — Handoff frontend và release, 08/10/2026

Đã hoàn thiện phần release/QA của handoff và đóng gói source cùng bằng chứng local. Chưa nghiệm thu E2E nghiệp vụ với backend thật, chưa push hoặc deploy. Gate duyệt UI trước deployment vẫn giữ.

## Thay đổi đã thực hiện

- Tách Worker Workspace/Observer, dùng đúng entry và audience; kiểm hash/độ dài trước khi phục vụ dữ liệu cache hoặc upstream. Giữ security headers, cache, HEAD/ETag và trả lỗi rõ ràng.
- Release ghi source digest và hai entry; source ZIP có build ID theo digest, không gán SHA Git không được quan sát. Release từ archive không thể tạo Worker pin tới Git.
- Staging cần hai HTTPS origin và build ID chính xác. CI thất bại khi cấu hình/test lỗi, upload evidence; không tự commit, push hoặc deploy. Bước reproducibility mới build/rebuild source của commit hiện tại và lưu release artifact; chính lệnh đó đã kiểm local 125/125 file giống nhau, chưa phải GitHub CI run.
- Thêm runner nghiệm thu có thư mục/log/JSON riêng và ghi trạng thái ngắt. Giữ raw lỗi và trace; không sửa kết quả cũ thành PASS.
- Sửa focus ban đầu dưới StrictMode và thêm hai unit test. Riêng lỗi WebKit trong full-suite là race của test: Tab được gửi khi React chưa mount. Đã chờ control hiển thị, giữ assertion/timeout. Tắt Firefox updater trong automation để tránh request nền bị môi trường chặn.

145 file application gốc đã được đối chiếu với ZIP: chỉ `src/shell/page-meta.tsx` thay đổi, thêm `src/shell/page-meta.test.tsx`. Chi tiết source/digest và patch nằm trong `ui-review/continuation-source.json` và `ui-review/continuation-patches/`.

## Kết quả nghiệm thu local

| Kiểm tra | Kết quả |
|---|---|
| Typecheck; production/review build | Đạt |
| Unit/component | 56/56 |
| Release tooling | 7/7 |
| Full functional trước sửa focus | 1.694 đạt, 1 lỗi WebKit skip-link, 9 skip; raw FAIL giữ nguyên |
| Shell/IDE sau sửa, ba engine | 48/48 |
| Skip-link lặp, ba engine | 30/30 |
| Visual Linux Chromium | 150/150; giữ ngưỡng diff 0,5% |
| Performance local | 8/8; giữ ngân sách cũ |
| Review state/labels/Execution, ba engine | 174/174 |
| Coverage functional gần nhất, có nguồn từng case | 1.695 đạt, 9 skip; tổng hợp nhiều lượt |
| Release local, hai lần build | 125/125 file giống hash |
| Lệnh CI reproducibility kiểm local | 125/125; chưa có GitHub run của source cuối |
| Thiếu target staging; Worker pin từ archive | Bị từ chối đúng; không gửi request staging |

Không có một raw run full functional toàn bộ xanh của source cuối. Các ca liên quan thay đổi đã kiểm lại; coverage tổng hợp không thay thế CI của commit cuối. Các lượt bị ngắt do đổi setup/worker hoặc Firefox updater được giữ riêng. Bằng chứng có trong `ui-review/verification-20261008.json` và `ui-review/evidence/acceptance-20261008/index.json`.

Perf dùng desktop local không throttling; không chứng nhận NFR production. Visual đã đạt local Linux, chưa chứng minh baseline Ubuntu CI. Protocol peers trong test không chứng minh hiệu ứng backend thật.

## Release có thể xem lại

`release/local-acceptance/` chứa hai entry, 125 file và manifest. Build ID: `source-64e0c7e1432138b0`; source digest: `64e0c7e1432138b0d9e2f084a2e354b526a2f05ac092335e900c0fe06fcc28bb`. Metadata ghi `sourceKind: archive`, `sourceCommit: null`; chưa cấu hình origin production, chưa deploy hoặc pin remote. Không dùng Worker/staging metadata lịch sử để nghiệm thu source mới.

Chạy lại từ source:

```bash
cd frontend/atlas-web
npm ci
npx playwright install --with-deps chromium firefox webkit
npm run verify
```

Ở container này Firefox dùng `ATLAS_CONTAINER_BROWSER=1`; CI dùng sandbox bình thường. Xem UI bằng `npm run build:review && npm run preview:review`, cổng 4174. Hướng dẫn release/deploy/acceptance: `docs/DEPLOY-ACCEPTANCE.md`; checkpoint tiếp quản mới ở mục 14 của `HANDOFF.md`.

## Plugin và phần còn lại

GitHub đã kết nối, xác minh repo canonical **ldqanh1408/frontend** (tên handoff **hehe** trỏ tới đây), nhánh **claude/sharp-thompson-5tff91**, và quyền push. Plugin này giúp kiểm source, CI và log. Remote head quan sát vẫn là `4737b155e9f106bc7351c271d19ef207cfbb9a66`. [CI xanh gần nhất](https://github.com/ldqanh1408/frontend/actions/runs/37311004973) thuộc source cũ, không phải bản này.

Cloudflare đã kết nối và chỉ được đọc: thấy `atlas-web-staging`, `sparkling-snow-090d`, chưa thấy Observer Worker riêng. Deployment Workspace quan sát ngày 05/10 có trước source hiện tại. Plugin Cloudflare phù hợp để kiểm version/config/log và deploy sau khi được cho phép. Playwright đã có sẵn cho browser E2E, visual, perf và axe; không cần cài thêm plugin browser để làm các bước này.

Để nghiệm thu E2E thật còn cần backend/REST/WS/Yjs và scoped test resources, persistence/freeze/lock/AI/PR/CI/Implemented receipts, hai origin với auth audience/cookie độc lập, CI của commit cuối, NVDA/VoiceOver thủ công và duyệt UI trước deploy. Frontend split không thay thế auth isolation phía server.

Push source/evidence hiện chờ xác nhận cụ thể. Automatic approval review đã chặn push dry-run vì chưa có quyền xuất source tới remote được xác nhận trong phiên; chưa có GitHub hoặc Cloudflare write. Các thay đổi đã được commit local và đóng gói để review trước lần gửi tiếp.
