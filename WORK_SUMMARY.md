# WORK SUMMARY - Life Skill Scheduler

Ngày cập nhật: 26/05/2026
Nhánh hiện tại: `main`

## 1. Tổng Quan Trạng Thái

Life Skill Scheduler là web app Next.js dùng cho giáo vụ/admin quản lý lịch dạy kỹ năng sống, giao lịch cho giáo viên, theo dõi giáo án, điểm danh, thông báo vận hành và chat nội bộ.

Trạng thái đã hoàn tất đến hiện tại:

- Dữ liệu chính đọc/ghi qua Google Sheets.
- Google Apps Script được dùng cho email lịch dạy và upload/xóa file giáo án trên Google Drive.
- UI chính đã chuyển sang font `Quicksand` và tăng độ dày chữ mặc định lên một cấp để dễ đọc hơn.
- Đã thay `window.confirm`/`window.prompt` bằng dialog nội bộ và toast trong app.
- Phân hệ Khung giờ đã chuyển vào `Cấu hình`, có quản trị bảng, sửa/bật/tắt/xóa mềm và import Excel chuẩn 45/90 phút.
- Đã có quy trình bắt buộc: sau khi chốt tính năng phân hệ, cập nhật `USAGE_GUIDE_DRAFT.md`, build/test, commit và push lên `main`.

## 2. Phân Hệ Giao Lịch

Đã hoàn tất:

- Tạo lịch dạy theo lô: một lần gửi có thể tạo nhiều dòng lịch.
- Một lần gửi có thể giao cho nhiều giáo viên.
- Mỗi dòng lịch gồm: ngày dạy, trường, khối/lớp, khung giờ, bài học.
- Luồng chọn mới theo thứ tự `Trường -> Khối -> Lớp -> Khung giờ -> Bài học`.
- Khi đổi khối, danh sách lớp và bài học tự lọc theo khối tương ứng.
- Có preview lịch sắp gửi trước khi tạo lịch chính thức.
- Backend validate trường, lớp, khung giờ, giáo viên, bài học và quan hệ bài học đúng khối.
- Sau khi tạo lịch, hệ thống ghi `Schedules`, tạo `ChatThreads`, tạo `Notifications` và ghi `AuditLogs`.
- Email lịch dạy được gom theo từng giáo viên, mỗi giáo viên nhận một email tổng hợp thay vì nhiều email rời.
- Email có tiêu đề theo tuần ISO và nội dung dạng bảng để xem nhanh nhiều lịch.
- Mỗi dòng lịch trong email tổng hợp có nút xác nhận riêng.
- Teacher chỉ thấy lịch của mình; admin thấy toàn bộ.
- Backend có kiểm tra quyền cho tạo, hủy, chuyển và xác nhận lịch.
- Chính sách hiện tại: cho phép trùng giờ, không chặn conflict.

Các lỗi đã xử lý trong phân hệ này:

- Lỗi `Unauthorized` khi gửi lịch bằng tài khoản nội bộ.
- Lỗi trường/lớp/khung giờ/giáo viên không tồn tại do dữ liệu Sheet và ID chưa đồng bộ.
- Lỗi preview hiện lịch cũ thay vì lịch sắp gửi.
- Lỗi danh sách giáo viên chọn bị lệch khi giáo viên đã tắt hoặc không hợp lệ.

## 3. Phân Hệ Giáo Viên

Đã hoàn tất:

- Thêm giáo viên đơn lẻ với họ tên, email, số điện thoại, chuyên môn và quyền.
- Tự động tạo tài khoản `Users` liên kết với bản ghi `Teachers`.
- Đổi phân quyền giáo viên/admin trực tiếp trên danh sách.
- Sửa thông tin giáo viên ngay trên từng dòng.
- Bật/tắt trạng thái hoạt động của giáo viên.
- Xóa giáo viên, có kiểm tra ràng buộc lịch dạy liên quan.
- Tìm giáo viên nhanh trên thanh tìm kiếm; gõ từ khóa sẽ lọc tức thời theo tên, email, số điện thoại hoặc chuyên môn.
- Danh sách giáo viên hiển thị dạng bảng ngang như Excel với các cột chính.
- Nút `Thêm giáo viên` mở modal riêng.
- Hỗ trợ tải mẫu Excel và import hàng loạt giáo viên từ `.xlsx`, `.csv`, `.tsv`.
- Import có validate bắt buộc họ tên/email, chuẩn hóa quyền, chặn email trùng trong file và bỏ qua email đã tồn tại.

