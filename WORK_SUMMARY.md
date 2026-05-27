# WORK SUMMARY - HỌC VIỆN METTASOUL Scheduler

Ngày cập nhật: 27/05/2026
Nhánh hiện tại: `main`

## 1. Tổng Quan Trạng Thái

HỌC VIỆN METTASOUL Scheduler là web app Next.js dùng cho giáo vụ/admin quản lý lịch dạy kỹ năng sống, giao lịch cho giáo viên, theo dõi giáo án, điểm danh, thông báo vận hành, hướng dẫn sử dụng và phản hồi người dùng.

Trạng thái hiện tại:

- Dữ liệu chính đọc/ghi qua Google Sheets.
- Google Apps Script dùng cho gửi email lịch dạy và upload/xóa file giáo án trên Google Drive.
- Giao diện đã rebrand sang `HỌC VIỆN METTASOUL`.
- Menu `Lịch tổng` và `Lịch của tôi` mặc định ở chế độ xem tuần.
- Font giao diện chính dùng Quicksand.
- Quy trình làm việc đã chốt: hoàn tất thay đổi thì build/kiểm tra phù hợp, commit và push lên GitHub.

## 2. Phân Hệ Giao Lịch

Đã hoàn tất:

- Tạo lịch dạy theo lô, một lần gửi có thể tạo nhiều dòng lịch.
- Một lần gửi có thể giao cho nhiều giáo viên.
- Mỗi dòng lịch gồm ngày dạy, trường, khối/lớp, khung giờ, bài học và môi trường dạy học.
- Luồng chọn theo thứ tự: trường, khối, lớp, khung giờ, bài học, môi trường.
- Khi đổi khối, danh sách lớp và bài học tự lọc theo khối tương ứng.
- Có preview lịch sắp gửi ở bên phải.
- Preview có bộ lọc dropdown theo giáo viên để giáo vụ kiểm trước khi gửi hàng loạt.
- Đã thêm môi trường dạy học: `Trong lớp`, `Ngoài sân`, `Nhà thi đấu`, `Báo cáo sân trường`.
- Môi trường dạy học hiển thị dạng badge màu riêng trên từng lịch, phục vụ thống kê/KPI sau này.
- Hiển thị khung giờ gọn, bỏ nhãn buổi như `tiết sáng`, chỉ giữ giờ bắt đầu và kết thúc.
- Backend validate trường, lớp, giáo viên, khung giờ, bài học và quan hệ bài học đúng khối.
- Backend đã gia cố để resolve dữ liệu theo cả ID và tên hiển thị, tránh lỗi khi Sheet/UI chưa đồng bộ tuyệt đối.
- Đã sửa lỗi `Trường đã chọn không tồn tại` khi gửi lịch do Google Sheets `batchGet` trả range không khớp format cũ.
- Đã giảm số lần đọc Google Sheets khi tạo lịch để hạn chế lỗi quota.
- Đã chuẩn hóa header Google Sheet để nhận các biến thể như `ID`, `Id`, `id`, `schoolId`, `timeSlotId`, `Tiêu đề`, `Bài học`, `Tên bài học`, `Mục tiêu`.

## 3. Email Lịch Dạy

Đã hoàn tất một phần:

- Email lịch dạy được gom theo từng giáo viên.
- Subject email in hoa theo tuần: `LỊCH DẠY TUẦN ... NĂM ...`.
- Email có bảng lịch viền cam `#ff9500`.
- Mỗi dòng lịch có nút `XÁC NHẬN`.
- Có nút `XÁC NHẬN TẤT CẢ (TẤT CẢ LỊCH ĐƯỢC XÁC NHẬN)`.
- Đã thêm route xác nhận tất cả lịch trong email.
- Đã cập nhật `scripts/gas-life-skill-webhook.js` để sender name là `HỌC VIỆN METTASOUL`, có `requestId`, `templateVersion` và lớp normalize nội dung trước khi gửi.

Tồn tại cuối phiên:

