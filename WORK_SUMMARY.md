# Tổng Kết Phiên Làm Việc - Life Skill Scheduler

Ngày cập nhật: 23/05/2026

## 1. Trạng thái tổng quan

Life Skill Scheduler là web app Next.js dùng cho giáo vụ/admin quản lý lịch dạy kỹ năng sống, giao lịch cho giáo viên, gửi email xác nhận, theo dõi giáo án, điểm danh, chat và thông báo vận hành.

Trạng thái hiện tại:

- Dữ liệu chính đang đọc/ghi qua Google Sheets.
- Email thông báo lịch dạy đang gửi qua Google Apps Script (GAS).
- Google Drive đang dùng để lưu giáo án upload.
- Phân hệ `Giao lịch` đã chuyển từ mockup sang luồng thật end-to-end.
- Admin đã gửi được lịch, ghi được Google Sheet và gửi được email.
- UI đã có popup/toast nội bộ thay cho hộp thoại mặc định của trình duyệt.
- Giao diện đã được tăng hiệu ứng hover, đổ bóng, focus và chuyển động cơ bản.
- Code đã được push lên GitHub nhánh `main` sau các thay đổi.

## 2. Phân hệ Giao Lịch

Đã hoàn thiện các phần chính:

- Admin tạo lịch thật qua `POST /api/schedules`.
- Backend validate ngày, trường, lớp, bài học, khung giờ, giáo viên.
- Ghi lịch vào tab `Schedules`.
- Tạo chat thread thật vào tab `ChatThreads`.
- Ghi thông báo vào tab `Notifications`.
- Ghi audit log vào tab `AuditLogs`.
- Gửi email sau khi ghi lịch; nếu email lỗi thì lịch vẫn được giữ.
- Chính sách trùng giờ hiện tại: luôn cho phép trùng giờ, không chặn conflict.
- Teacher chỉ thấy lịch của mình, admin thấy toàn bộ.
- Backend có kiểm tra quyền cho tạo, hủy, chuyển, xác nhận lịch.

Các lỗi đã xử lý trong phân hệ này:

- Sửa lỗi `Unauthorized` khi gửi lịch bằng tài khoản nội bộ trong app.
- Sửa lỗi `Trường đã chọn không tồn tại` bằng cách bổ sung quản lý trường/lớp và đồng bộ dữ liệu Sheet.
- Sửa lỗi `Khung giờ đã chọn không tồn tại hoặc đang tắt` bằng cách normalize ID, hỗ trợ `active/isActive`, và tự chọn lại khung giờ hợp lệ.
- Sửa lỗi `Một hoặc nhiều giáo viên đã chọn không tồn tại hoặc đang tắt` bằng cách normalize header/cell khi đọc Google Sheet và tự làm sạch danh sách giáo viên đang chọn trên UI.
- Sửa luồng preview để hiển thị lịch sắp gửi thay vì lịch cũ.

Nâng cấp mới nhất của Giao lịch:

- Một lần gửi có thể có nhiều dòng lịch.
- Mỗi dòng lịch có ngày dạy riêng.
- Mỗi dòng gồm: ngày dạy, trường, lớp, khung giờ, bài học.
- Một lần gửi có thể chọn nhiều giáo viên.
- Backend tạo nhiều dòng `Schedules` tương ứng theo từng giáo viên và từng dòng lịch.
- Email được gom theo giáo viên: mỗi giáo viên nhận một email tổng hợp thay vì nhiều email rời.
- Tiêu đề email đổi sang dạng `Lịch dạy tuần ... năm ...`, tính theo tuần ISO từ các ngày được giao.
- Nội dung email dạng bảng để giáo viên xem nhanh nhiều trường, nhiều lớp, nhiều bài, nhiều khung giờ.

## 3. Email Lịch Dạy

Đã chỉnh mẫu email:

- Đổi `Life Skill Scheduler` thành `HỆ THỐNG THÔNG BÁO LỊCH DẠY KỸ NĂNG SỐNG METTASOUL`.
- Sửa chính tả tiếng Việt có dấu.
- Căn giữa tiêu đề `Bạn có lịch dạy mới`.
- Căn giữa nút `Xác nhận lịch dạy`.
- Mục tiêu bài học được tách thành từng dòng rõ ràng:
  - `- Mục tiêu 1: ...`
  - `- Mục tiêu 2: ...`
- Với email tổng hợp, mỗi dòng lịch có nút xác nhận riêng.

## 4. Quản Lý Trường Và Lớp

Đã bổ sung trong phân hệ `Cấu hình`:

