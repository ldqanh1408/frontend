# Atlas — Backend Dependencies & Boundary (run 2, 2026-10-05)

Backend **không** được chứng nhận bởi run này. Các mục dưới đây được theo dõi riêng (v1 §13 / v2 §7) và **không** tính PASS/FAIL frontend. Chỉ field/transition bị ảnh hưởng được đánh dấu; không gán cả module `BLOCKED_BACKEND`.

## 1. Quan sát từ deployment (OBSERVED_THIS_RUN)

- `release-manifest.json`: `apiAuthority: "Connect an explicitly configured authorized service; no mock backend included."`, `deploymentProfile: "Same-origin TLS reverse proxy; configure the Java service upstream separately."`, `backendE2E: NOT_RUN`.
- Worker không có binding (assets-only) ⇒ không có backend nào được phục vụ từ deployment này.
- Trang `#connection` hiển thị: "Service adapter contract is proposed — This UI requires Atlas UI v1 capability/session/collection/command responses; availability must be verified against your actual backend. No production result is preseeded."
- Ở trạng thái chưa kết nối, 15 module dịch vụ hiển thị phần "Definitions" cục bộ + "Service records"; các action dịch vụ (Evaluate agent, Publish revision, Authorize credential, Run authorized query, …) phụ thuộc phiên dịch vụ.

## 2. Phụ thuộc backend (theo dõi riêng)

| ID | Phụ thuộc | Field / transition frontend bị ảnh hưởng | Trạng thái |
|---|---|---|---|
| BE-01 | DTO `atlas-ui/v1` được duyệt (capabilities, session, collection, command, status, effect) | Mọi section "Service records", stage Received/Accepted/Effective/Rejected/Unknown, `blockedReason`, inputs action | SPEC_UNRESOLVED — hợp đồng hiện chỉ "proposed" (đảo ngược từ bundle ở run 1) |
| BE-02 | Quyết định 4xx là definitive hay Unknown (FND-006, FX-EXEC-001, FX-CMD-004) | Hiển thị kết quả lệnh sau 409/422 | SPEC_UNRESOLVED |
| BE-03 | Permissions/grants phía server, role projection | Ẩn/hiện/disabled action theo grant | NOT_RUN (fixture only) |
| BE-04 | Receipt/readback thật (`effectHref`, `evidenceId`) | Chuyển sang Effective | NOT_RUN |
| BE-05 | Provider/worker thật (gateway, execution, observer telemetry) | Health, usage, traces | NOT_RUN |
| BE-06 | Logout capability (`caps.logoutHref`) + xác minh revoke | Nút "Request & verify service logout" | NOT_RUN |
| BE-07 | IdP / identity flows cho các màn NOT_IMPLEMENTED của run 1 (FND-012) — uỷ quyền IdP hay cần UI | 7 màn (danh sách trong run-1 Screen-Coverage, không có trong phiên) | SPEC_UNRESOLVED |
| BE-08 | UAT 113 + 194 live, 28 BA/UX decisions, EX-LOCK-03, B03 provenance | Theo từng UAT | NOT_RUN (CSV không có trong phiên) |

## 3. Phân tách frontend/backend cho UAT
`Atlas-Frontend-UAT-Classification.csv` chỉ có header: `Atlas-Original-UAT-113.csv` và `Atlas-UX-UAT-194.csv` không được cung cấp, nên không phân loại (không suy đoán từ tên file).
