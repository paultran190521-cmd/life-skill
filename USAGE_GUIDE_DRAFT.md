# HƯỚNG DẪN SỬ DỤNG METTASOUL

Ngày cập nhật: 29/05/2026
Ứng dụng: METTASOUL - Education with love
Mục tiêu: quản lý lịch dạy, giáo án, điểm danh và vận hành giáo viên kỹ năng sống trên nền Next.js + Google Sheets + Google Apps Script.

## 1. Tổng Quan Hệ Thống

METTASOUL hỗ trợ đội vận hành quản lý toàn bộ vòng đời một lịch dạy:

1. Admin tạo lịch dạy.
2. Giáo viên nhận và xác nhận lịch.
3. Giáo viên nộp giáo án nếu lịch yêu cầu.
4. Giáo viên điểm danh khi đến giờ dạy.
5. Admin theo dõi trạng thái, cảnh báo, lỗi, báo cáo và dữ liệu vận hành.

Vai trò chính:

- Admin/Giáo vụ: quản lý toàn hệ thống, giao lịch, cấu hình dữ liệu, xem toàn bộ lịch, theo dõi giáo án và điểm danh.
- Giáo viên: chỉ xem và thao tác trên lịch của chính mình.

## 2. Đăng Nhập Và Phân Quyền

Hệ thống dùng Google Login.

Khi chưa đăng nhập:

- Không tải dữ liệu vận hành chính.
- Hiển thị trạng thái chưa đăng nhập.
- Người dùng cần bấm Google Login để vào hệ thống.

Khi đã đăng nhập:

- Admin được vào các phân hệ quản trị.
- Giáo viên được đưa thẳng vào menu Lịch của tôi/Lịch dạy vì đây là nghiệp vụ quan trọng nhất.
- Giáo viên chỉ nhìn thấy hồ sơ, lịch, giáo án và điểm danh liên quan đến chính mình.

Cơ chế an toàn:

- Backend đang chạy chế độ phân quyền `enforce` mặc định.
- Các route ghi dữ liệu đều kiểm tra session và quyền trước khi xử lý.
- Nếu có sự cố quyền production, có thể rollback tạm bằng `AUTH_ENFORCEMENT_MODE=shadow`, sau đó rà log và bật lại `enforce`.

## 3. Giao Diện Chính

Giao diện hiện tại đã được tối ưu theo hướng mobile-first.

Trên điện thoại:

- Mặc định vào Lịch của tôi/Lịch dạy.
- Bỏ các thông tin kỹ thuật không cần thiết như trạng thái kết nối Google Sheet.
- Bỏ tìm kiếm trên mobile để giảm nhiễu thao tác.
- Đưa thông báo lên góc trên bên phải.
- Đưa đăng nhập/đăng xuất vào thanh menu ba gạch.
- Các khối card được thu gọn để dễ đọc trên màn hình nhỏ.
- Các popup/modal được khóa giữa màn hình, chỉ cho cuộn nội dung bên trong modal.

Trên desktop:

- Sidebar điều hướng theo vai trò.
- Header có thông tin tài khoản, thông báo và trạng thái vận hành.
- Modal chi tiết lịch, feedback, xác nhận thao tác hiển thị ổn định ở giữa màn hình.

## 4. Lịch Của Tôi / Lịch Dạy Giáo Viên

Đây là màn hình chính của giáo viên.

Tính năng chính:

- Tự động mở vào lịch của giáo viên sau khi đăng nhập.
- Tự động nhảy đến ngày hiện tại trong lịch tuần/ngày khi vào hệ thống.
- Hiển thị khối CÁC NGÀY CÓ LỊCH DẠY để giáo viên bấm nhảy nhanh đến ngày có lịch.
- Hỗ trợ xem theo Tháng, Tuần, Ngày.
- Các số ngày trong ô lịch được căn giữa để dễ nhìn trên điện thoại.
- Khi bấm vào một lịch cụ thể, mở modal chi tiết lịch dạy.
- Giáo viên chỉ thấy lịch của mình, không có bộ lọc giáo viên trên mobile.

Thông tin hiển thị trong lịch:

- Ngày dạy.
- Khung giờ.
- Bài học/chủ đề.
- Trường.
- Lớp.
- Môi trường dạy: trong lớp, ngoài sân hoặc tùy cấu hình.
- Trạng thái lịch.
- Trạng thái điểm danh.
- Giáo viên phụ trách.
- Mục tiêu bài học.
- Giáo án đã nộp nếu có.

Thao tác của giáo viên:

- Xác nhận lịch.
- Nộp giáo án.
- Điểm danh khi đến giờ.
- Xem lại chi tiết lịch.
- Gửi góp ý/nâng cấp tính năng.

## 5. Lịch Tổng Của Admin

Admin dùng Lịch tổng để theo dõi toàn bộ lịch trong hệ thống.

Tính năng chính:

