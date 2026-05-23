# Tổng Kết Kết Quả Làm Việc - Life Skill Scheduler

Ngày cập nhật: 2026-05-22

## 1. Tổng quan

Life Skill Scheduler là web app Next.js dành cho giáo vụ/admin quản lý lịch dạy kỹ năng sống, giao lịch cho giáo viên, theo dõi giáo án, điểm danh và thông báo email.

Trạng thái hiện tại:

- App đã có đầy đủ UI và các luồng nghiệp vụ cốt lõi.
- Dữ liệu chính đọc/ghi qua Google Sheets.
- Đăng nhập Google OAuth đang hoạt động.
- Email thông báo lịch dạy đang gửi qua Google Apps Script (GAS).
- Phân hệ giáo án đã hoàn thiện theo mục tiêu hiện tại (upload, xem, sửa tên, xóa bản ghi, hỗ trợ nhiều file).

## 2. Tính năng đã có

### Quản lý người dùng và phân quyền

- Đăng nhập bằng Google OAuth.
- Đọc user từ tab `Users` trong Google Sheet.
- Hỗ trợ role `admin` và `teacher`.
- Admin xem được toàn bộ hệ thống.
- Giáo viên chỉ thấy các tab phù hợp và lịch của mình.

### Quản lý giáo viên

- Thêm/sửa thông tin giáo viên.
- Lưu giáo viên vào tab `Teachers`.
- Tạo/liên kết tài khoản user trong tab `Users`.
- Phân quyền giáo viên/admin.

### Quản lý bài học

- Thêm bài học theo khối.
- Lưu tên chuyên đề, mục tiêu, thời lượng, link giáo án mẫu.
- Hỗ trợ thêm nhiều bài học bằng copy/paste hoặc file Excel/CSV.
- Lọc/tìm kiếm bài học theo khối và từ khóa.

### Quản lý khung giờ

- Thêm khung giờ dạy.
- Lưu vào tab `TimeSlots`.
- Dùng khung giờ khi giao lịch.

### Giao lịch dạy

- Admin chọn ngày, trường, lớp, bài học, khung giờ.
- Gán lịch cho 1 hoặc nhiều giáo viên.
- Lưu vào tab `Schedules`.
- Tạo thread chat theo lịch.
- Gửi email CTA xác nhận lịch qua GAS.

### Xác nhận, hủy, chuyển lịch

- Giáo viên xác nhận lịch trên app.
- Admin hủy/chuyển lịch.
- Trạng thái lịch cập nhật trong `Schedules`.

### Phân hệ giáo án (đã hoàn thiện đợt này)

- Upload giáo án qua GAS Web App.
- Hỗ trợ file: `pdf`, `doc`, `docx`, `ppt`, `pptx`, `xls`, `xlsx`, `txt`, `csv`.
- Hỗ trợ chọn và upload nhiều file trong 1 lần thao tác.
- Giới hạn kích thước mỗi file: 10MB.
- Mỗi lịch có thể lưu nhiều giáo án và hiển thị danh sách link trên UI.
- Đã thêm API upload có timeout + retry + `requestId` + map `errorCode`.
- Đã thêm API sửa/xóa giáo án:
  - `PATCH /api/lesson-plans/[id]` (đổi tên file hiển thị)
  - `DELETE /api/lesson-plans/[id]` (xóa bản ghi giáo án trên hệ thống)
- Đã thêm kiểm tra quyền backend:
  - Teacher chỉ upload/sửa/xóa giáo án của chính teacher đó.
  - Admin có toàn quyền.

### Điểm danh

- Giáo viên/admin điểm danh theo tiết.
- Lưu vào tab `Attendance`.
- Lịch cập nhật trạng thái `attended`.

### Chat và thông báo

- Có UI chat theo giáo viên và theo tiết dạy.
- Có notification trong app.

## 3. Tích hợp đã cấu hình

### Google Sheets

- Service account đọc/ghi Google Sheet.
- Env cần có:
  - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
  - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
  - `GOOGLE_SHEETS_SPREADSHEET_ID`

