# WORK SUMMARY - HỌC VIỆN METTASOUL Scheduler

Ngày cập nhật: 28/05/2026  
Nhánh hiện tại: `main`  
HEAD commit hiện tại: `2996ae1`

## 1. Mục tiêu & trạng thái tổng quan

HỌC VIỆN METTASOUL Scheduler là ứng dụng Next.js (App Router) phục vụ điều hành lịch dạy kỹ năng sống cho Admin/Giáo vụ và Giáo viên.

Nguồn dữ liệu chính:

- Google Sheets: lưu dữ liệu nghiệp vụ.
- Google Apps Script (GAS): gửi email lịch dạy, upload/xóa giáo án.

Trạng thái hiện tại:

- Chức năng cốt lõi đã hoàn thiện cho vận hành thực tế.
- Đã harden bảo mật backend theo chiến lược `shadow -> enforce`.
- Đã có lớp observability admin để theo dõi lỗi/quyền/health.
- Đã chặn trùng lịch ở backend và có cảnh báo trực quan ở giao diện trước khi gửi.

## 2. Các cập nhật đã hoàn tất (mới nhất)

### 2.1. Nền tảng an toàn P0 (đã hoàn tất)

- Chuẩn hóa phân quyền backend dùng chung:
  - `lib/route-auth.ts`
  - `requireSessionUser`, `evaluatePermission`, `requireRole`, `assertTeacherOwnsResource`.
- Enforcement mode theo env:
  - `AUTH_ENFORCEMENT_MODE=shadow|enforce`.
  - Mặc định hiện tại: `enforce` (rollback nhanh bằng `shadow`).
- Khóa quyền cho nhóm route ghi dữ liệu:
  - Admin-only: announcements, schools, classes, lessons, teachers, users, time-slots, đa số thao tác schedules.
  - Teacher-own/Admin: attendance, lesson-plans.
  - notifications POST: teacher chỉ gửi feedback mẫu, admin toàn quyền.
- Bảo vệ dữ liệu tổng:
  - `GET /api/app-data` bắt buộc session hợp lệ.
  - Frontend chỉ gọi app-data sau khi xác thực session, không còn “offline giả” khi signed-out.

### 2.2. Chuẩn hóa lỗi API (đã hoàn tất)

- Chuẩn response lỗi thống nhất:
  - `{ error, code, requestId }`.
- Bổ sung:
  - `lib/app-error.ts`
  - `lib/error-codes.ts`
  - cập nhật `lib/api.ts`.
- Đảm bảo message tiếng Việt có dấu trong các route đã chuẩn hóa.

### 2.3. Audit log chi tiết & correlation (đã hoàn tất)

- Tăng metadata trong `AuditLogs` không cần migration schema:
  - `requestId`, `route`, `method`, `authMode`, `decision`, `reason`, `source`.
  - `before`, `after`, `changedFields` cho thao tác nhạy cảm.
- Dùng chung helper:
  - `lib/audit.ts`.

### 2.4. Health check nội bộ admin (đã hoàn tất)

- Endpoint mới:
  - `GET /api/admin/health` (admin-only).
- Kiểm tra:
  - `sheets`, `gas_mail`, `email_provider`.
- Trả trạng thái tổng:
  - `ok | degraded | down`.

### 2.5. Observability admin (đã hoàn tất)

- Endpoint mới:
  - `GET /api/admin/observability`.
- Nội dung:
  - tổng sự kiện, `deny` 1h, `api error` 1h,
  - top route/reason/code/action,
  - health tổng hợp,
  - cảnh báo vượt ngưỡng.
- UI admin mới trong tab Cấu hình:
  - panel “Observability vận hành” có nút làm mới + cảnh báo trực quan.
- Ngưỡng cảnh báo:
  - `OBS_ALERT_DENY_1H` (default 20),
  - `OBS_ALERT_ERROR_1H` (default 10).
- Đã ghi event lỗi API vào `AuditLogs` qua `action=api.error`.

### 2.6. Chặn trùng lịch & preview trước khi gửi (đã hoàn tất)

- Backend chặn xung đột khi tạo lịch (`/api/schedules`):
  - trùng `teacher + date + timeSlot`,
  - trùng `class + date + timeSlot`,
  - kiểm tra với dữ liệu đã có và trùng trong chính batch sắp gửi.
- Trả `409 CONFLICT` kèm thông điệp mẫu để admin xử lý.
- Frontend “Giao lịch”:
  - cảnh báo đỏ liệt kê xung đột trong khối “Xem trước lịch sắp gửi”,
  - nút gửi bị khóa khi còn xung đột,
  - trạng thái xanh khi an toàn để gửi.

### 2.7. Regression test tự động (đã hoàn tất)

- Script mới:
  - `npm run test:authz`.
- Mục tiêu:
  - kiểm tra các route quan trọng vẫn giữ authz pattern đúng,
  - giữ token-flow cho confirm email route,
  - tránh hồi quy bảo mật khi cập nhật code.

## 3. Danh sách API/Interface thay đổi chính

- Mới:
  - `GET /api/admin/health`
  - `GET /api/admin/observability`
- Thay đổi chuẩn lỗi toàn API:
  - `{ error, code, requestId }`
- Thay đổi truy cập dữ liệu:
  - `GET /api/app-data` yêu cầu session hợp lệ.
- Chính sách bảo mật:
  - fallback header `x-app-user-*` chỉ còn hữu dụng trong `shadow` theo auth mode.

## 4. Kết quả kiểm thử kỹ thuật gần nhất

- `npm run test:authz`: pass.
- `npm run build`: pass.
- Đã verify route build output gồm:
  - `/api/admin/health`
  - `/api/admin/observability`.

## 5. Commit timeline gần nhất (main)

- `2996ae1` - Add schedule conflict guard and assignment preview warnings.
- `1cbd06c` - Add admin observability dashboard and API event logging.
- `b28d819` - Add authz regression checks and default enforce mode.
- `71d9a86` - Implement P0 security foundation and admin health checks.

## 6. Quy tắc vận hành đã chốt

- Mỗi hạng mục hoàn tất phải:
  - kiểm tra hoạt động,
  - commit,
  - push ngay trong cùng phiên.
- Tài liệu luôn phải phản ánh đúng trạng thái code thực tế.

