# WORK SUMMARY - HỌC VIỆN METTASOUL Scheduler

Ngày cập nhật: 28/05/2026  
Nhánh hiện tại: `main`  
HEAD commit hiện tại: `a8f4e71`

## 1. Mục tiêu & trạng thái tổng quan

Hệ thống phục vụ điều hành lịch dạy kỹ năng sống cho Admin/Giáo vụ và Giáo viên trên nền Next.js + Google Sheets + GAS.

Trạng thái hiện tại:

- Đã hoàn tất lớp an toàn backend theo `shadow -> enforce`.
- Đã chuẩn hóa lỗi API với `code` và `requestId`.
- Đã có health check nội bộ Admin.
- Đã có observability panel cho Admin.
- Đã chặn trùng lịch ở backend và có cảnh báo preview trên UI trước khi gửi.

## 2. Các hạng mục đã hoàn tất

### 2.1. P0 Security Foundation

- `lib/route-auth.ts`: session auth, role evaluation, shadow/enforce.
- Mặc định hiện tại: `enforce` (rollback nhanh bằng `AUTH_ENFORCEMENT_MODE=shadow`).
- Khóa quyền route ghi dữ liệu theo vai trò (admin-only và teacher-own).
- `GET /api/app-data` yêu cầu session hợp lệ.

### 2.2. Chuẩn lỗi API

- Format lỗi chuẩn: `{ error, code, requestId }`.
- Thêm `lib/app-error.ts`, `lib/error-codes.ts`, cập nhật `lib/api.ts`.

### 2.3. Audit & Correlation

- Mở rộng metadata audit: `requestId`, `route`, `method`, `authMode`, `decision`, `reason`, `source`, `before/after/changedFields`.
- Ghi event lỗi API vào `AuditLogs` qua action `api.error`.

### 2.4. Admin Health & Observability

- API mới:
  - `GET /api/admin/health`
  - `GET /api/admin/observability`
- UI Admin có panel observability trong tab Cấu hình:
  - tổng sự kiện, deny 1h, api error 1h, top route/code/reason, cảnh báo ngưỡng.

### 2.5. Chống trùng lịch khi giao hàng loạt

- Backend `/api/schedules` chặn:
  - trùng `teacher + date + timeSlot`,
  - trùng `class + date + timeSlot`,
  - kiểm tra cả với lịch đã có và trùng ngay trong batch gửi.
- Trả `409 CONFLICT` khi phát hiện xung đột.
- UI preview hiển thị cảnh báo đỏ và khóa nút gửi khi còn xung đột.

### 2.6. Regression test

- Script `npm run test:authz` để chống hồi quy phân quyền.

## 3. Kết quả kiểm thử gần nhất

- `npm run test:authz`: pass.
- `npm run build`: pass.

## 4. Commit timeline gần nhất

- `a8f4e71` - docs: refresh work summary and usage guide for latest rollout.
- `2996ae1` - feat: add schedule conflict guard and assignment preview warnings.
- `1cbd06c` - feat: add admin observability dashboard and API event logging.
- `b28d819` - test: add authz regression checks and default enforce mode.
- `71d9a86` - feat: implement P0 security foundation and admin health checks.

## 5. Kế hoạch phiên sau - Tối ưu tốc độ ghi Google Sheets

Mục tiêu:

- Tăng tốc API ghi khi dữ liệu tăng lớn.
- Giảm full-scan sheet và giảm độ trễ khi ghi nhiều dòng.

### Phase A - Quick wins (ưu tiên cao, rủi ro thấp)

1. Batch write triệt để:
- Chuẩn hóa ghi theo lô cho schedules/audit/notifications thay vì nhiều append nhỏ.

2. Buffer + flush:
- Gom log/audit vào bộ đệm, flush mỗi 1-3 giây hoặc mỗi 100-500 dòng.

3. Giảm full-read:
- Rà các route đang đọc toàn bộ sheet trước khi ghi, thay bằng lookup nhỏ hơn khi có thể.

4. Cache danh mục tĩnh-ngắn hạn:
- Cache 30-120 giây cho `Teachers`, `Schools`, `Classes`, `Lessons`, `TimeSlots`.

### Phase B - Tối ưu cấu trúc sheet (ưu tiên trung bình)

1. Index row:
- Tạo map `id -> rowNumber` cho bảng lớn để update/delete nhanh, tránh scan full sheet.

2. Partition theo thời gian:
- Tách `Schedules`, `AuditLogs`, `Notifications` theo tháng/quý.

3. Archive dữ liệu cũ:
- Job tự động chuyển dữ liệu cũ sang sheet lưu trữ để giữ sheet vận hành nhẹ.

### Phase C - Chuẩn bị tải lớn dài hạn

1. Write queue:
- API nhận nhanh, worker ghi Sheets bất đồng bộ.

2. DB trung tâm + Sheets báo cáo:
- Ghi nghiệp vụ chính vào Postgres, đồng bộ sang Sheets cho báo cáo/vận hành.

### KPI cần đạt sau tối ưu

- P95 latency API ghi giảm tối thiểu 40%.
- Tỷ lệ timeout/5xx khi ghi dưới 1%.
- Tốc độ tạo lịch hàng loạt không tăng tuyến tính theo số dòng.

### Thứ tự triển khai đề xuất cho phiên sau

1. Phase A.1 + A.2 + A.4
2. Phase B.1
3. Đo benchmark trước/sau
4. Quyết định tiếp B.2/B.3 hoặc lên C

## 6. Quy tắc vận hành đã chốt

- Mỗi hạng mục hoàn tất phải:
  - kiểm tra hoạt động,
  - commit,
  - push ngay trong cùng phiên.
- Tài liệu phải bám đúng trạng thái code thực tế.