Spreadsheet đang sử dụng:

```text
1wTbm61GHwmvza94UmNeptTAmhSlLEPHQaoCLC7uMni0
```

### Google Drive

Folder giáo án:

```text
1Tn0cqAsXjbrLlV8G2MTewMd8TL6P44tD
```

### Google Apps Script

Script mẫu trong repo:

```text
scripts/gas-life-skill-webhook.js
```

Script xử lý:

- Gửi email lịch dạy.
- Nhận upload file base64.
- Tạo file vào Drive folder.
- Ghi metadata vào `LessonPlans`.
- Cập nhật `Schedules.status = lesson_plan_uploaded`.
- Trả về `requestId`, `errorCode`, `message` để debug.

### Email

- `EMAIL_PROVIDER=gas`.
- Gửi qua `MailApp.sendEmail`.
- Sender mong muốn: `Life Skill <infoasst@mettasoul.vn>`.

## 4. Các thay đổi kỹ thuật mới nhất (2026-05-22)

- Nâng cấp `app/api/lesson-plans/upload/route.ts`:
  - Validate payload.
  - Timeout + retry.
  - Map lỗi theo `errorCode`.
  - Gắn `requestId` xuyên suốt.
  - Kiểm tra session và quyền upload theo teacher/schedule.
- Nâng cấp `components/life-skill-app.tsx`:
  - Upload nhiều file.
  - Hiển thị nhiều giáo án trên 1 lịch.
  - Thêm nút sửa/xóa giáo án trong phân hệ giáo viên.
- Thêm route mới `app/api/lesson-plans/[id]/route.ts` cho PATCH/DELETE.
- Nâng cấp `lib/google-sheets.ts`:
  - Thêm `readSheetRowById`.
  - Thêm `deleteSheetRowById`.

## 5. Các env cần có trên Vercel

Bắt buộc:

```env
NEXT_PUBLIC_APP_URL=https://domain-vercel-cua-ban
AUTH_SECRET=...

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=...
GOOGLE_SHEETS_SPREADSHEET_ID=1wTbm61GHwmvza94UmNeptTAmhSlLEPHQaoCLC7uMni0

EMAIL_PROVIDER=gas
GAS_MAIL_WEBHOOK_URL=https://script.google.com/macros/s/AKfycbzaysbasAVWP4anrNYMLDFI7w71tJIxUMJr_dgJ32uxhn592KhDNinWDqYgm3OFE9t-/exec
GAS_MAIL_WEBHOOK_SECRET=...
EMAIL_FROM=Life Skill <infoasst@mettasoul.vn>

GAS_UPLOAD_WEBHOOK_URL=https://script.google.com/macros/s/AKfycbzaysbasAVWP4anrNYMLDFI7w71tJIxUMJr_dgJ32uxhn592KhDNinWDqYgm3OFE9t-/exec
GAS_UPLOAD_WEBHOOK_SECRET=...
```

Sau khi sửa env trên Vercel cần redeploy.

## 6. Trạng thái hiện tại của phân hệ giáo án

Đã đạt:

- Upload đã chạy qua GAS.
- Teacher có thể upload nhiều file (doc/ppt/pdf...) trong 1 lần.
- Có thể sửa tên và xóa giáo án trên UI.
- Backend đã có check quyền.

Cần quyết định tiếp (nếu muốn đẩy đến mức production chặt chẽ hơn):

- Khi xóa giáo án, hiện đang xóa bản ghi trên hệ thống; nếu cần xóa cả file vật lý trên Google Drive thì bổ sung action xóa file trong GAS.

## 7. Việc cần làm tiếp (ngoài phân hệ giáo án)

Ưu tiên tiếp theo:

- Nối chat/notifications thật vào Google Sheet 100%.
- Bổ sung backend authorization rộng hơn cho các API còn lại (không chỉ lesson plans).
- Hoàn thiện màn quản lý trường/lớp nếu cần đầy đủ CRUD.
- Bổ sung audit log cho các thao tác quan trọng.
