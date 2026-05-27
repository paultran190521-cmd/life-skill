# HƯỚNG DẪN SỬ DỤNG (BẢN NHÁP)

Tài liệu này mô tả đầy đủ các phân hệ đang hoạt động của hệ thống quản lý lịch dạy, giáo án và điểm danh.

## 1. Tổng Quan Hệ Thống

### Mục tiêu
- Quản lý lịch dạy kỹ năng sống theo trường/lớp/khung giờ.
- Theo dõi vòng đời vận hành: giao lịch -> xác nhận -> nộp giáo án -> điểm danh.
- Đồng bộ dữ liệu chính lên Google Sheets.

### Vai trò người dùng
- `Admin`:
  - Quản trị toàn bộ dữ liệu và phân hệ.
  - Giao lịch, điều phối, theo dõi cảnh báo vận hành.
- `Teacher`:
  - Chỉ xem và thao tác trên dữ liệu của chính mình.
  - Xác nhận lịch, nộp giáo án, điểm danh.

## 2. Phân Hệ Đăng Nhập & Phân Quyền

### Tính năng hiện có
- Đăng nhập bằng Google (`Google Login`).
- Lưu phiên đăng nhập qua session token.
- Kiểm tra quyền ở API trước khi cho phép thao tác.
- Tự động gắn tài khoản `teacher` với `teacherId` để giới hạn dữ liệu đúng giáo viên.

### Luật phân quyền chính
- `Admin`: toàn quyền đọc/ghi hầu hết dữ liệu nghiệp vụ.
- `Teacher`: chỉ thao tác lịch, giáo án, điểm danh thuộc `teacherId` của chính mình.

## 3. Phân Hệ Tổng Quan (Dashboard)

### Tính năng hiện có
- 4 chỉ số nhanh:
  - Lịch trong hệ thống.
  - Đã nhận lịch.
  - Giáo án đã nộp.
  - Đã điểm danh.
- Khối “Lịch dạy gần nhất” để theo dõi nhanh lịch mới.
- Khối “Thông báo vận hành” với đếm số thông báo chưa đọc theo vai trò.

## 4. Phân Hệ Giao Lịch

### Tính năng hiện có
- Tạo lịch theo lô:
  - Một lần tạo nhiều dòng lịch.
  - Giao cho nhiều giáo viên cùng lúc.
- Mỗi dòng lịch gồm:
  - Ngày dạy, Trường, Khối, Lớp, Khung giờ, Bài học.
- Ràng buộc dữ liệu:
  - Lớp phụ thuộc trường/khối.
  - Bài học phụ thuộc khối.
  - Khung giờ chỉ dùng các khung đang bật.
- Tự động gửi email tổng hợp lịch theo từng giáo viên.
- Tự động ghi nhật ký thao tác (`AuditLogs`) và thông báo (`Notifications`).

### Quy trình thao tác
- Chọn giáo viên nhận lịch.
- Thêm/sửa/xóa dòng lịch nháp.
- Bấm gửi lịch.
- Hệ thống lưu lịch + gửi email + sinh thông báo.

## 5. Phân Hệ Lịch Tổng

### Tính năng hiện có
- 3 chế độ xem: `Tháng`, `Tuần`, `Ngày`.
- Bộ lọc nâng cao:
  - Trạng thái, giáo viên, trường, lớp, khung giờ, khoảng ngày.
- Sắp xếp:
  - Ngày tăng dần, ngày giảm dần, theo trạng thái.
- Tự lưu bộ lọc trên trình duyệt để dùng lại.
- Hiển thị thống kê trạng thái nhanh: tổng lịch, chờ xác nhận, đã nhận, điểm danh, hủy.
- Mở chi tiết từng ngày và từng lịch.
- Admin có thao tác hàng loạt trong chi tiết ngày:
  - Hủy lịch.
  - Chuyển giáo viên.
  - Nhắc xác nhận.
- Có cảnh báo vận hành (ví dụ lịch sắp dạy chưa xác nhận, lịch quá ngày chưa điểm danh, giáo viên có nhiều lịch hủy).

### Theo vai trò
- Admin: xem toàn bộ lịch.
- Teacher: chỉ xem lịch của bản thân.

## 6. Phân Hệ Giáo Viên

### Tính năng hiện có
- Danh sách giáo viên dạng bảng quản trị.
- Thêm giáo viên thủ công qua modal.
- Import giáo viên từ file `.xlsx/.csv/.tsv`.
- Tải file mẫu import.
- Sửa thông tin giáo viên trực tiếp.
- Đổi quyền `teacher/admin`.
- Bật/tắt hoạt động giáo viên.
- Xóa giáo viên (có kiểm tra ràng buộc dữ liệu).
- Tìm nhanh theo tên, email, số điện thoại, chuyên môn.

### Dữ liệu liên quan
- Khi tạo giáo viên, hệ thống tạo/đồng bộ luôn tài khoản người dùng (`Users`) tương ứng.

## 7. Phân Hệ Bài Học

### Tính năng hiện có
- Nhập bài học hàng loạt trực tiếp trên lưới nhập liệu.
- Import từ file spreadsheet (`.xlsx/.csv/.tsv`).
- Tải file mẫu nhập bài học.
- Quản lý thư viện bài học:
  - Tìm kiếm theo tên/mục tiêu.
  - Lọc theo khối.
  - Sửa nội dung bài học.
  - Xóa mềm bài học (ẩn khỏi luồng tạo lịch mới).