Ý nghĩa bật/tắt giáo viên:

- `Bật`: giáo viên đang hoạt động và có thể được chọn để giao lịch mới.
- `Tắt`: giáo viên tạm ngưng, không mất dữ liệu lịch sử, không được chọn khi giao lịch mới.
- Khi tắt giáo viên, tài khoản `Users` liên kết cũng chuyển sang trạng thái không hoạt động.

## 4. Phân Hệ Lịch Tổng

Đã hoàn tất:

- Hiển thị lịch tổng dạng lưới tháng, chia thành các ô theo ngày.
- Ngày hiện tại luôn được làm nổi bật.
- Có chế độ xem `Tháng`, `Tuần`, `Ngày`.
- Ô ngày trong chế độ tháng chỉ hiện nhãn số lượng lịch và tên giáo viên, không hiện tên chuyên đề để giữ giao diện gọn.
- Ngày không có lịch không hiện chữ `Trống`.
- Khi bấm vào ô ngày, màn hình tự cuộn xuống vùng chi tiết bên dưới.
- Vùng chi tiết hiện danh sách lịch trong ngày theo dạng dòng lịch hiện tại.
- Bấm vào bất kỳ điểm nào trên dòng lịch chi tiết sẽ mở modal chi tiết giữa màn hình.
- Modal chi tiết lịch hiện đầy đủ: ngày dạy, giáo viên, số điện thoại, trường, lớp, trạng thái, khung giờ, giáo án và mục tiêu bài học.
- Mục tiêu bài học trong modal được tách dòng thành từng mục để dễ đọc.
- Giao diện lịch dùng màu nhấn theo ngữ nghĩa: trạng thái, điểm danh, khung giờ, trường, lớp.
- Có bộ lọc nâng cao theo trạng thái, giáo viên, trường, lớp, khung giờ và khoảng ngày.
- Có sắp xếp theo ngày tăng dần, ngày giảm dần hoặc trạng thái.
- Bộ lọc lịch được ghi nhớ trên trình duyệt.
- Có thống kê nhanh tổng lịch, lịch chờ xác nhận, đã nhận, đã điểm danh và đã hủy.
- Có cảnh báo vận hành: lịch sắp dạy chưa xác nhận, lịch quá ngày chưa điểm danh, giáo viên có nhiều lịch hủy.
- Bấm vào thẻ cảnh báo vận hành sẽ mở modal liệt kê từng lịch liên quan với: ngày dạy, giáo viên, lớp, trường, tên chuyên đề.
- Trong modal cảnh báo, bấm vào một dòng lịch sẽ mở tiếp modal chi tiết đầy đủ của lịch đó.
- Có thao tác hàng loạt trong chi tiết ngày: chọn nhiều lịch để hủy, chuyển giáo viên hoặc gửi nhắc xác nhận.
- Có lịch sử thao tác trên từng lịch, đọc từ `AuditLogs`.
- Admin có thể hủy lịch hoặc chuyển lịch ngay trong danh sách chi tiết.
- Giáo viên chỉ thấy lịch của mình và có thể xác nhận lịch trong danh sách chi tiết.

## 5. Phân Hệ Giáo Án

Đã hoàn tất:

- Upload giáo án qua GAS Web App.
- Hỗ trợ nhiều định dạng: `pdf`, `doc`, `docx`, `ppt`, `pptx`, `xls`, `xlsx`, `txt`, `csv`.
- Hỗ trợ upload nhiều file trong một lần.
- Giới hạn mỗi file 10MB.
- Mỗi lịch có thể lưu nhiều giáo án.
- Hiện danh sách giáo án theo từng lịch.
- Sửa tên giáo án.
- Xóa bản ghi giáo án trên Google Sheet.
- Xóa file giáo án trên Google Drive qua GAS.
- Backend kiểm tra quyền: teacher chỉ xử lý giáo án của mình, admin có toàn quyền.

