# WORK SUMMARY - HỌC VIỆN METTASOUL Scheduler

Ngày cập nhật: 28/05/2026  
Nhánh hiện tại: `main`  
HEAD commit hiện tại: `22fa804`

## 1. Mục Tiêu Và Trạng Thái Tổng Quan

HỌC VIỆN METTASOUL Scheduler là web app Next.js (App Router) phục vụ quản lý vận hành lịch dạy kỹ năng sống cho admin/giáo vụ và giáo viên.

Nguồn dữ liệu chính:

- Google Sheets: lưu dữ liệu nghiệp vụ.
- Google Apps Script (GAS): xử lý gửi email lịch dạy, upload/xóa giáo án trên Google Drive.

Trạng thái tổng quan hiện tại (đã đối chiếu code):

- Chức năng cốt lõi đã có đầy đủ cho vận hành thực tế.
- UI đã rebrand sang `HỌC VIỆN METTASOUL`, font Quicksand, mặc định lịch ở chế độ tuần.
- Phân hệ chat không còn trong codebase.
- Có một số tồn đọng kỹ thuật cần xử lý (đặc biệt phân quyền API và kiểm thử email thực chiến).

## 2. Tính Năng Đã Xác Minh Có Thật Trên Code

### 2.1. Xác thực và tài khoản

- Đăng nhập Google OAuth2, callback tạo session cookie (`life_skill_session`).
- Xác thực user qua `Users` và fallback teacher trong `Teachers` khi phù hợp.
- Có đăng xuất session.

### 2.2. Điều phối giao lịch

- Tạo lịch theo lô, 1 lần gửi nhiều giáo viên và nhiều dòng lịch.
- Validate dữ liệu trường/lớp/bài học/khung giờ và khớp khối lớp - bài học.
- Hỗ trợ normalize dữ liệu ID/tên để giảm lỗi lệch giữa Sheet/UI.
- Ghi `AuditLogs`, tạo `Notifications`, và gửi email theo nhóm giáo viên.

### 2.3. Email lịch dạy

- Subject tuần chuẩn: `LỊCH DẠY TUẦN ... NĂM ...`.
- Email có nút `XÁC NHẬN` từng lịch và `XÁC NHẬN TẤT CẢ`.
- Có route xác nhận từ email:
  - `/api/schedules/[id]/confirm`
  - `/api/schedules/confirm-all`
- Có lớp kiểm tra template/version/digest giữa Next.js và GAS.
- Có `MailDebug` để trace trạng thái gửi email.

### 2.4. Lịch tổng / lịch của tôi

- Chế độ xem tháng/tuần/ngày; mặc định tuần.
- Admin xem toàn bộ, giáo viên xem lịch cá nhân.
- Bộ lọc: trạng thái, giáo viên, trường, lớp, khung giờ, ngày.
- Có thao tác admin: hủy lịch, chuyển giáo viên, nhắc xác nhận, thao tác hàng loạt.
- Có thống kê nhanh và modal chi tiết lịch.

### 2.5. Giáo viên và người dùng

- CRUD giáo viên + bật/tắt active.
- Tạo/sync tài khoản `Users` gắn `teacherId`.
- Import giáo viên từ XLSX/CSV/TSV.
- Chặn email trùng trong file import, bỏ qua email đã tồn tại hệ thống.
- Khi cập nhật/tắt giáo viên có sync trạng thái sang user liên kết.

### 2.6. Tổng quan giáo viên

- Có tab tổng quan theo thời gian.
- KPI chính gồm:
  - Lịch đã dạy
  - Lịch sắp dạy
  - Điểm danh trễ
  - Không điểm danh
  - Giáo án đã gửi
  - Giáo án chưa gửi
- Có thêm 4 KPI môi trường dạy: trong lớp/ngoài sân/nhà thi đấu/báo cáo sân trường.
- Bấm card mở danh sách chi tiết tương ứng.

### 2.7. Giáo án

- Upload giáo án qua proxy route đến GAS.
- Hỗ trợ nhiều định dạng file, giới hạn 10MB/file.
- Có link giáo án ngoài (`external_link`) và hiển thị inline trên card liên quan.
- Cho sửa tên giáo án, xóa giáo án (ưu tiên GAS, fallback Google Drive API + xóa sheet).
- Có phân quyền giáo viên/admin cho thao tác giáo án.

### 2.8. Điểm danh