- Xem lịch theo Tháng, Tuần, Ngày.
- Lọc theo trạng thái, giáo viên, trường, lớp, khung giờ và khoảng ngày trên desktop.
- Xem chi tiết từng lịch qua modal.
- Hủy lịch khi cần.
- Chuyển giáo viên phụ trách.
- Nhắc giáo viên xác nhận lịch.
- Thao tác hàng loạt theo ngày.
- Theo dõi lịch quá ngày chưa điểm danh.

An toàn phân quyền:

- Admin thấy toàn bộ lịch.
- Giáo viên không thể xem lịch của người khác qua giao diện hoặc API.
- Backend kiểm tra quyền sở hữu lịch ở các thao tác nhạy cảm.

## 6. Giao Lịch

Phân hệ Giao lịch dành cho Admin/Giáo vụ.

Quy trình chuẩn:

1. Chọn ngày dạy.
2. Chọn trường.
3. Chọn lớp.
4. Chọn khung giờ.
5. Chọn bài học.
6. Chọn môi trường dạy.
7. Chọn giáo viên nhận lịch.
8. Kiểm tra khối xem trước lịch sắp gửi.
9. Gửi lịch và email thông báo khi không còn cảnh báo.

Cơ chế chống trùng lịch:

- Chặn trùng giáo viên + ngày + khung giờ.
- Chặn trùng lớp + ngày + khung giờ.
- Kiểm tra trùng với lịch đã có trong hệ thống.
- Kiểm tra trùng ngay trong batch lịch sắp gửi.
- UI hiển thị cảnh báo đỏ nếu có xung đột.
- Nút gửi bị khóa khi còn xung đột.
- Backend trả lỗi `409 CONFLICT` nếu vẫn có xung đột ở tầng API.

Sau khi gửi lịch:

- Tạo dòng dữ liệu trong `Schedules`.
- Tạo thông báo cho giáo viên liên quan.
- Gửi email tổng hợp theo giáo viên nếu cấu hình email/GAS sẵn sàng.
- Ghi audit log để truy vết.

## 7. Giáo Án

Phân hệ Giáo án hỗ trợ quản lý tài liệu dạy học theo từng lịch.

Tính năng chính:

- Xem số giáo án đã gửi.
- Xem số lịch cần nộp giáo án.
- Xem số lịch đã có giáo án.
- Trên mobile, 3 card thống kê trong menu giáo án được gom gọn trên cùng một dòng.
- Upload file giáo án theo từng lịch.
- Hỗ trợ link ngoài như Google Drive.
- Sửa tên giáo án.
- Xóa giáo án.
- Theo dõi giáo án còn thiếu.

Quyền thao tác:

- Admin quản lý toàn bộ giáo án.
- Giáo viên chỉ thao tác với giáo án thuộc lịch của mình.

Giới hạn upload:

- File tối đa 10MB.
- Hỗ trợ các định dạng phổ biến: PDF, Word, PowerPoint, Excel, TXT, CSV.
- Upload đi qua Google Apps Script khi cấu hình webhook sẵn sàng.

## 8. Điểm Danh

Điểm danh dùng để xác nhận giáo viên đã thực hiện tiết dạy.

Tính năng chính:

- Điểm danh theo từng lịch.
- Chặn điểm danh trùng.
- Chặn điểm danh lịch đã hủy.
- Cập nhật trạng thái lịch sang đã điểm danh.
- Admin xem được các lịch chưa điểm danh, điểm danh trễ hoặc quá ngày.
- Trạng thái đang xử lý/đang điểm danh hiển thị trong vùng nhìn thấy của màn hình thay vì bị cố định ở đầu trang.

Rule thời gian:

- Cho điểm danh sớm tối đa 30 phút trước giờ bắt đầu.
- Theo dõi tình trạng điểm danh muộn để Admin giám sát.

## 9. Thông Báo, Banner Và Feedback

Thông báo:

- Có panel thông báo theo vai trò: admin, teacher hoặc all.
- Icon thông báo trên mobile đặt ở góc trên bên phải.
- Có badge số lượng thông báo chưa đọc.

Banner đầu trang:

- Admin có thể tạo thông báo chạy ở đầu app.
- Dòng thông báo hiển thị một dòng dài và chạy ngang để người dùng đọc đầy đủ nội dung.
- Có bật/tắt/xóa banner.

Feedback:

- Giáo viên có thể gửi góp ý nâng cấp tính năng.
- Popup feedback mở ở giữa màn hình.
- Nội dung dài cuộn bên trong popup, không làm popup nhảy khỏi màn hình.
- Feedback được gửi về Admin để theo dõi.

## 10. Cấu Hình Hệ Thống Dành Cho Admin

Admin quản lý các danh mục nền tảng:

- Trường.
- Lớp.
- Khung giờ.
- Bài học.
- Giáo viên.
- Người dùng.
- App announcements.

Import dữ liệu:

- Hỗ trợ import nhanh bằng file `.xlsx`, `.csv`, `.tsv` ở các phân hệ phù hợp.
- Có script setup Google Sheets để tạo cấu trúc sheet ban đầu.

