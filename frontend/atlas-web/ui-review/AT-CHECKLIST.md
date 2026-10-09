# NVDA / VoiceOver — checklist trước nghiệm thu

**Trạng thái: chưa chạy thủ công.** Axe tự động không thay thế kiểm tra trình đọc màn hình. Ghi phiên bản hệ điều hành, browser, AT và kết quả thực tế khi thực hiện.

| Ca kiểm tra | NVDA + Firefox/Chrome | VoiceOver + Safari |
|---|---|---|
| Skip link đến main; heading, title và breadcrumb cập nhật sau đổi route | Chưa chạy | Chưa chạy |
| Organization / Workspace / Project được đọc đúng; Not observed không bị hiểu là tenant hiện tại | Chưa chạy | Chưa chạy |
| Dialog: tên, mô tả, focus vào đúng chỗ, không thoát focus ngoài, Escape đóng và trả focus về trigger | Chưa chạy | Chưa chạy |
| Tabs: dùng phím mũi tên, chỉ tab hiện tại nằm trong thứ tự focus; form lỗi mở đúng tab và focus đúng field | Chưa chạy | Chưa chạy |
| Lý do khoá cạnh nút được đọc qua aria-describedby; phân biệt thiếu session, quyền, entitlement và quota | Chưa chạy | Chưa chạy |
| Execution List đọc đủ task, loại, dependencies, trạng thái và attempt; Tab/Enter chọn node theo thứ tự phụ thuộc | Chưa chạy | Chưa chạy |
| Graph có tên node và trạng thái bằng chữ; List cung cấp cùng thông tin khi không dùng đồ thị | Chưa chạy | Chưa chạy |
| Inspector Task / Context / Access và activity tabs không làm mất focus khi đổi nội dung | Chưa chạy | Chưa chạy |
| Mobile Code/Spec: Explorer → Editor → Inspector; pane ẩn không còn trong thứ tự focus | Chưa chạy | Chưa chạy |
| Toast được thông báo phù hợp, tối đa 3; tạm dừng thời gian khi hover/focus; không chiếm focus đang nhập | Chưa chạy | Chưa chạy |
| Conflict: bản nháp chưa lưu vẫn có thể export; thao tác discard có tên và phạm vi rõ | Chưa chạy | Chưa chạy |
| Cancel/retry/force release: đọc đúng tài nguyên/revision, ảnh hưởng lock/sandbox và kết quả Unknown | Chưa chạy | Chưa chạy |
| Zoom 200% / text 200%, high contrast và reduced motion; không mất nội dung/điểm focus | Chưa chạy | Chưa chạy |

Thử production không có service, review Illustrative và service fixture riêng. Không dùng fixture làm bằng chứng về backend hoặc đăng nhập thật.
