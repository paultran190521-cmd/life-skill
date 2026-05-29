# WORK SUMMARY - METTASOUL

Ngày cập nhật: 29/05/2026
Nhánh hiện tại: `main`
Ứng dụng: `METTASOUL - Education with love`
Trạng thái: đã triển khai và push GitHub các hạng mục chính đến phần nhận diện thương hiệu, ảnh bìa chia sẻ link và tối ưu mobile/modal.

## 1. Mục Tiêu Dự Án

Dự án xây dựng hệ thống vận hành lịch dạy kỹ năng sống cho METTASOUL, phục vụ hai nhóm người dùng chính:

- Admin/Giáo vụ: điều phối lịch, quản lý giáo viên, giáo án, điểm danh, cấu hình dữ liệu và theo dõi vận hành.
- Giáo viên: xem lịch của mình, xác nhận lịch, nộp giáo án, điểm danh và gửi góp ý.

Nền tảng kỹ thuật hiện tại:

- Next.js App Router.
- React/TypeScript.
- Google Sheets làm kho dữ liệu chính.
- Google Apps Script cho một số luồng email/upload.
- Vercel để deploy.

## 2. Trạng Thái Tổng Quan Hiện Tại

Các phần đã ổn định:

- Đăng nhập Google và session backend.
- Phân quyền backend mặc định `enforce`.
- Giáo viên chỉ nhìn thấy dữ liệu của chính mình.
- Admin quản lý toàn hệ thống.
- Giao lịch có chống trùng ở cả UI và backend.
- Lịch tổng và Lịch của tôi đã có modal chi tiết ổn định trên desktop/mobile.
- Mobile UI đã được tinh gọn theo nghiệp vụ giáo viên.
- Feedback popup đã mở đúng giữa màn hình.
- Trạng thái xử lý/đang điểm danh hiển thị trong vùng nhìn thấy.
- Giao diện đã dùng màu và logo METTASOUL.
- Link preview đã có title, mô tả và ảnh bìa.
- Tài liệu đang được chuẩn hóa lại bằng tiếng Việt UTF-8.

Kết quả kiểm tra gần nhất trước tài liệu này:

- `npm run test:authz`: pass.
- `npm run build`: pass.

## 3. Các Hạng Mục Đã Hoàn Thành

### 3.1. Security Foundation

Đã hoàn tất lớp an toàn backend:

- `requireSessionUser` kiểm tra session ở API.
- `evaluateRolePermission` kiểm tra quyền theo vai trò.
- `evaluatePermission` kiểm tra các rule quyền theo nghiệp vụ.
- Mặc định dùng `AUTH_ENFORCEMENT_MODE=enforce`.
- Có thể rollback tạm sang `shadow` nếu production gặp sự cố quyền.

Các route quan trọng đã có kiểm tra quyền:

- Announcements.
- Schools.
- Classes.
- Lessons.
- Time slots.
- Teachers.
- Users.
- Schedules.
- Attendance.
- Lesson plans.
- Notifications.
- Admin health.
- Admin observability.

### 3.2. Chuẩn Lỗi API Và Audit

Đã chuẩn hóa lỗi API theo format:

```json
{ "error": "message", "code": "ERROR_CODE", "requestId": "request-id" }
```

Audit/event log đã ghi thêm:

- requestId.
- route.
- method.
- authMode.
- decision.
- reason.
- source.
- before/after/changedFields.

Mục tiêu: khi có lỗi production, có thể truy vết nhanh theo `requestId`.

### 3.3. Admin Health Và Observability

Đã thêm API nội bộ:

- `GET /api/admin/health`.
- `GET /api/admin/observability`.

Admin có panel Observability trong tab Cấu hình:

- Tổng sự kiện.
- Deny trong 1 giờ.
- API error trong 1 giờ.
- Health tổng.
- Top route/code/reason.
- Cảnh báo vận hành.

### 3.4. Giao Lịch Và Chống Trùng

Đã thêm cơ chế chống trùng khi giao lịch hàng loạt:

- Chặn trùng giáo viên + ngày + khung giờ.
- Chặn trùng lớp + ngày + khung giờ.
- Kiểm tra trùng với lịch đã tồn tại.
- Kiểm tra trùng trong chính batch lịch sắp gửi.
- UI preview cảnh báo đỏ khi có xung đột.
- Nút gửi bị khóa khi còn xung đột.
- Backend trả `409 CONFLICT` nếu có xung đột.

