# Life Skill Scheduler - Tổng Kết Tiến Trình

## 1. Mục Tiêu Hệ Thống

Life Skill Scheduler là web app dùng để giáo vụ/admin quản lý lịch dạy cho giáo viên. Hệ thống hỗ trợ:

- Quản lý giáo viên.
- Quản lý bài học theo khối và mục tiêu giảng dạy.
- Quản lý trường, lớp và khung giờ dạy.
- Giao lịch dạy cho một hoặc nhiều giáo viên.
- Giáo viên xác nhận lịch.
- Giáo viên tải giáo án.
- Giáo viên điểm danh từng tiết.
- Admin theo dõi trạng thái lịch, giáo án, điểm danh và trao đổi qua chat.
- Dữ liệu chính lưu trên Google Sheets.

## 2. Công Nghệ Đang Dùng

- Next.js 16.2.6 App Router.
- React 19.2.0.
- Tailwind CSS 4.
- Lucide React cho icon.
- Google Sheets API qua `googleapis`.
- Google service account để đọc/ghi dữ liệu.
- Font giao diện: Be Vietnam Pro.
- Màu thương hiệu:
  - Chính: `#1992b0`
  - Đậm: `#0b6f89`
  - Nhấn: `#ff9500`

## 3. Giao Diện Đã Hoàn Thành

Các màn hình/chức năng UI hiện có:

- Dashboard tổng quan.
- Giao lịch dạy.
- Lịch tổng quan.
- Danh sách giáo viên.
- Thêm giáo viên.
- Thư viện bài học.
- Thêm bài học.
- Quản lý khung giờ.
- Trung tâm giáo án.
- Điểm danh từng tiết.
- Chat theo giáo viên và theo tiết.
- Cấu hình Google Workspace.

Giao diện đã được chỉnh:

- Dùng font Be Vietnam Pro.
- Chuyển phần lớn chữ chính sang màu thương hiệu.
- Sửa tiếng Việt có dấu và chính tả.
- Có trạng thái kết nối dữ liệu:
  - `Đang tải dữ liệu`
  - `Đã nối Google Sheet`
  - `Dùng dữ liệu tạm`
- Có cảnh báo khi ghi Google Sheet thất bại.

## 4. Google Sheets Database

Google Sheet hiện tại:

```text
https://docs.google.com/spreadsheets/d/1wTbm61GHwmvza94UmNeptTAmhSlLEPHQaoCLC7uMni0/edit
```

Spreadsheet ID:

```text
1wTbm61GHwmvza94UmNeptTAmhSlLEPHQaoCLC7uMni0
```

Các tab đã tạo:

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

Các cột đã được tạo tự động bằng Google Apps Script và cũng có script Node để cập nhật lại header nếu cần.

Script Node hiện có:

```text
scripts/setup-google-sheets.mjs
```

Lệnh chạy:

```powershell
npm run setup:sheets
```

Script này có thể:

- Dùng spreadsheet có sẵn nếu có `GOOGLE_SHEETS_SPREADSHEET_ID`.
- Tạo spreadsheet mới nếu chưa có ID.
- Tạo đủ tab nếu thiếu.
- Ghi header.
- Freeze dòng header.
- Tô màu header theo màu thương hiệu.
- Auto resize cột.

## 5. Service Account Và Env

Service account đã dùng:

```text
life-skill-bot@life-skill-scheduler.iam.gserviceaccount.com
```

File `.env.local` đang dùng local, không được commit lên GitHub:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SHEETS_TITLE="Life Skill Database"
GOOGLE_DRIVE_LESSON_PLANS_FOLDER_ID=
RESEND_API_KEY=
EMAIL_FROM="Life Skill <lichday@example.com>"
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Các file nhạy cảm đã được ignore:

- `.env.local`
- `life-skill-scheduler-*.json`
- `node_modules`
- `.next`

Lưu ý bảo mật:

- Private key service account đã từng được paste trong chat, nên nên rotate key trong Google Cloud Console.
- Sau khi rotate, cập nhật lại `.env.local` và Vercel Environment Variables.

## 6. API Đã Tạo

Các API routes hiện có:

- `GET /api/app-data`
- `GET /api/teachers`
- `POST /api/teachers`
- `GET /api/lessons`
- `POST /api/lessons`
- `GET /api/time-slots`
- `POST /api/time-slots`
- `GET /api/schedules`
- `POST /api/schedules`
- `PATCH /api/schedules/[id]`
- `POST /api/lesson-plans`
- `POST /api/attendance`

Các API này dùng module:

```text
lib/google-sheets.ts
```

Module này chịu trách nhiệm:

