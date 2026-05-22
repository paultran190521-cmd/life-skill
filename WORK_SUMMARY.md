# Tong Ket Ket Qua Lam Viec - Life Skill Scheduler

Ngay cap nhat: 2026-05-21

## 1. Tong quan

Life Skill Scheduler la web app Next.js dung cho giao vu/admin quan ly lich day ky nang song, giao lich cho giao vien, theo doi giao an, diem danh va thong bao qua email.

Trang thai hien tai:

- App da co UI chinh va cac luong nghiep vu cot loi.
- Du lieu chinh doc/ghi qua Google Sheets.
- Google Login da duoc khoi phuc ve scope co ban `openid email profile` de tranh loi Google OAuth verification.
- Email thong bao lich day da chuyen sang Google Apps Script (GAS).
- Upload giao an dang duoc chuyen sang GAS, nhung hien chua hoan tat do GAS chua duoc cap quyen DriveApp.

## 2. Tinh nang da co

### Quan ly nguoi dung va phan quyen

- Dang nhap bang Google OAuth.
- Doc user tu tab `Users` trong Google Sheet.
- Ho tro role `admin` va `teacher`.
- Admin xem duoc toan bo he thong.
- Giao vien chi thay cac tab phu hop voi cong viec cua giao vien.
- Giao vien chi thay lich cua chinh minh tren UI.

### Quan ly giao vien

- Them giao vien moi.
- Luu thong tin giao vien vao tab `Teachers`.
- Tao/lien ket tai khoan user trong tab `Users`.
- Phan quyen giao vien/admin.
- Hien avatar, email, so dien thoai, chuyen mon.
- Co hover card de xem nhanh thong tin lien he.

### Quan ly bai hoc

- Them bai hoc theo khoi.
- Luu ten chuyen de, muc tieu, thoi luong, link giao an mau.
- Ho tro them nhieu bai hoc bang bang copy/paste hoac file Excel/CSV.
- Loc/tim kiem bai hoc theo khoi va tu khoa.

### Quan ly khung gio

- Them khung gio day.
- Luu vao tab `TimeSlots`.
- Dung khung gio khi giao lich de thao tac nhanh.

### Giao lich day

- Admin chon ngay, truong, lop, bai hoc, khung gio.
- Gan lich cho mot hoac nhieu giao vien cung luc.
- Luu moi lich vao tab `Schedules`.
- Tao thread chat theo lich.
- Gui thong bao email CTA xac nhan lich qua GAS.

### Xac nhan, huy, chuyen lich

- Giao vien xac nhan lich tren app.
- Email CTA co endpoint xac nhan lich bang token ky tu `AUTH_SECRET`.
- Admin co the huy lich.
- Admin co the chuyen lich sang giao vien khac.
- Trang thai lich duoc cap nhat trong tab `Schedules`.

### Giao an

- UI co trung tam giao an.
- Hien lich nao da co/chua co giao an.
- Da tung co cac phuong an upload:
  - Upload qua Vercel API: bi loi `413` khi file lon.
  - Upload truc tiep Google Drive: bi `Failed to fetch`/CORS.
  - Upload bang service account: bi loi quota vi service account khong co Drive storage.
- Phuong an hien tai: upload giao an qua GAS Web App.

### Diem danh

- Giao vien/admin co the diem danh theo tung tiet.
- Diem danh luu vao tab `Attendance`.
- Lich cap nhat trang thai `attended`.

### Chat va thong bao

- Co UI chat theo giao vien va theo tiet day.
- Co notification trong app.
- Mot so thong bao van con dang luu o state/client, can noi that vao Google Sheet neu muon production day du.

### Google Sheets database

Dang su dung spreadsheet:

```text
1wTbm61GHwmvza94UmNeptTAmhSlLEPHQaoCLC7uMni0
```

Da co cac tab:

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

## 3. Tich hop da cau hinh

### Google Sheets

- Service account doc/ghi Google Sheet.
- `.env.local` local da co service account email/private key.
- Vercel can co cac env tuong ung:
  - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
  - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
  - `GOOGLE_SHEETS_SPREADSHEET_ID`

### Google Drive

- Folder giao an hien tai:

```text
1Tn0cqAsXjbrLlV8G2MTewMd8TL6P44tD
```

- Khong nen de service account tao file truc tiep trong My Drive vi service account khong co storage quota.
- Huong hien tai la de GAS tao file Drive bang tai khoan deploy GAS.