### 3.5. Tối Ưu Mobile Cho Giáo Viên

Đã cập nhật giao diện mobile theo hướng đơn giản hơn:

- Sau đăng nhập giáo viên tự vào Lịch của tôi/Lịch dạy.
- Mobile bỏ tìm kiếm để giảm nhiễu.
- Mobile bỏ các bộ lọc không cần thiết cho giáo viên.
- Bộ lọc giáo viên bị tắt với giáo viên.
- Đăng nhập/đăng xuất đưa vào menu ba gạch.
- Icon thông báo đưa lên góc trên bên phải.
- Các card thống kê được thu gọn.
- Menu Giáo án gom 3 card chính trên cùng một dòng.
- Lịch tuần/ngày căn chỉnh lại để không tràn lề phải.

### 3.6. Lịch Của Tôi Và Nhảy Nhanh Theo Ngày

Đã nâng cấp trải nghiệm lịch giáo viên:

- Tự động nhảy đến ngày hiện tại khi vào lịch.
- Có khối CÁC NGÀY CÓ LỊCH DẠY để nhảy nhanh.
- Tiêu đề khối nhảy nhanh căn giữa và dùng màu cam nổi bật.
- Số ngày trong ô lịch được căn giữa.
- Dòng thông báo đầu trang chạy ngang một dòng để đọc đủ nội dung.

### 3.7. Modal/Popup Ổn Định Trên Desktop Và Mobile

Đã xử lý lỗi modal nhảy sai vị trí:

- Feedback modal mở giữa màn hình.
- Modal chi tiết lịch mở giữa màn hình.
- Modal không cuộn theo nền trang.
- Chỉ nội dung bên trong modal được cuộn khi dài.
- Áp dụng cho cả Lịch tổng của Admin và Lịch dạy/Lịch của tôi của giáo viên.
- Sửa logic để bấm lịch vẫn mở được modal chi tiết, không bị khóa nhầm thao tác.

### 3.8. Trạng Thái Đang Xử Lý Trong Vùng Nhìn Thấy

Đã điều chỉnh trạng thái quay/đang xử lý:

- Không cố định cứng ở đầu trang khiến người dùng kéo xuống không thấy.
- Hiển thị trong vùng nhìn thấy của màn hình.
- Áp dụng cho cả desktop và mobile.
- Giúp người dùng biết hệ thống đang xử lý khi điểm danh hoặc thao tác dữ liệu.

### 3.9. Giáo Án

Đã hoàn thiện các chức năng chính:

- Upload giáo án theo từng lịch.
- Hỗ trợ link ngoài.
- Sửa tên giáo án.
- Xóa giáo án.
- Theo dõi giáo án đã gửi/cần nộp/đã có giáo án.
- Phân quyền giáo viên chỉ thao tác giáo án thuộc lịch của mình.

### 3.10. Điểm Danh

Đã hoàn thiện luồng điểm danh:

- Điểm danh theo lịch.
- Chặn điểm danh trùng.
- Chặn điểm danh lịch đã hủy.
- Cập nhật trạng thái lịch sau khi điểm danh.
- Theo dõi lịch quá ngày chưa điểm danh.
- Rule điểm danh sớm tối đa 30 phút trước giờ bắt đầu.

### 3.11. Thông Báo, Banner Và Feedback

Đã có:

- Notification panel theo vai trò.
- Badge số thông báo.
- App announcements/banner đầu trang.
- Banner chạy ngang một dòng.
- Feedback từ giáo viên gửi về Admin.

### 3.12. Nhận Diện Thương Hiệu

Đã cập nhật nhận diện mới:

- Tên app: `METTASOUL - Education with love`.
- Logo METTASOUL được đưa vào app.
- Màu sắc lấy từ logo: vàng năng lượng, teal, xanh đậm.
- Gradient nền và nút chính đã cân bằng giữa màu nóng và màu lạnh.
- Ảnh bìa link preview đã tạo tại `public/mettasoul-cover.png`.
- Metadata Open Graph/Twitter card đã cập nhật trong `app/layout.tsx`.

## 4. Các File Quan Trọng Đã Tác Động

Giao diện và logic chính:

- `components/mettasoul-app.tsx`
- `app/globals.css`
- `app/layout.tsx`

Ảnh/asset:

- `public/mettasoul-logo.png`
- `public/mettasoul-cover.png`

API và bảo mật:

- `lib/route-auth.ts`
- `lib/api.ts`
- `lib/app-error.ts`
- `lib/error-codes.ts`
- `app/api/**/route.ts`

