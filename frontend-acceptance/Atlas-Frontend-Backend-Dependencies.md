# Atlas — Backend Dependencies & Boundary (run 2 + 3 + 4, 2026-10-05)

Backend **không** được chứng nhận bởi run này. Các mục dưới đây được theo dõi riêng (v1 §13 / v2 §7) và **không** tính PASS/FAIL frontend. Chỉ field/transition bị ảnh hưởng được đánh dấu; không gán cả module `BLOCKED_BACKEND`.

## 1. Quan sát từ deployment (OBSERVED_THIS_RUN)

- `release-manifest.json`: `apiAuthority: "Connect an explicitly configured authorized service; no mock backend included."`, `deploymentProfile: "Same-origin TLS reverse proxy; configure the Java service upstream separately."`, `backendE2E: NOT_RUN`.
- Worker không có binding (assets-only) ⇒ không có backend nào được phục vụ từ deployment này.
- Trang `#connection` hiển thị: "Service adapter contract is proposed — This UI requires Atlas UI v1 capability/session/collection/command responses; availability must be verified against your actual backend. No production result is preseeded."
- Ở trạng thái chưa kết nối, 15 module dịch vụ hiển thị phần "Definitions" cục bộ + "Service records"; các action dịch vụ (Evaluate agent, Publish revision, Authorize credential, Run authorized query, …) phụ thuộc phiên dịch vụ.

## 1b. Hành vi frontend với fixture có nhãn (run 3, `FX-SERVICE/atlas-ui-v1-fixture-r3`, Chromium 141, click thật)

Chứng minh **frontend** xử lý hợp đồng proposed đúng như semantics v2 §6.3; **không** chứng minh service thật:
- Kết nối: `GET v1/capabilities` → `GET serviceSessionHref` → `GET collectionHref` (2 record/module).
- Lệnh: hộp xác nhận "Send …"; double-click ⇒ **1 POST** với `Idempotency-Key`, `X-CSRF-Token` (đã che), `If-Match` (etag), body `{operationId, scope, resourceId, actionId, expectedRevision, fingerprint, input}`.
- Stage: Received/Accepted/Rejected hiển thị đúng; Effective chỉ sau khi `effectHref` trả fingerprint khớp ("Service receipt matches effect readback").
- Lỗi sau khi gửi (403/409/422/500, mất mạng, timeout 20 s, fingerprint mismatch) ⇒ Unknown + "Reconcile this operation; do not resend"; POST 401 ⇒ Unknown "session expired or revoked" + disconnect.
- Đọc trả 401 hoặc `expiresAt` trôi qua ⇒ disconnect (nhưng toast thành công cũ còn — FND-005).
- Audience observer: không tải record workspace, không có lệnh.
- Ghi chú hợp đồng: client **không** thay `{operationId}` trong `effectHref` (fixture phải dùng href theo resource) — cần ghi vào DTO khi duyệt.

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

## 2b. Từ Figma (run 4)
- Decision register (04 · E2E Model, 342:9): D01–D14, UXD-01–UXD-14, EX-LOCK-03, OBSERVER_READ_ONLY và "API TBD — Real service contracts: 49 authoring schemas AUTHORING_PROPOSAL; no deployed backend DTO approval" đều **Proposed not approved** ⇒ BE-01, BE-02 (FND-006), BE-07 vẫn SPEC_UNRESOLVED.
- OBSERVER_READ_ONLY: Figma ghi xung đột giữa điều khiển "operator effect" trong frame Observer và ý định read-only — cần quyết định trước khi nghiệm thu #observer.
- Journey Figma: 160/174 bước có ORACLE cần receipt của service thật (BLOCKED_BACKEND); phần frontend của các bước này chỉ được ghi là "form authoring liên quan có mặt và khớp Figma" (Journey-Results.csv).

## 3. Phân tách frontend/backend cho UAT
`Atlas-Frontend-UAT-Classification.csv` chỉ có header: `Atlas-Original-UAT-113.csv` và `Atlas-UX-UAT-194.csv` không được cung cấp và Figma chỉ nhắc "113 original UAT remain NOT_RUN" mà không chứa dòng UAT, nên không phân loại (không suy đoán). Nghiệm thu mức journey dùng traceability Figma (FE06-UXJ-042).