- POST điểm danh tạo record `Attendance`, update `Schedules` sang `attended`, ghi `AuditLogs`.
- Chặn điểm danh lịch đã hủy và chặn điểm danh trùng.
- Rule thời gian:
  - Cho điểm danh sớm tối đa 30 phút trước giờ bắt đầu.
  - Sau ngưỡng muộn vẫn ghi nhận để theo dõi trễ.
- Dashboard admin có card tổng hợp và cảnh báo giáo viên trễ/chưa điểm danh.

### 2.9. Cấu hình nền tảng

- Quản lý Trường/Lớp/Khung giờ/Bài học.
- Lớp tự suy ra khối từ tên lớp (ví dụ `10A1` -> `Khối 10`).
- Khung giờ chỉ chấp nhận 45 hoặc 90 phút.
- Import bài học và khung giờ từ XLSX/CSV/TSV.

### 2.10. Thông báo, banner, feedback, hướng dẫn

- Chuông thông báo có panel danh sách + đánh dấu đã đọc.
- Có banner thông báo chạy đầu ứng dụng (`AppAnnouncements`) với bật/tắt/xóa.
- Có modal feedback và khu feedback trong Cấu hình.
- Có trang hướng dẫn tại `public/huong-dan-su-dung/index.html`.
- Có center feedback/toast nổi để phản hồi thao tác cho người dùng.

## 3. Trạng Thái Bảo Mật/Phân Quyền API (Quan Trọng)

Đang có chênh lệch giữa phân quyền ở UI và phân quyền ở một số API backend:

- Các route đã có kiểm tra session/phân quyền tương đối tốt: `schedules`, `attendance`, `lesson-plans`.
- Một số route cấu hình/chung hiện chưa bắt buộc auth role chặt ở tầng API (dù UI giới hạn theo tab), ví dụ nhóm route `teachers`, `schools`, `classes`, `lessons`, `announcements`, `notifications`.

Kết luận hiện trạng:

- Về UI: admin/teacher phân vùng rõ.
- Về API: cần harden bắt buộc auth + role check ở tất cả route ghi dữ liệu.

## 4. Tồn Đọng Kỹ Thuật Đã Xác Định

- Cần kiểm thử gửi email lịch dạy end-to-end trên môi trường chạy thật để xác nhận dứt điểm nội dung legacy không còn xuất hiện.
- Cần chuẩn hóa bảo mật API ghi dữ liệu (authn/authz) đồng đều toàn hệ thống.
- Một số chuỗi tiếng Việt trong response lỗi backend đang hiển thị sai mã hóa, cần chuẩn hóa encoding để tránh thông báo lỗi méo chữ.
- Cần bổ sung checklist regression test sau mỗi đợt thay đổi lớn (đặc biệt giao lịch + email + giáo án + điểm danh).

## 5. Commit Gần Đây (Đã Cập Nhật Đúng HEAD)

Commit mới nhất hiện tại:

- `22fa804` - Update work summary with latest features.

Các commit chính trước đó (28/05/2026):

- `bba7e4d` - Add pinned system feedback layer.
- `e6d8462` - Polish teacher lesson-plan card link guidance.
- `25bb638` - Show teacher lesson plans inline and support Drive links.
- `9395d1d` - Add admin-managed announcement banner.
- `3209b52` - Fix GAS email digest check to preserve HTML whitespace.
- `e79d54e` - Add MailDebug sheet tracing for schedule email delivery.
- `8e4f976` - Surface schedule email failure reasons in admin notification.
- `ca29c08` - Fail schedule email when GAS metadata is stale or recipient email invalid.
- `de2c2bf` - Fix schedule email legacy-content root causes and enforce push workflow rule.

## 6. Ưu Tiên Phiên Kế Tiếp

1. Harden toàn bộ API ghi dữ liệu bằng session + role check thống nhất.
2. Chạy test gửi lịch thật để xác minh end-to-end nội dung email không còn legacy text.
3. Chuẩn hóa encoding tiếng Việt ở các message backend.
4. Cập nhật tiếp tài liệu hướng dẫn theo cùng snapshot code để đồng nhất vận hành.

## 7. Quy Tắc Vận Hành Đã Chốt

- Khi hoàn tất thay đổi theo yêu cầu: kiểm tra lại hoạt động, commit, và push ngay trong cùng phiên.
- Mọi tài liệu tiến độ phải bám theo trạng thái code thực tế, không chỉ dựa vào ghi chú phiên trước.