- Khởi tạo Google Sheets client bằng service account.
- Normalize private key để tránh lỗi format.
- Đọc rows từ từng tab.
- Ghi row mới.
- Cập nhật row theo `id`.
- Map dữ liệu Sheet thành type trong app.

## 7. Dữ Liệu Đã Nối Thật

Các phần hiện đã ghi/đọc Google Sheet:

- Thêm giáo viên vào tab `Teachers`.
- Thêm bài học vào tab `Lessons`.
- Thêm khung giờ vào tab `TimeSlots`.
- Giao lịch vào tab `Schedules`.
- Xác nhận lịch qua `Schedules`.
- Hủy lịch qua `Schedules`.
- Chuyển lịch qua `Schedules`.
- Điểm danh vào tab `Attendance`.
- Ghi giáo án demo vào tab `LessonPlans`.

App vẫn có fallback dữ liệu mẫu nếu sheet chưa có dữ liệu ở một số tab.

## 8. Các Lỗi Đã Xử Lý

### Npm install không tạo `node_modules`

Nguyên nhân:

- PowerShell chặn `npm.ps1`.
- Cache npm mặc định trong AppData bị `EPERM`.
- Npm gặp lỗi certificate `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.

Cách xử lý:

```powershell
$env:NODE_OPTIONS='--use-system-ca'
npm.cmd install --cache C:\tmp\npm-cache --no-audit --no-fund
```

### Vercel chặn deploy vì Next.js vulnerable

Nguyên nhân:

```text
Vulnerable version of Next.js detected
```

Cách xử lý:

- Cập nhật Next.js từ `16.0.3` lên `16.2.6`.
- Build local pass.

### Input bị mất focus sau mỗi ký tự

Nguyên nhân:

- Các panel được định nghĩa bên trong `LifeSkillApp` và render dạng JSX component.
- Mỗi lần nhập state đổi, React remount form.

Cách xử lý:

- Đổi render từ:

```tsx
return <TeachersPanel />;
```

sang:

```tsx
return TeachersPanel();
```

### Dữ liệu hiện trên UI nhưng không vào Google Sheet

Nguyên nhân:

- Code cũ catch lỗi API rồi vẫn thêm dữ liệu vào state local.

Cách xử lý:

- Nếu ghi Google Sheet lỗi thì không cập nhật UI như đã lưu.
- Hiển thị cảnh báo lỗi rõ ràng.

### Lỗi private key

Lỗi:

```text
error:1E08010C:DECODER routines::unsupported
```

Nguyên nhân:

- Private key trong env sai format hoặc có quote/ký tự escape không đúng.

Cách xử lý:

- Thêm normalize private key trong `lib/google-sheets.ts`.
- Hỗ trợ cả dạng nhiều dòng thật và dạng `\n`.

## 9. Vercel Deployment

Khi deploy Vercel, cần thêm Environment Variables:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
GOOGLE_SHEETS_SPREADSHEET_ID
```

Sau khi thêm hoặc sửa env trên Vercel:

- Phải redeploy.
- Deployment cũ không tự nhận env mới.

Private key trên Vercel nên dán không kèm dấu nháy kép bao ngoài.

## 10. Kiểm Tra Đã Thực Hiện

Đã build thành công nhiều lần:

```powershell
npm run build
```

Kết quả:

```text
Compiled successfully
Finished TypeScript
Generated static pages
```

Đã kiểm tra API local:

```text
GET /api/app-data
STATUS=200
```

Đã xác nhận Google Sheet nhận dữ liệu.

## 11. Các File Quan Trọng

```text
app/layout.tsx
app/globals.css
components/life-skill-app.tsx
lib/types.ts
lib/status.ts
lib/sample-data.ts
lib/google-sheets.ts
lib/api.ts
scripts/setup-google-sheets.mjs
app/api/app-data/route.ts
app/api/teachers/route.ts
app/api/lessons/route.ts
app/api/time-slots/route.ts
app/api/schedules/route.ts
app/api/schedules/[id]/route.ts
app/api/lesson-plans/route.ts
app/api/attendance/route.ts
```

## 12. Bước Tiếp Theo Đề Xuất

Các bước nên làm tiếp:

1. Thêm Google Login thật.
2. Đọc role từ tab `Users`.
3. Chỉ cho giáo viên xem lịch của chính mình.
4. Upload giáo án thật lên Google Drive.
5. Gửi email lịch dạy bằng Resend hoặc Gmail API.
6. Gửi email có CTA xác nhận lịch.
7. Nối chat thật vào Google Sheet.
8. Thêm màn quản lý trường/lớp.
9. Thêm import/export dữ liệu mẫu.
10. Thêm validation dữ liệu trước khi ghi Sheet.
11. Thêm loading state cho từng nút lưu.
12. Thêm audit log vào tab `AuditLogs`.

