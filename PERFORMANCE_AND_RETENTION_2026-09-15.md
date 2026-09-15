# Tối ưu dữ liệu và lưu ảnh chat — 15/09/2026

## Phần đã triển khai trong mã

- Bootstrap không đọc AuditLogs/WeeklyUpdates khi giao diện yêu cầu history=lazy. Lịch sử được tải theo ID lịch khi mở; cập nhật tuần tải khi vào Giao lịch. API đọc cập nhật tuần nay yêu cầu phiên admin thực, không tin header giả.
- Lịch tổng/Lịch của tôi làm mới từ máy chủ theo khoảng ngày đang xem (ngày/tuần/tháng, tối đa 63 ngày). Dữ liệu ngoài khoảng vẫn được giữ để các thống kê toàn thời gian không sai. Request cũ bị hủy khi đổi khoảng; kết quả đọc bắt đầu trước một thao tác ghi không được ghi đè dữ liệu vừa sửa.
- Chat lấy 40 tin mới nhất; cursor theo ID trên thứ tự thời gian+ID ổn định; tải tiếp tin cũ, chỉ trả attachment của trang hiện tại. Phạm vi giáo án/người dùng vẫn kiểm tra tại API.
- ChatComposer có state riêng: gõ chữ không cập nhật state gốc của ứng dụng. Chặn gửi kép cả lúc nén ảnh, giữ nội dung nếu gửi lỗi. Ảnh thu nhỏ có lazy loading, giải mã bất đồng bộ và kích thước cố định.
- Cấu hình có mục đo hiệu năng tại thiết bị: tối đa 100 mẫu menu/API trong RAM, trung vị/P95; không gửi telemetry ra ngoài, không lưu nội dung chat. Thời gian menu là thao tác đến khung hình sau commit, không phải INP hay FPS.

## Quy tắc ảnh 5 tháng

- Tính 5 tháng lịch từ createdAt, giữ giờ UTC và chặn ngày về cuối tháng đích (30/09 → 28 hoặc 29/02).
- Chỉ ảnh đính kèm trong LessonPlanAttachments. Tin chữ, file PDF/PPT/DOC và link dán trong tin nhắn không bị xóa.
- API không trả URL ảnh hết hạn, endpoint ảnh trả 410; giao diện hiển thị ảnh đã hết hạn thay cho ảnh hỏng.
- GAS kiểm tra MIME thực và cha là thư mục lesson-plan-{id} nằm đúng thư mục chat cấu hình. Không xử lý ảnh dùng bởi attachment chưa hết hạn hoặc file đang được LessonPlans tham chiếu.
- Chuyển ảnh vào Thùng rác Drive, không xóa vĩnh viễn ngay. Có thể khôi phục trong thời gian Drive còn giữ thùng rác; giao diện vẫn tuân thủ thời hạn lưu.
- Job có ScriptLock, tối đa 100 file/4 phút mỗi lượt, lỗi một file không dừng cả lượt, đánh dấu expiredAt sau khi chuyển file thành công. Dữ liệu lỗi ngày được bỏ qua, không đoán ngày.
- Hàm previewChatImageRetention chỉ chạy dryRun:true. installChatImageRetention tạo một trigger hằng ngày khoảng 03 giờ Việt Nam, không xóa trigger không liên quan.

## Triển khai GAS — chưa được coi là đang chạy

Đúng project: 1WAZA-D9649Ve9K2IJtgIopmfcKzo_LhtJhgCP7Rhi_l-yU271jjRZRnC.
Đã clone nguồn thực và giữ những khác biệt ngoài phạm vi. Bổ sung file gas-chat-retention.js, các action retention và scope script.scriptapp vào bản HEAD. Webhook production version 18 chưa được chuyển sang bản mới trong lúc chờ xác minh quyền.

Cần hoàn tất: cho phép chạy previewChatImageRetention → kiểm tra số ảnh → cấp quyền trigger/cài installChatImageRetention → xác minh đúng một trigger → redeploy đúng deployment hiện tại → ping version và đọc trạng thái. Công cụ an toàn đã chặn thao tác Chạy do chưa chấp nhận bằng chứng dry-run; đã hỏi người dùng xác nhận. Chưa xóa ảnh thật.

Bản bổ sung kiểm tra row ID trước khi xử lý đã kiểm thử ở local nhưng lần đồng bộ HEAD cuối bị công cụ an toàn chặn vì yêu cầu xác nhận đích nhận mã GAS. Không thử đường vòng. Cần đồng bộ bản này trước khi cài trigger. Nguồn HEAD đã đẩy trước đó không đồng nghĩa bản production đã đổi.

## Kiểm thử

- test:chat-performance: biên tháng/năm nhuận, tính nhất quán TS/GAS, không ghi khi dry-run, thư mục/file dùng chung/giáo án, lỗi và chạy lại; 85 tin cùng timestamp phân 40/40/5 không thiếu/trùng; phân quyền và ngày không hợp lệ; nháp link và gửi kép.
- test:menu-performance: 16 tổ hợp vai trò/menu giữ nội dung; chỉ mục vẫn đúng trên dữ liệu giả lập lớn.
- TypeScript, production build và các kiểm thử phân quyền, trợ giảng, trùng lịch, bài trong 2 tháng, gom đọc Sheets.
- Không tạo lịch/điểm danh, gửi mail, gửi chat hay xóa ảnh trên dữ liệu thật trong kiểm thử.
- Build cuối đạt sau khi cấp quyền ghi cache .next trên Windows; test:authz (33), test:email-template và test:menu-performance chạy lại đều đạt. Bổ sung chống phản hồi chat cũ hiển thị sang giáo án khác khi đóng/chuyển chat trong lúc gửi.

## Giới hạn và việc còn lại

Đây chưa phải hoàn tất toàn bộ kế hoạch kiến trúc: root vẫn chứa nhiều state/menu; lần đầu vẫn tải toàn bộ Schedules/LessonPlans/Attendance. Đường làm mới đã có khoảng ngày nhưng chưa thay thế hoàn toàn bootstrap. Muốn bỏ tải lịch sử ở lần đầu phải tách thống kê toàn thời gian/tìm kiếm/xuất dữ liệu sang API tổng hợp trước; không được cắt mảng chung và làm sai số liệu.

Chưa chuyển database, thêm Web Worker hay ảo hóa toàn bộ bảng; chỉ nên làm nếu số đo thực tế cho thấy cần. Chưa có phép đo INP trên iPhone thật. Xóa ảnh Drive giảm dung lượng lưu, không tự động làm mọi menu nhanh hơn vì ảnh vốn không nằm trong bootstrap.