- Thêm, sửa, xóa trường.
- Thêm, sửa, xóa lớp.
- Khi thêm lớp có thể nhập nhiều tên lớp cùng lúc, cách nhau bằng dấu phẩy.
- Hệ thống tự xác định khối từ tên lớp, ví dụ `10A1` thành `Khối 10`.
- Dữ liệu trường/lớp được ghi vào Google Sheet và dùng lại trong phân hệ Giao lịch.

## 5. Phân Hệ Giáo Án

Đã hoàn thiện:

- Upload giáo án qua GAS Web App.
- Hỗ trợ nhiều định dạng: `pdf`, `doc`, `docx`, `ppt`, `pptx`, `xls`, `xlsx`, `txt`, `csv`.
- Hỗ trợ upload nhiều file trong một lần.
- Giới hạn mỗi file 10MB.
- Mỗi lịch có thể lưu nhiều giáo án.
- Hiển thị danh sách giáo án theo từng lịch.
- Sửa tên giáo án.
- Xóa bản ghi giáo án trên Google Sheet.
- Xóa file giáo án trên Google Drive qua GAS.
- Backend có kiểm tra quyền: teacher chỉ xử lý giáo án của mình, admin có toàn quyền.

## 6. UI Và Trải Nghiệm

Đã cập nhật:

- Thay toàn bộ `window.confirm` và `window.prompt` bằng dialog nội bộ.
- Thêm toast thông báo nội bộ chuyên nghiệp thay cho thông báo trình duyệt.
- Thêm animation vào/ra cho dialog và toast.
- Thêm hiệu ứng hover, đổ bóng, focus ring, và chuyển động nhẹ cho toàn bộ giao diện.
- Sửa lỗi font/encoding trên giao diện chính ở các phần đã can thiệp gần đây.

## 7. Google Sheets, Drive Và GAS

Google Sheets đang là nguồn dữ liệu chính.

Các tab đang dùng:

- `Users`
- `Teachers`
- `Schools`
- `Classes`
- `Lessons`
- `TimeSlots`
- `Schedules`
- `LessonPlans`
- `Attendance`
- `ChatThreads`
- `ChatMessages`
- `Notifications`
- `AuditLogs`

Tích hợp đã có:

- Service account đọc/ghi Google Sheets.
- GAS gửi email lịch dạy.
- GAS upload giáo án lên Google Drive.
- GAS xóa file giáo án khỏi Google Drive.
- Backend normalize header/cell khi đọc Sheet để tránh lỗi BOM, khoảng trắng, hoặc lệch cột.

## 8. Kiểm Thử Và Build

Các lần thay đổi quan trọng gần đây đều đã chạy:

- `npx tsc --noEmit`
- `npm run build`

Trạng thái gần nhất:

- TypeScript pass.
- Next build pass.
- Code đã push lên `main`.

Các commit gần nhất:

- `262a03e` - Support per-row teaching date in batch assignment
- `7ea933f` - Support batch schedule assignment and weekly digest emails
- `8915c27` - Refine Vietnamese schedule email template and objective formatting
- `2ba722e` - Harden teacher validation and normalize sheet headers
- `896bedd` - Prevent invalid timeslot assignment and honor active time slots

## 9. Kế Hoạch Phiên Tiếp Theo

Ưu tiên tiếp theo tại phân hệ `Giao lịch`:

- Khi người dùng chọn `Lớp - Khối`, hệ thống tự xác định khối của lớp.
- Danh sách `Bài học` trong dòng lịch sẽ tự lọc theo khối đó.
- Mục tiêu là giúp giáo vụ chọn bài nhanh hơn và giảm chọn nhầm bài không đúng khối.

Hướng triển khai đề xuất:

- Trong từng dòng lịch, khi `classId` thay đổi thì lấy `grade` từ `ClassRoom`.
- Bộ chọn bài học chỉ hiển thị `Lessons` có `lesson.grade === classRoom.grade`.
- Nếu bài học đang chọn không thuộc khối mới, tự chọn bài đầu tiên phù hợp.
- Nếu khối chưa có bài học, hiển thị cảnh báo rõ trong dòng lịch.
- Preview và email sẽ dùng đúng bài học đã lọc theo khối.

## 10. Ghi Chú Kết Thúc Phiên

Phiên hôm nay kết thúc ở trạng thái:

- Giao lịch đã gửi được.
- Email tổng hợp theo giáo viên đã có.
- Mỗi dòng lịch đã có ngày dạy riêng.
- Kế hoạch tiếp theo đã rõ: lọc bài học theo khối của lớp trong từng dòng giao lịch.