Kiểm thử và setup:

- `scripts/test-authz.mjs`
- `scripts/setup-google-sheets.mjs`
- `scripts/benchmark-schedules.mjs`

Tài liệu:

- `USAGE_GUIDE_DRAFT.md`
- `WORK_SUMMARY.md`

## 5. Commit Timeline Gần Đây

Các mốc chính đã push lên GitHub:

- `1b75ba9` - Add social preview metadata and cover image.
- `6e3c523` - Apply Mettasoul logo palette and brand asset.
- `4923050` - Update app branding title.
- `44d2d65` - Balance orange theme with cool teal accents.
- `27baf4f` - Stabilize schedule detail modal through portal.

Ngoài các commit trên, các phần trước đó đã hoàn tất gồm security foundation, observability, conflict guard, authz regression test, mobile UX và tối ưu lịch giáo viên.

## 6. Quy Tắc Làm Việc Đã Chốt

- Sau khi hoàn tất thay đổi code hoặc tài liệu, phải kiểm tra phù hợp, commit và push lên GitHub trong cùng phiên.
- Không commit file sinh tự động do build nếu không phục vụ thay đổi chức năng, ví dụ `tsconfig.tsbuildinfo`.
- Không rollback thay đổi của người dùng nếu không có yêu cầu rõ ràng.
- Ưu tiên an toàn hệ thống và phân quyền hơn tối ưu tốc độ cực đoan.
- Mọi tài liệu tiếng Việt phải lưu UTF-8 sạch, không lỗi dấu.

## 7. Rủi Ro Còn Lại

Các điểm cần tiếp tục theo dõi:

- Preview link trên Zalo/Facebook có thể bị cache, cần đợi sau deploy hoặc gửi lại link.
- Google Sheets vẫn có giới hạn hiệu năng khi dữ liệu tăng lớn.
- Upload giáo án phụ thuộc cấu hình GAS webhook và quyền Drive.
- Email thông báo phụ thuộc webhook/email provider.
- Trên mobile, cần test thực tế bằng iPhone/Zalo browser/Safari vì viewport của từng trình duyệt có khác biệt.

## 8. Kế Hoạch Kỹ Thuật Tiếp Theo

Ưu tiên thấp-rủi ro thấp trước:

1. Cache ngắn hạn dữ liệu danh mục ít thay đổi như giáo viên, trường, lớp, bài học, khung giờ.
2. Batch write cho audit/notification/schedules khi có thao tác hàng loạt.
3. Index row `id -> rowNumber` để update/delete Google Sheets nhanh hơn.
4. Benchmark trước/sau bằng `scripts/benchmark-schedules.mjs`.
5. Nếu dữ liệu tăng mạnh, cân nhắc tách sheet theo tháng/quý hoặc chuyển nghiệp vụ chính sang database rồi đồng bộ Sheets cho báo cáo.

## 9. Checklist Kiểm Tra Sau Mỗi Sprint

Kỹ thuật:

```bash
npm run test:authz
npm run build
```

Giao diện giáo viên:

- Đăng nhập giáo viên.
- Vào thẳng Lịch của tôi/Lịch dạy.
- Lịch tự nhảy đến ngày hiện tại.
- Bấm ngày có lịch để nhảy nhanh.
- Mở chi tiết lịch.
- Nộp giáo án.
- Điểm danh.
- Gửi feedback.

Giao diện Admin:

- Mở Lịch tổng.
- Mở chi tiết lịch.
- Giao lịch mới.
- Kiểm tra cảnh báo trùng lịch.
- Kiểm tra Giáo án.
- Kiểm tra Điểm danh.
- Kiểm tra Observability/Health.
- Kiểm tra banner/thông báo.

Link preview:

- Gửi link sau khi Vercel deploy xong.
- Kiểm tra title, mô tả và ảnh bìa.

## 10. Kết Luận Trạng Thái

Dự án đã vượt qua giai đoạn nền móng và đang ở trạng thái vận hành được cho nghiệp vụ chính:

- Lịch dạy.
- Giáo án.
- Điểm danh.
- Phân quyền.
- Mobile UX.
- Theo dõi vận hành.
- Nhận diện thương hiệu.

Sprint tiếp theo nên tập trung vào đo hiệu năng Google Sheets, giảm độ trễ khi dữ liệu tăng và tiếp tục test thực tế trên thiết bị di động của giáo viên.