- Email thực tế vẫn còn lỗi chính tả `KỸ TRỐNG` và câu cũ `giáo vụ vừa lịch giảng dạy`.
- Gmail sender đã đổi đúng sang `HỌC VIỆN METTASOUL`, chứng tỏ GAS mới có chạy, nhưng HTML gửi vào GAS vẫn còn nội dung cũ.
- Phiên sau cần kiểm tra nguồn HTML thực tế trước khi GAS gửi bằng cách log `payload.templateVersion` và đoạn đầu `payload.html`.
- Cần xác nhận app deploy đang chạy đúng commit mới và không còn template email nào khác ngoài `lib/email.ts`.
- Cần kiểm tra dữ liệu bài học trong tab `Lessons`, bảo đảm tên bài đúng là `Thấu cảm và trắc ẩn`.

## 4. Phân Hệ Lịch Tổng Và Lịch Của Tôi

Đã hoàn tất:

- Có chế độ xem tháng, tuần, ngày.
- Mặc định vào chế độ xem tuần để giao diện gọn hơn.
- Admin xem toàn bộ lịch; giáo viên chỉ xem lịch của mình.
- Có bộ lọc theo trạng thái, giáo viên, trường, lớp, khung giờ và khoảng ngày.
- Có thống kê nhanh tổng lịch, lịch chờ xác nhận, đã nhận, đã điểm danh và đã hủy.
- Có modal chi tiết lịch với thông tin ngày dạy, giáo viên, trường, lớp, khung giờ, bài học, mục tiêu và trạng thái.
- Có thao tác hủy lịch, chuyển giáo viên, nhắc xác nhận và lịch sử thao tác qua `AuditLogs`.

## 5. Phân Hệ Giáo Viên

Đã hoàn tất:

- Thêm, sửa, bật/tắt và xóa giáo viên.
- Tự tạo tài khoản `Users` liên kết với `Teachers`.
- Đổi phân quyền admin/giáo viên.
- Tìm kiếm giáo viên theo tên, email, số điện thoại và chuyên môn.
- Import giáo viên hàng loạt từ Excel/CSV/TSV.
- Chặn email trùng trong file import và bỏ qua email đã tồn tại.
- Khi tắt giáo viên, tài khoản liên kết cũng chuyển sang không hoạt động.

## 6. Tổng Quan Giáo Viên

Đã hoàn tất:

- Thêm menu Tổng quan cho giao diện giáo viên.
- Có lọc theo thời gian.
- Thống kê số lịch đã dạy và lịch sắp dạy.
- Thống kê số lần điểm danh trễ và không điểm danh.
- Thống kê giáo án đã gửi và chưa gửi.
- Thống kê số tiết theo môi trường: trong lớp, ngoài sân, nhà thi đấu, báo cáo sân trường.
- Bấm vào từng card sẽ mở danh sách chi tiết tương ứng.
- Admin được chọn tài khoản để xem; giáo viên chỉ xem dữ liệu của chính họ.
- Sáu card tổng quan đã được sắp xếp gọn trên một hàng, dùng màu phân biệt và font số lớn hơn.

## 7. Phân Hệ Giáo Án

Đã hoàn tất:

- Upload giáo án qua GAS Web App.
- Hỗ trợ nhiều định dạng: PDF, Word, PowerPoint, Excel, TXT, CSV.
- Hỗ trợ upload nhiều file trong một lần.
- Giới hạn mỗi file 10MB.
- Một lịch có thể có nhiều giáo án.
- Admin có màn tổng quan giáo án và thống kê đã nộp/chưa nộp.
- Giáo viên có màn giáo án của tôi, ưu tiên lịch cần nộp.
- Có sửa tên giáo án, xóa bản ghi Google Sheet và xóa file Google Drive qua GAS.
- Backend kiểm tra quyền: giáo viên chỉ xử lý giáo án của mình, admin có toàn quyền.

## 8. Phân Hệ Điểm Danh

Đã hoàn tất:

