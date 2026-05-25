# Hướng Dẫn Sử Dụng - Bản Nháp

Tài liệu này được cập nhật sau mỗi phân hệ để tổng hợp đầy đủ tính năng, quy trình thao tác thực tế và các điểm cần lưu ý. Nội dung sẽ được dùng làm nền tảng cho file hướng dẫn sử dụng chính thức sau này.

## 1. Phân Hệ Giao Lịch

### Tính năng hiện có
- Tạo lịch dạy theo lô: một lần gửi có thể tạo nhiều dòng lịch và giao cho nhiều giáo viên.
- Xem trước lịch sắp gửi trước khi tạo lịch chính thức.
- Tự động tạo luồng chat, thông báo và nhật ký thao tác khi gửi lịch.
- Gửi email tổng hợp theo từng giáo viên thay vì gửi rời từng lịch.
- Kiểm tra dữ liệu ở backend cho trường, lớp, khung giờ, giáo viên và bài học.
- Kiểm tra bài học phải đúng khối của lớp ở cả giao diện và backend.

### Quy trình thao tác trên mỗi dòng lịch
- Luồng mới mỗi dòng: khi giao lịch sẽ chọn `Trường -> Khối -> Lớp -> Khung giờ -> Bài học`.
- Khi đổi `Khối`, danh sách `Lớp` chỉ hiển thị các lớp thuộc khối đã chọn.
- Danh sách `Bài học` chỉ hiển thị các bài thuộc khối đã chọn.
- Nếu khối chưa có bài học đang hoạt động, hệ thống hiển thị cảnh báo rõ ngay trên dòng lịch.

### Lợi ích nghiệp vụ
- Giảm danh sách quá dài khi chọn lớp.
- Giảm sai sót khi chọn nhầm bài học khác khối.
- Giúp giáo vụ giao lịch nhanh hơn và dễ hướng dẫn người dùng mới hơn.

## 2. Phân Hệ Giáo Viên

### Tính năng hiện có
- Thêm giáo viên đơn lẻ với các thông tin: họ tên, email, số điện thoại, chuyên môn và quyền.
- Tự động tạo tài khoản `Users` liên kết với bản ghi `Teachers`.
- Đổi phân quyền giáo viên hoặc quản trị trực tiếp trên danh sách giáo viên.
- Sửa thông tin giáo viên trực tiếp trên từng dòng (họ tên, email, số điện thoại, chuyên môn).
- Bật/Tắt trạng thái hoạt động giáo viên ngay trên bảng quản lý.
- Xóa giáo viên (có kiểm tra ràng buộc dữ liệu lịch dạy liên quan).
- Tìm giáo viên nhanh ngay trên thanh tìm kiếm: gõ từ khóa sẽ lọc tức thời theo tên, email, số điện thoại hoặc chuyên môn.
- Danh sách giáo viên hiển thị dạng bảng ngang như Excel với các cột: `Tên giáo viên`, `Số điện thoại`, `Email`, `Phân quyền`.
- Nút `Thêm giáo viên` mở modal riêng để thêm thủ công hoặc import hàng loạt.

### Quy trình thêm giáo viên thủ công
- Từ màn hình `Giáo viên`, bấm `Thêm giáo viên`.
- Modal hiển thị các trường nhập: `Họ tên`, `Email Google`, `Số điện thoại`, `Chuyên môn`, `Quyền`.
- Người dùng điền thông tin và bấm `Lưu giáo viên`.
- Hệ thống tạo đồng thời bản ghi giáo viên và tài khoản đăng nhập liên kết.

### Quy trình import giáo viên bằng Excel
- Từ modal `Thêm giáo viên`, bấm `Tải mẫu Excel`.
- File mẫu có sẵn 2 dòng ví dụ: một dòng quyền `admin` và một dòng quyền `giáo viên`.
- Người dùng điền dữ liệu theo các cột bắt buộc: `Họ tên`, `Email Google`, `Số điện thoại`, `Chuyên môn`, `Quyền`.
- Người dùng bấm `Import file` để nạp file `.xlsx`, `.csv` hoặc `.tsv`.
- Import thành công sẽ tạo đồng thời bản ghi `Teachers` và tài khoản `Users`.

### Kiểm tra dữ liệu khi import
- Bắt buộc có họ tên và email hợp lệ.
- Quyền chỉ nhận `Giáo viên` hoặc `Quản trị`; hệ thống tự chuẩn hóa về `teacher` hoặc `admin`.
- Chặn email trùng trong cùng file import.
- Cảnh báo và bỏ qua các dòng có email đã tồn tại trong hệ thống.

### Ý nghĩa Bật/Tắt giáo viên
- `Bật`: giáo viên đang hoạt động, có thể được chọn để giao lịch mới.
- `Tắt`: giáo viên tạm ngưng, không mất dữ liệu lịch sử; hệ thống không cho chọn để giao lịch mới.
- Khi tắt, tài khoản `Users` liên kết cũng chuyển sang trạng thái không hoạt động.

## 3. Ghi Chú Cập Nhật Tài Liệu

Sau mỗi lần nâng cấp phân hệ, cần bổ sung vào tài liệu này:
- Danh sách tính năng mới.
- Quy trình thao tác thực tế cho người dùng.
- Các kiểm tra dữ liệu, cảnh báo hoặc giới hạn quan trọng.

### Quy trình làm việc bắt buộc (chốt phiên)
- Bước 1: Hoàn tất code + tự kiểm tra chạy ổn.
- Bước 2: Cập nhật `USAGE_GUIDE_DRAFT.md` cho đúng phân hệ vừa làm (tính năng, thao tác, lưu ý).
- Bước 3: Rà lại nhanh nội dung tài liệu để khớp hành vi thực tế trên UI/API.
- Bước 4: Mới được commit và push.

## 4. Cập Nhật Giao Diện Toàn Hệ Thống

- Font chữ hiển thị chính đã chuyển từ `Be Vietnam Pro` sang `Quicksand` để thử nghiệm thẩm mỹ mới cho toàn bộ ứng dụng.