### Google Apps Script

Da co script mau trong repo:

```text
scripts/gas-life-skill-webhook.js
```

Script nay phu trach:

- Gui email lich day.
- Nhan file giao an base64.
- Tao file trong Drive folder.
- Ghi metadata vao tab `LessonPlans`.
- Cap nhat `Schedules.status = lesson_plan_uploaded`.

Webhook URL dang dung:

```text
https://script.google.com/macros/s/AKfycbzaysbasAVWP4anrNYMLDFI7w71tJIxUMJr_dgJ32uxhn592KhDNinWDqYgm3OFE9t-/exec
```

Khong dua gia tri secret vao tai lieu nay. Secret nam trong bien moi truong:

- `GAS_MAIL_WEBHOOK_SECRET`
- `GAS_UPLOAD_WEBHOOK_SECRET` neu tach rieng upload.

### Email

- Da bo Resend khoi luong chinh.
- Email hien gui qua GAS bang `MailApp.sendEmail`.
- Email sender mong muon: `infoasst@mettasoul.vn`.
- `EMAIL_PROVIDER=gas`.

## 4. Loi hien tai

Upload giao an qua GAS hien bao loi:

```text
Exception: You do not have permission to call DriveApp.getFolderById.
Required permissions:
https://www.googleapis.com/auth/drive.readonly
or
https://www.googleapis.com/auth/drive
```

Danh gia:

- App Next.js da goi duoc GAS.
- GAS da vao duoc code upload.
- Loi nam o quyen Apps Script: deployment/function chua duoc authorize scope Drive.
- Day khong phai loi Google Sheet, khong phai loi Vercel, va khong phai sai webhook URL.

Can xu ly trong Apps Script:

1. Mo Apps Script project.
2. Vao `Project Settings`.
3. Bat hien thi file manifest `appsscript.json`.
4. Them/cap nhat oauth scopes:

```json
{
  "timeZone": "Asia/Ho_Chi_Minh",
  "exceptionLogging": "STACKDRIVER",
  "oauthScopes": [
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/script.send_mail"
  ]
}
```

5. Them ham test authorize vao GAS neu can:

```javascript
function authorizeDriveAndSheets() {
  DriveApp.getFolderById(LESSON_PLAN_FOLDER_ID).getName();
  SpreadsheetApp.openById(SPREADSHEET_ID).getName();
  MailApp.getRemainingDailyQuota();
}
```

6. Bam Run ham `authorizeDriveAndSheets`.
7. Chap nhan tat ca quyen Google yeu cau.
8. Deploy lai Web App bang `New version`.

## 5. Cac env can co tren Vercel

Bat buoc:

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
```

Neu muon tach rieng upload:

```env
GAS_UPLOAD_WEBHOOK_URL=https://script.google.com/macros/s/AKfycbzaysbasAVWP4anrNYMLDFI7w71tJIxUMJr_dgJ32uxhn592KhDNinWDqYgm3OFE9t-/exec
GAS_UPLOAD_WEBHOOK_SECRET=...
```

Sau khi sua env tren Vercel phai redeploy.

## 6. Cac commit quan trong da day len GitHub

- `e99f84d` - Add Drive uploads and schedule emails
- `35974bc` - Add GAS email provider
- `0f21ccc` - Fix lesson plan uploads exceeding body limit
- `69a96bc` - Use Google user OAuth for Drive uploads
- `8762dac` - Restore Google login basic OAuth scope
- `de66cd4` - Move lesson plan uploads to GAS
- `1a1d65f` - Improve GAS upload response handling

## 7. Viec can lam tiep

Uu tien 1:

- Sua quyen GAS DriveApp theo muc 4.
- Deploy lai GAS `New version`.
- Redeploy Vercel neu code/env co thay doi.
- Test upload bang file nho 1-2 MB.

Uu tien 2:

- Sau khi upload giao an chay on, test lai email giao lich qua GAS.
- Kiem tra CTA xac nhan lich tren email.
- Kiem tra tab `LessonPlans` va `Schedules` sau upload.

Uu tien 3:

- Noi chat/notifications that vao Google Sheet.
- Them backend authorization de giao vien khong goi API xem/sua du lieu nguoi khac.
- Lam man quan ly truong/lop.
- Them audit log cho cac thao tac quan trong.