## 11. Observability Và Health Check

Admin có panel Observability vận hành trong tab Cấu hình.

Thông tin chính:

- Tổng số sự kiện.
- Số lần bị chặn quyền trong 1 giờ.
- Số lỗi API trong 1 giờ.
- Health tổng.
- Top route có sự kiện.
- Cảnh báo vận hành theo ngưỡng.

Health check nội bộ:

- API: `GET /api/admin/health`.
- Kiểm tra Google Sheets.
- Kiểm tra GAS webhook.
- Kiểm tra email provider.

Trạng thái health:

- `ok`: hệ thống ổn.
- `degraded`: có thành phần chậm hoặc lỗi một phần.
- `down`: thành phần quan trọng không hoạt động.

## 12. Chuẩn Lỗi Và Truy Vết

Format lỗi API chuẩn:

```json
{ "error": "Mô tả lỗi", "code": "ERROR_CODE", "requestId": "request-id" }
```

Cách support khi có lỗi:

1. Lấy `requestId` từ lỗi người dùng gặp.
2. Tra audit/event log.
3. Xác định route, code, reason và actor.
4. Khoanh vùng lỗi nghiệp vụ, quyền hoặc tích hợp ngoài.

Audit log ghi nhận:

- Người thao tác.
- Route/API.
- Hành động.
- Quyết định quyền.
- Dữ liệu trước/sau nếu có.
- Request ID.

## 13. Nhận Diện Thương Hiệu Và Link Preview

App hiện dùng nhận diện:

- Tên: METTASOUL - Education with love.
- Màu chính lấy từ logo: vàng năng lượng, teal, xanh đậm.
- Logo METTASOUL hiển thị trong app.
- Ảnh bìa chia sẻ link: `public/mettasoul-cover.png`.
- Metadata Open Graph/Twitter card đã cấu hình trong `app/layout.tsx`.

Khi gửi link app:

- Nền tảng hỗ trợ Open Graph sẽ lấy title, mô tả và ảnh bìa.
- Một số nền tảng như Zalo/Facebook có cache preview, cần đợi vài phút hoặc gửi lại link sau khi deploy.

## 14. Cách Test Trên Giao Diện

Test vai trò giáo viên:

1. Đăng nhập bằng tài khoản giáo viên.
2. Xác nhận app tự vào Lịch của tôi/Lịch dạy.
3. Kiểm tra lịch tự nhảy đến ngày hiện tại.
4. Bấm CÁC NGÀY CÓ LỊCH DẠY để nhảy nhanh.
5. Bấm một lịch cụ thể và kiểm tra modal chi tiết hiện giữa màn hình.
6. Thử nộp giáo án nếu lịch cần giáo án.
7. Thử điểm danh trong khung giờ hợp lệ.
8. Mở Góp ý và kiểm tra popup hiện giữa màn hình.
9. Kiểm tra giáo viên không thấy bộ lọc giáo viên và không thấy lịch người khác.

Test vai trò Admin:

1. Đăng nhập bằng tài khoản Admin.
2. Mở Lịch tổng.
3. Bấm một lịch cụ thể và kiểm tra modal chi tiết hiện giữa màn hình.
4. Mở Giao lịch.
5. Tạo case trùng giáo viên hoặc trùng lớp cùng ngày/khung giờ để kiểm tra cảnh báo.
6. Sửa hết trùng và gửi lịch.
7. Kiểm tra thông báo được tạo.
8. Mở Giáo án để kiểm tra danh sách lịch cần nộp.
9. Mở Điểm danh để kiểm tra trạng thái đã/chưa điểm danh.
10. Mở Cấu hình để kiểm tra Observability và Health.

Test chia sẻ link:

1. Đợi Vercel deploy xong.
2. Gửi link `https://life-skill.vercel.app` qua Zalo/Facebook/Chat.
3. Kiểm tra preview có title, mô tả và ảnh bìa METTASOUL.
4. Nếu preview cũ vẫn còn, đợi cache hoặc gửi lại sau vài phút.

## 15. Kiểm Tra Kỹ Thuật Sau Mỗi Lần Cập Nhật

Chạy các lệnh sau trước khi kết luận bản cập nhật ổn định:

```bash
npm run test:authz
npm run build
```

Kỳ vọng:

- `test:authz` pass.
- `build` pass.
- Không commit file sinh ra bởi build như `tsconfig.tsbuildinfo` nếu chỉ thay đổi do quá trình build.

## 16. Ghi Chú Vận Hành

- Hệ thống hiện chưa có phân hệ chat nội bộ.
- Google Sheets vẫn là nơi lưu dữ liệu chính.
- Google Apps Script dùng cho luồng email/upload khi đã cấu hình webhook.
- An toàn dữ liệu và phân quyền đang được ưu tiên hơn tối ưu tốc độ cực đoan.
- Nếu cần tối ưu hiệu năng tiếp, ưu tiên cache ngắn hạn, batch write và index row trước khi chuyển sang kiến trúc phức tạp hơn.