- Backend điểm danh ghi `Attendance`, cập nhật `Schedules` sang `attended` và ghi `AuditLogs`.
- Giáo viên chỉ điểm danh lịch của mình; admin có quyền toàn hệ thống.
- Chặn điểm danh trùng và chặn điểm danh lịch đã hủy.
- Rule thời gian: chặn điểm danh quá sớm trước giờ bắt đầu; các lần sau giờ bắt đầu được lưu và tính là trễ để admin theo dõi.
- Admin có dashboard điểm danh với card: tiết hôm nay, đã điểm danh, chưa điểm danh, điểm danh trễ.
- Bấm từng card mở danh sách chi tiết tương ứng.
- Có cảnh báo giáo viên thường không điểm danh hoặc điểm danh trễ.
- Bấm vào cảnh báo mở danh sách các lần cụ thể.
- Giao diện giáo viên giữ dạng điểm danh từng tiết, bổ sung ngày dạy, giờ bắt đầu và giờ kết thúc.
- Khi đã điểm danh, nhãn/nút chuyển sang trạng thái xám phù hợp.

## 9. Phân Hệ Cấu Hình

Đã hoàn tất:

- Quản lý trường: thêm, sửa, xóa.
- Quản lý lớp: thêm, sửa, xóa, nhập nhiều lớp cùng lúc.
- Tự xác định khối từ tên lớp, ví dụ `10A1` thành `Khối 10`.
- Quản lý khung giờ trong tab Cấu hình.
- Thêm/sửa/bật/tắt khung giờ.
- Chỉ chấp nhận khung giờ 45 phút hoặc 90 phút.
- Import khung giờ từ Excel/CSV/TSV.
- Bỏ phần cấu hình Google Workspace khỏi giao diện thường dùng.

## 10. Thông Báo, Hướng Dẫn Và Feedback

Đã hoàn tất:

- Chuông thông báo đã mở được danh sách thông báo, không chỉ hiển thị badge.
- Thêm phân hệ `Hướng dẫn sử dụng` trong Cấu hình.
- Tạo trang hướng dẫn HTML tại `public/huong-dan-su-dung/index.html`.
- Hướng dẫn sử dụng đã chia theo phân hệ và dùng font Quicksand.
- Thêm chức năng feedback cho admin và giáo viên.
- Feedback mở bằng modal, có các trường: muốn cập nhật/nâng cấp tính năng nào, trong menu nào, quy trình mong muốn ra sao.

## 11. Phân Hệ Chat

Trạng thái hiện tại:

- Trước đó đã từng triển khai chat lưu Google Sheets và có các API chat.
- Theo quyết định hiện tại, phân hệ chat đã được bỏ khỏi hệ thống/kế hoạch sử dụng.
- Phiên sau không tiếp tục phát triển chat trừ khi có yêu cầu khôi phục.

## 12. Commit Chính Trong Phiên 27/05/2026

- `18e3357` - Rebrand app to HOC VIEN METTASOUL and default calendar to week.
- `0d8c35c` - Refine schedule email format and add confirm-all link flow.
- `ac4d983` - Reduce Google Sheets read load on schedule creation.
- `19aafc3` - Harden Sheets header normalization for schedule send validation.
- `4f2e28f` - Make schedule creation resilient to id/name mismatches.
- `a4fb708` - Fix batch Google Sheets range mapping.
- `2c69bb7` - Polish schedule email layout and lesson header mapping.
- `09642a4` - Harden GAS schedule email delivery.
- `8786db7` - Add GAS email legacy content sanitizer.
- `856124a` - Force normalize schedule email content in GAS.
- `af81c28` - Update work summary for May 27 session.

## 13. Ưu Tiên Phiên Sau

- Xử lý triệt để lỗi chính tả email lịch dạy còn tồn.
- Log và xác nhận HTML thực tế được gửi vào GAS trước khi `MailApp.sendEmail`.
- Kiểm tra app deploy có chạy đúng commit mới hay không.
- Kiểm tra trong GAS còn file/hàm cũ nào tạo HTML hoặc ghi đè hàm gửi mail hay không.
- Kiểm tra dữ liệu bài học trong Google Sheet tab `Lessons`.
- Gửi lại một lịch test và xác nhận email đúng toàn bộ: sender, subject, tiêu đề hệ thống, câu chào, tên bài, khung giờ, header bảng và CTA.
