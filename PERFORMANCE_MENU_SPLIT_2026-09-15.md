# Tối ưu tiếp theo: tách menu, giữ nguyên nghiệp vụ

## Đã thực hiện

- Tách Bài học và Giáo viên sang các module client riêng, tải bằng Next dynamic import khi cần. Panel dùng chung và kiểu dữ liệu form cũng được tách, không tạo phụ thuộc runtime ngược vào ứng dụng gốc.
- Tải trước mã hai menu khi hover/focus; không đọc dữ liệu hoặc gọi thao tác ghi. Bỏ qua tải trước khi trình duyệt báo saveData. Giữ skeleton cho lần đầu/mạng chậm; lỗi preload không chặn thao tác khác.
- Tạo chỉ mục văn bản cho danh sách bài học/giáo viên khi dữ liệu nguồn thay đổi. Tìm kiếm không phải ghép và viết thường toàn bộ nội dung lại theo từng ký tự. Giữ nguyên dấu tiếng Việt, trim, thứ tự, tham chiếu bản ghi và bộ lọc khối.
- Không sửa API, quy tắc phân quyền, xung đột lịch, hai tháng/Tiết 1, dữ liệu Sheets, email, điểm danh hoặc webhook GAS trong đợt này.
- Form state và các callback nghiệp vụ vẫn thuộc controller hiện tại; việc chuyển menu giữ cách quản lý nháp cũ. Đây là tách gói giao diện, chưa phải tách hết state của toàn hệ thống.

## Bằng chứng và giới hạn phép đo

- Trước thay đổi, chunk chứa ứng dụng và cả hai menu: 320.506 byte, gzip 75.564 byte.
- Sau thay đổi, chunk chứa ứng dụng chính: 303.620 byte, gzip 72.692 byte; không còn chuỗi nội dung của hai menu. Phần JSX menu nằm trong các chunk tải riêng.
- Chênh lệch riêng chunk chính: -16.886 byte (~5,3%), gzip -2.872 byte (~3,8%). Đây không phải tổng byte mạng lần mở trang: còn runtime/shared chunk và các biến thể chunk do bundler phát sinh. Không khẳng định mọi byte tách ra đều tiết kiệm khi người dùng mở toàn bộ menu.
- Benchmark tìm kiếm: 3.000 bản ghi, 12 truy vấn/mẫu, trung vị 9 mẫu: 29,29 ms → 3,87 ms; tạo chỉ mục 7,47 ms. Đây là CPU cục bộ trên dữ liệu giả lập, không phải tốc độ chuyển menu hay INP trên điện thoại.

## Kiểm thử

- Production build, TypeScript.
- 16 tổ hợp vai trò/menu so sánh nội dung với baseline. Test loader thực sự render module vừa tách, không bỏ qua bằng stub null.
- Kiểm tra cấu trúc đối chiếu với commit c363c7e: thân JSX và event handler của hai menu, Panel, TeacherTableRow không đổi; các prop truyền nguyên tên và giá trị/callback, không thiếu phụ thuộc.
- 36 trường hợp tìm kiếm/bộ lọc đối chiếu với cách cũ; giữ thứ tự/tham chiếu, không sửa nguồn, cập nhật chỉ mục khi nguồn đổi.
- test:authz (33 route rules), test:schedule-conflicts (11), test:lesson-progression, test:assistant-workflow đều đạt.
- Không tạo/sửa/xóa dữ liệu production; chưa đo tương tác trình duyệt thực của bản này.

## Trạng thái phát hành và phần còn lại

Nguồn mới được kiểm thử ở local. Không push/deploy vì lần trước công cụ an toàn đã chặn việc gửi commit chứa mã GAS nhạy cảm lên origin; chưa có xác nhận mới giải quyết chặn đó. Không dùng đường vòng. Trigger dọn ảnh và redeploy GAS vẫn chưa kích hoạt.

Chưa hoàn tất tách toàn bộ menu. Giao lịch, lịch tổng, giáo án, điểm danh và cấu hình còn cần tách theo phụ thuộc thực tế. Bootstrap vẫn tải toàn bộ Schedules/LessonPlans/Attendance: trước khi bỏ tải này cần API thống kê toàn thời gian, tìm kiếm/xuất dữ liệu và kiểm tra tương đương. Không giảm tải bằng cách cắt mảng dùng chung làm sai số liệu.

Theo hướng dẫn Next.js/React, ưu tiên module tải theo nhu cầu, preload theo ý định người dùng và chỉ mục gắn với dữ liệu nguồn; không thêm thư viện animation, cache dữ liệu cũ hay thay thuật toán nghiệp vụ.