- Mỗi bài học quản lý các trường:
  - Khối, tên chuyên đề, mục tiêu, link giáo án mẫu, số phút.

### Ràng buộc chính
- Thời lượng bài học đang dùng chuẩn 45 hoặc 90 phút trong UI quản trị hiện tại.

## 8. Phân Hệ Giáo Án

### Tính năng hiện có
- Tách theo vai trò:
  - Admin: tổng quan toàn hệ thống.
  - Teacher: giáo án của tôi.
- Các card tổng quan:
  - Đã nộp, đã có giáo án, chưa có giáo án, sắp dạy còn thiếu.
- Bấm card để lọc danh sách tương ứng.
- Upload nhiều file giáo án theo từng lịch.
- Mở file trên Drive qua link.
- Sửa tên file giáo án.
- Xóa giáo án.
- Hiển thị ngữ cảnh lịch đầy đủ khi xem giáo án:
  - Ngày dạy, trường, lớp, bài học, khung giờ (bắt đầu/kết thúc).

### Ràng buộc chính
- Giới hạn dung lượng file: 10MB/file.
- Định dạng hỗ trợ: `pdf`, `doc`, `docx`, `ppt`, `pptx`, `xls`, `xlsx`, `txt`, `csv`.

## 9. Phân Hệ Điểm Danh

### Tính năng hiện có
- Teacher điểm danh theo từng tiết của mình.
- Mỗi dòng tiết hiển thị:
  - Bài học, trường/lớp, ngày dạy, giờ bắt đầu/kết thúc.
- Sau khi điểm danh:
  - Lưu bản ghi `Attendance`.
  - Cập nhật trạng thái lịch thành `attended`.
  - Ghi `AuditLogs`.
- Chặn điểm danh trùng.
- Chặn điểm danh lịch đã hủy.

### Admin tổng quan điểm danh
- 4 card theo ngày hôm nay:
  - Tiết hôm nay.
  - Đã điểm danh hôm nay.
  - Chưa điểm danh hôm nay.
  - Điểm danh trễ hôm nay.
- Bấm từng card để mở danh sách chi tiết.
- Khối cảnh báo giáo viên theo dõi:
  - Giáo viên có số lần chưa điểm danh cao.
  - Giáo viên có số lần điểm danh trễ cao.
- Bấm vào badge cảnh báo để mở danh sách lịch cụ thể theo từng loại vi phạm.
- Có lịch sử điểm danh gần nhất.

### Rule điểm danh
- Cho phép điểm danh sớm tối đa `30 phút` trước giờ bắt đầu.
- Sau giờ bắt đầu vẫn cho điểm danh để tránh mất dữ liệu vận hành.
- Dữ liệu có thể được đánh dấu trễ để phục vụ theo dõi admin.

## 10. Phân Hệ Cấu Hình

## 10.1 Cấu hình Trường
- Thêm trường.
- Sửa trường.
- Xóa trường.

## 10.2 Cấu hình Lớp
- Thêm lớp theo trường (hỗ trợ nhập nhiều lớp phân tách dấu phẩy).
- Tự suy ra khối từ tên lớp.
- Sửa lớp (trường, tên, khối).
- Xóa lớp.

## 10.3 Cấu hình Khung Giờ
- Thêm khung giờ thủ công.
- Sửa khung giờ.
- Bật/tắt khung giờ.
- Xóa mềm khung giờ.
- Bật/tắt hàng loạt theo danh sách chọn.
- Import khung giờ từ file.
- Tải file mẫu import.
- Cảnh báo chuẩn thời lượng (ưu tiên chuẩn 45/90 phút).

## 11. Thông Báo, Nhật Ký & Tìm Kiếm Nhanh

### Thông báo
- Hiển thị thông báo theo vai trò (`admin`, `teacher`, `all`).
- Hiển thị số thông báo mới trên giao diện.

### Nhật ký
- Ghi log thao tác nghiệp vụ chính vào `AuditLogs`:
  - Tạo lịch, xác nhận, hủy, chuyển lịch, điểm danh...

### Tìm kiếm nhanh
- Thanh tìm kiếm global hỗ trợ tìm lịch/giáo viên/lớp theo ngữ cảnh tab.

## 12. Dữ Liệu & Tích Hợp Google Sheets

### Nguồn dữ liệu
- Dữ liệu chính đọc/ghi từ Google Sheets qua API backend.
- Có trạng thái kết nối:
  - `Đã nối Google Sheet`.
  - `Dùng dữ liệu tạm` khi lỗi kết nối.

### Sheet nghiệp vụ chính
- `Users`, `Teachers`, `Schools`, `Classes`, `Lessons`, `TimeSlots`.
- `Schedules`, `LessonPlans`, `Attendance`.
- `Notifications`, `AuditLogs`.

## 13. Trạng Thái Phân Hệ Chat

- Phân hệ Chat đã được gỡ khỏi hệ thống ở phiên hiện tại.
- Không còn tab Chat trên UI.
- Không còn API chat trong backend.
- Không còn luồng tạo/sử dụng dữ liệu `ChatThreads`, `ChatMessages`.
- Đã đưa yêu cầu chat vào kế hoạch triển khai phiên sau.

## 14. Checklist Cập Nhật Tài Liệu Mỗi Phiên

- Cập nhật tính năng mới theo từng phân hệ đã chỉnh.
- Cập nhật rule nghiệp vụ nếu thay đổi.
- Đối chiếu lại hành vi UI/API thực tế trước khi commit.
- Chỉ commit/push sau khi tài liệu phản ánh đúng trạng thái hệ thống.