## 6. Phân Hệ Cấu Hình Trường/Lớp

Đã hoàn tất:

- Thêm, sửa, xóa trường.
- Thêm, sửa, xóa lớp.
- Khi thêm lớp có thể nhập nhiều tên lớp cùng lúc, cách nhau bằng dấu phẩy.
- Hệ thống tự xác định khối từ tên lớp, ví dụ `10A1` thành `Khối 10`.
- Dữ liệu trường/lớp ghi vào Google Sheet và được dùng lại trong phân hệ Giao lịch.

## 7. Phân Hệ Khung Giờ

Đã hoàn tất:

- Chuyển quản lý khung giờ vào tab `Cấu hình` để gom cùng dữ liệu nền.
- Bỏ tab `Khung giờ` riêng khỏi sidebar admin.
- Thêm khung giờ thủ công với validate giờ bắt đầu/kết thúc.
- Chỉ chấp nhận khung giờ có thời lượng 45 phút hoặc 90 phút.
- Hiển thị danh sách khung giờ dạng bảng với tên, giờ bắt đầu, giờ kết thúc, số phút, trạng thái và thao tác.
- Sửa nhanh từng khung giờ ngay trên bảng.
- Bật/tắt khung giờ; khung giờ tắt không được chọn khi giao lịch mới.
- Xóa mềm khung giờ bằng cách chuyển trạng thái sang tắt, giữ an toàn cho lịch sử.
- Tải mẫu Excel khung giờ.
- Import hàng loạt khung giờ từ `.xlsx`, `.csv`, `.tsv`.
- Import có validate cột bắt buộc, định dạng `HH:mm`, thời lượng 45/90 phút, số phút khớp giờ và chặn trùng tên/trùng giờ.
- API `/api/time-slots` hỗ trợ tạo nhiều khung giờ một lần.
- API `/api/time-slots/[id]` hỗ trợ cập nhật/sửa/bật/tắt từng khung giờ.

## 8. Email Lịch Dạy

Đã hoàn tất:

- Đổi nhận diện email sang `HỆ THỐNG THÔNG BÁO LỊCH DẠY KỸ NĂNG SỐNG METTASOUL`.
- Sửa nội dung tiếng Việt có dấu trong mẫu email.
- Căn giữa tiêu đề và nút xác nhận lịch dạy.
- Mục tiêu bài học trong email được tách thành từng dòng.
- Email tổng hợp có bảng lịch và nút xác nhận riêng cho từng dòng.

## 9. Dữ Liệu Và Tích Hợp

Nguồn dữ liệu chính hiện tại là Google Sheets với các tab:

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

Các API/tích hợp đã dùng:

- Next.js API routes cho dữ liệu ứng dụng, lịch, giáo viên, trường/lớp, bài học, khung giờ, giáo án, điểm danh, thông báo, auth.
- Google Sheets cho đọc/ghi dữ liệu nghiệp vụ.
- Google Drive qua GAS cho file giáo án.
- GAS cho gửi email lịch dạy và xử lý file.

## 10. Tài Liệu Và Quy Trình Làm Việc

Đã thiết lập quy trình:

- Mỗi khi chốt xong một tính năng/phiên nâng cấp phân hệ, cập nhật `USAGE_GUIDE_DRAFT.md`.
- Sau khi cập nhật code và tài liệu, chạy build/kiểm tra phù hợp.
- Commit và push lên `main` để Vercel có thể deploy giao diện mới.
- Mặc định push lên GitHub sau khi hoàn tất, không hỏi lại từng lần.

## 11. Kiểm Tra Gần Nhất

Lần kiểm tra gần nhất:

- Lệnh: `npm.cmd run -s build`
- Kết quả: build thành công.
- Commit nâng cấp khung giờ đã push: `a799b30 Upgrade time slot configuration`
