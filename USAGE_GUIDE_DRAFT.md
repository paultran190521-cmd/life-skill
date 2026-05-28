# HƯỚNG DẪN SỬ DỤNG (BẢN NHÁP CẬP NHẬT)

Ngày cập nhật: 28/05/2026

Tài liệu này bám theo trạng thái code hiện tại, tập trung vào cách dùng thực tế cho Admin và Giáo viên.

## 1. Tổng quan hệ thống

Mục tiêu hệ thống:

- Điều phối lịch dạy kỹ năng sống theo trường/lớp/khung giờ/bài học.
- Quản lý quy trình vận hành chuẩn:
  - giao lịch -> xác nhận -> nộp giáo án -> điểm danh -> báo cáo.
- Lưu dữ liệu tập trung trên Google Sheets.

Vai trò:

- `Admin`:
  - toàn quyền điều hành và cấu hình.
- `Teacher`:
  - thao tác trên dữ liệu thuộc lịch của chính mình.

## 2. Đăng nhập và quyền truy cập

- Đăng nhập bằng Google.
- Hệ thống dùng session để xác thực backend.
- Nếu chưa đăng nhập:
  - không tải dữ liệu tổng (`/api/app-data`),
  - UI hiển thị trạng thái “Chưa đăng nhập”.

Lưu ý:

- Hệ thống đang chạy chế độ phân quyền backend `enforce` mặc định.
- Nếu cần rollback nhanh khi sự cố quyền:
  - set `AUTH_ENFORCEMENT_MODE=shadow`.

## 3. Phân hệ Giao lịch (Admin)

### 3.1. Quy trình chuẩn

1. Chọn ngày, trường, lớp, khung giờ, bài học, môi trường dạy.
2. Chọn danh sách giáo viên nhận lịch.
3. Kiểm tra khối “Xem trước lịch sắp gửi”.
4. Chỉ bấm gửi khi không còn cảnh báo xung đột.

### 3.2. Cập nhật mới về an toàn giao lịch

Hệ thống đã chặn xung đột ở 2 lớp:

- Lớp backend:
  - chặn trùng `giáo viên + ngày + khung giờ`,
  - chặn trùng `lớp + ngày + khung giờ`,
  - chặn cả trùng với lịch đã có và trùng trong chính danh sách sắp gửi.
- Lớp UI preview:
  - có khối cảnh báo đỏ liệt kê xung đột,
  - nút “Gửi lịch và email thông báo” bị khóa khi còn xung đột,
  - hiển thị khối xanh khi lịch an toàn để gửi.

### 3.3. Kết quả sau khi gửi

- Tạo lịch vào `Schedules`.
- Gửi email tổng hợp theo từng giáo viên.
- Tạo thông báo vận hành.
- Ghi audit log chi tiết.

## 4. Lịch tổng / Lịch của tôi

- Hỗ trợ 3 chế độ xem: `Tháng`, `Tuần`, `Ngày`.
- Có bộ lọc theo trạng thái, giáo viên, trường, lớp, khung giờ, khoảng ngày.
- Admin có thao tác:
  - hủy lịch,
  - chuyển giáo viên,
  - nhắc xác nhận,
  - thao tác hàng loạt theo ngày.

Teacher:

- chỉ xem lịch của chính mình,
- xác nhận/điểm danh theo quyền.

## 5. Giáo án

- Upload giáo án theo từng lịch.
- Hỗ trợ link ngoài Google Drive (`external_link`).
- Sửa tên giáo án.
- Xóa giáo án.

Quyền:

- Admin quản lý toàn bộ.
- Teacher chỉ thao tác giáo án thuộc lịch của mình.

## 6. Điểm danh

- Điểm danh theo từng tiết.
- Chặn điểm danh trùng.
- Chặn điểm danh lịch đã hủy.
- Cập nhật trạng thái lịch sang `attended`.

Rule thời gian:

- cho điểm danh sớm tối đa 30 phút trước giờ bắt đầu,
- có theo dõi điểm danh trễ để admin giám sát.

## 7. Cấu hình nền tảng (Admin)

Quản lý các danh mục:

- Trường
- Lớp
- Khung giờ
- Bài học
- Giáo viên
- Người dùng
- App announcements

Import:

- hỗ trợ `.xlsx/.csv/.tsv` cho các phân hệ phù hợp.

## 8. Thông báo & banner

- Notification panel theo vai trò (`admin`, `teacher`, `all`).
- Banner thông báo đầu trang (`AppAnnouncements`) có bật/tắt/xóa.
- Feedback từ giáo viên được gửi về admin theo mẫu chuẩn.

## 9. Observability vận hành (Admin mới)

Trong tab Cấu hình có panel mới: **Observability vận hành**.

### 9.1. Hiển thị chính

- Tổng sự kiện.
- Deny (1h).
- API Error (1h).
- Health tổng.
- Top route.
- Cảnh báo vận hành.

### 9.2. Ý nghĩa nhanh

- `Deny (1h)` tăng mạnh:
  - có thể user thao tác sai quyền hoặc policy cần rà soát.
- `API Error (1h)` tăng:
  - có thể có lỗi nghiệp vụ hoặc tích hợp ngoài.
- `Health` không `ok`:
  - kiểm tra Sheets/GAS/Email ngay.

### 9.3. Ngưỡng cảnh báo

- `OBS_ALERT_DENY_1H` (mặc định 20)
- `OBS_ALERT_ERROR_1H` (mặc định 10)

## 10. Health check nội bộ (Admin)

API:

- `GET /api/admin/health`

Kiểm tra:

- Google Sheets
- GAS webhook
- Email provider

Trạng thái trả về:

- `ok`
- `degraded`
- `down`

## 11. Chuẩn lỗi mới để support nhanh

Mọi lỗi API đã thống nhất format:

- `{ error, code, requestId }`

Cách dùng khi support:

1. Lấy `requestId` từ lỗi user gặp.
2. Tra trong audit/event log.
3. Xác định route, code, reason để xử lý nhanh.

## 12. Checklist test nhanh sau mỗi lần cập nhật

1. Đăng nhập admin, mở tab Cấu hình.
2. Kiểm tra panel Observability tải được dữ liệu.
3. Giao lịch thử:
  - tạo case trùng -> phải bị cảnh báo/khóa gửi,
  - sửa hết trùng -> gửi được.
4. Teacher test:
  - xác nhận lịch,
  - nộp giáo án,
  - điểm danh.
5. Chạy kỹ thuật:
  - `npm run test:authz`
  - `npm run build`

## 13. Ghi chú vận hành

- Không có phân hệ chat trong phiên bản hiện tại.
- Khi phát sinh chặn nhầm quyền production:
  - chuyển tạm `AUTH_ENFORCEMENT_MODE=shadow`,
  - rà log/audit,
  - fix policy rồi bật lại `enforce`.

