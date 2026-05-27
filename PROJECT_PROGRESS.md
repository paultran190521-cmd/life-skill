# HỌC VIỆN METTASOUL Scheduler - Tá»•ng Káº¿t Tiáº¿n TrÃ¬nh

## 1. Má»¥c TiÃªu Há»‡ Thá»‘ng

HỌC VIỆN METTASOUL Scheduler lÃ  web app dÃ¹ng Ä‘á»ƒ giÃ¡o vá»¥/admin quáº£n lÃ½ lá»‹ch dáº¡y cho giÃ¡o viÃªn. Há»‡ thá»‘ng há»— trá»£:

- Quáº£n lÃ½ giÃ¡o viÃªn.
- Quáº£n lÃ½ bÃ i há»c theo khá»‘i vÃ  má»¥c tiÃªu giáº£ng dáº¡y.
- Quáº£n lÃ½ trÆ°á»ng, lá»›p vÃ  khung giá» dáº¡y.
- Giao lá»‹ch dáº¡y cho má»™t hoáº·c nhiá»u giÃ¡o viÃªn.
- GiÃ¡o viÃªn xÃ¡c nháº­n lá»‹ch.
- GiÃ¡o viÃªn táº£i giÃ¡o Ã¡n.
- GiÃ¡o viÃªn Ä‘iá»ƒm danh tá»«ng tiáº¿t.
- Admin theo dÃµi tráº¡ng thÃ¡i lá»‹ch, giÃ¡o Ã¡n, Ä‘iá»ƒm danh vÃ  trao Ä‘á»•i qua chat.
- Dá»¯ liá»‡u chÃ­nh lÆ°u trÃªn Google Sheets.

## 2. CÃ´ng Nghá»‡ Äang DÃ¹ng

- Next.js 16.2.6 App Router.
- React 19.2.0.
- Tailwind CSS 4.
- Lucide React cho icon.
- Google Sheets API qua `googleapis`.
- Google service account Ä‘á»ƒ Ä‘á»c/ghi dá»¯ liá»‡u.
- Font giao diá»‡n: Be Vietnam Pro.
- MÃ u thÆ°Æ¡ng hiá»‡u:
  - ChÃ­nh: `#1992b0`
  - Äáº­m: `#0b6f89`
  - Nháº¥n: `#ff9500`

## 3. Giao Diá»‡n ÄÃ£ HoÃ n ThÃ nh

CÃ¡c mÃ n hÃ¬nh/chá»©c nÄƒng UI hiá»‡n cÃ³:

- Dashboard tá»•ng quan.
- Giao lá»‹ch dáº¡y.
- Lá»‹ch tá»•ng quan.
- Danh sÃ¡ch giÃ¡o viÃªn.
- ThÃªm giÃ¡o viÃªn.
- ThÆ° viá»‡n bÃ i há»c.
- ThÃªm bÃ i há»c.
- Quáº£n lÃ½ khung giá».
- Trung tÃ¢m giÃ¡o Ã¡n.
- Äiá»ƒm danh tá»«ng tiáº¿t.
- Chat theo giÃ¡o viÃªn vÃ  theo tiáº¿t.
- Cáº¥u hÃ¬nh Google Workspace.

Giao diá»‡n Ä‘Ã£ Ä‘Æ°á»£c chá»‰nh:

- DÃ¹ng font Be Vietnam Pro.
- Chuyá»ƒn pháº§n lá»›n chá»¯ chÃ­nh sang mÃ u thÆ°Æ¡ng hiá»‡u.
- Sá»­a tiáº¿ng Viá»‡t cÃ³ dáº¥u vÃ  chÃ­nh táº£.
- CÃ³ tráº¡ng thÃ¡i káº¿t ná»‘i dá»¯ liá»‡u:
  - `Äang táº£i dá»¯ liá»‡u`
  - `ÄÃ£ ná»‘i Google Sheet`
  - `DÃ¹ng dá»¯ liá»‡u táº¡m`
- CÃ³ cáº£nh bÃ¡o khi ghi Google Sheet tháº¥t báº¡i.

## 4. Google Sheets Database

Google Sheet hiá»‡n táº¡i:

```text
https://docs.google.com/spreadsheets/d/1wTbm61GHwmvza94UmNeptTAmhSlLEPHQaoCLC7uMni0/edit
```

Spreadsheet ID:

```text
1wTbm61GHwmvza94UmNeptTAmhSlLEPHQaoCLC7uMni0
```

CÃ¡c tab Ä‘Ã£ táº¡o:

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

CÃ¡c cá»™t Ä‘Ã£ Ä‘Æ°á»£c táº¡o tá»± Ä‘á»™ng báº±ng Google Apps Script vÃ  cÅ©ng cÃ³ script Node Ä‘á»ƒ cáº­p nháº­t láº¡i header náº¿u cáº§n.

Script Node hiá»‡n cÃ³:

```text
scripts/setup-google-sheets.mjs
```

Lá»‡nh cháº¡y:

```powershell
npm run setup:sheets
```

Script nÃ y cÃ³ thá»ƒ:

- DÃ¹ng spreadsheet cÃ³ sáºµn náº¿u cÃ³ `GOOGLE_SHEETS_SPREADSHEET_ID`.
- Táº¡o spreadsheet má»›i náº¿u chÆ°a cÃ³ ID.
- Táº¡o Ä‘á»§ tab náº¿u thiáº¿u.
- Ghi header.
- Freeze dÃ²ng header.
- TÃ´ mÃ u header theo mÃ u thÆ°Æ¡ng hiá»‡u.
- Auto resize cá»™t.

## 5. Service Account VÃ  Env

Service account Ä‘Ã£ dÃ¹ng:

```text
mettasoul-bot@hoc-vien-mettasoul-scheduler.iam.gserviceaccount.com
```

File `.env.local` Ä‘ang dÃ¹ng local, khÃ´ng Ä‘Æ°á»£c commit lÃªn GitHub:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SHEETS_TITLE="HỌC VIỆN METTASOUL Database"
GOOGLE_DRIVE_LESSON_PLANS_FOLDER_ID=
RESEND_API_KEY=
EMAIL_FROM="HỌC VIỆN METTASOUL <lichday@example.com>"
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

CÃ¡c file nháº¡y cáº£m Ä‘Ã£ Ä‘Æ°á»£c ignore:

- `.env.local`
- `hoc-vien-mettasoul-scheduler-*.json`
- `node_modules`
- `.next`

LÆ°u Ã½ báº£o máº­t:

- Private key service account Ä‘Ã£ tá»«ng Ä‘Æ°á»£c paste trong chat, nÃªn nÃªn rotate key trong Google Cloud Console.
- Sau khi rotate, cáº­p nháº­t láº¡i `.env.local` vÃ  Vercel Environment Variables.

## 6. API ÄÃ£ Táº¡o

CÃ¡c API routes hiá»‡n cÃ³:

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

CÃ¡c API nÃ y dÃ¹ng module:

```text
lib/google-sheets.ts
```

Module nÃ y chá»‹u trÃ¡ch nhiá»‡m:

- Khá»Ÿi táº¡o Google Sheets client báº±ng service account.
- Normalize private key Ä‘á»ƒ trÃ¡nh lá»—i format.
- Äá»c rows tá»« tá»«ng tab.
- Ghi row má»›i.
- Cáº­p nháº­t row theo `id`.
- Map dá»¯ liá»‡u Sheet thÃ nh type trong app.

## 7. Dá»¯ Liá»‡u ÄÃ£ Ná»‘i Tháº­t

CÃ¡c pháº§n hiá»‡n Ä‘Ã£ ghi/Ä‘á»c Google Sheet:

- ThÃªm giÃ¡o viÃªn vÃ o tab `Teachers`.
- ThÃªm bÃ i há»c vÃ o tab `Lessons`.
- ThÃªm khung giá» vÃ o tab `TimeSlots`.
- Giao lá»‹ch vÃ o tab `Schedules`.
- XÃ¡c nháº­n lá»‹ch qua `Schedules`.
- Há»§y lá»‹ch qua `Schedules`.
- Chuyá»ƒn lá»‹ch qua `Schedules`.
- Äiá»ƒm danh vÃ o tab `Attendance`.
- Ghi giÃ¡o Ã¡n demo vÃ o tab `LessonPlans`.

App váº«n cÃ³ fallback dá»¯ liá»‡u máº«u náº¿u sheet chÆ°a cÃ³ dá»¯ liá»‡u á»Ÿ má»™t sá»‘ tab.

## 8. CÃ¡c Lá»—i ÄÃ£ Xá»­ LÃ½

### Npm install khÃ´ng táº¡o `node_modules`

NguyÃªn nhÃ¢n:

- PowerShell cháº·n `npm.ps1`.
- Cache npm máº·c Ä‘á»‹nh trong AppData bá»‹ `EPERM`.
- Npm gáº·p lá»—i certificate `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.

CÃ¡ch xá»­ lÃ½:

```powershell
$env:NODE_OPTIONS='--use-system-ca'
npm.cmd install --cache C:\tmp\npm-cache --no-audit --no-fund
```

### Vercel cháº·n deploy vÃ¬ Next.js vulnerable

NguyÃªn nhÃ¢n:

```text
Vulnerable version of Next.js detected
```

CÃ¡ch xá»­ lÃ½:

- Cáº­p nháº­t Next.js tá»« `16.0.3` lÃªn `16.2.6`.
- Build local pass.

### Input bá»‹ máº¥t focus sau má»—i kÃ½ tá»±

NguyÃªn nhÃ¢n:

- CÃ¡c panel Ä‘Æ°á»£c Ä‘á»‹nh nghÄ©a bÃªn trong `MettasoulApp` vÃ  render dáº¡ng JSX component.
- Má»—i láº§n nháº­p state Ä‘á»•i, React remount form.

CÃ¡ch xá»­ lÃ½:

- Äá»•i render tá»«:

```tsx
return <TeachersPanel />;
```

sang:

```tsx
return TeachersPanel();
```

### Dá»¯ liá»‡u hiá»‡n trÃªn UI nhÆ°ng khÃ´ng vÃ o Google Sheet

NguyÃªn nhÃ¢n:

- Code cÅ© catch lá»—i API rá»“i váº«n thÃªm dá»¯ liá»‡u vÃ o state local.

CÃ¡ch xá»­ lÃ½:

- Náº¿u ghi Google Sheet lá»—i thÃ¬ khÃ´ng cáº­p nháº­t UI nhÆ° Ä‘Ã£ lÆ°u.
- Hiá»ƒn thá»‹ cáº£nh bÃ¡o lá»—i rÃµ rÃ ng.

### Lá»—i private key

Lá»—i:

```text
error:1E08010C:DECODER routines::unsupported
```

NguyÃªn nhÃ¢n:

- Private key trong env sai format hoáº·c cÃ³ quote/kÃ½ tá»± escape khÃ´ng Ä‘Ãºng.

CÃ¡ch xá»­ lÃ½:

- ThÃªm normalize private key trong `lib/google-sheets.ts`.
- Há»— trá»£ cáº£ dáº¡ng nhiá»u dÃ²ng tháº­t vÃ  dáº¡ng `\n`.

## 9. Vercel Deployment

Khi deploy Vercel, cáº§n thÃªm Environment Variables:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
GOOGLE_SHEETS_SPREADSHEET_ID
```

Sau khi thÃªm hoáº·c sá»­a env trÃªn Vercel:

- Pháº£i redeploy.
- Deployment cÅ© khÃ´ng tá»± nháº­n env má»›i.

Private key trÃªn Vercel nÃªn dÃ¡n khÃ´ng kÃ¨m dáº¥u nhÃ¡y kÃ©p bao ngoÃ i.

## 10. Kiá»ƒm Tra ÄÃ£ Thá»±c Hiá»‡n

ÄÃ£ build thÃ nh cÃ´ng nhiá»u láº§n:

```powershell
npm run build
```

Káº¿t quáº£:

```text
Compiled successfully
Finished TypeScript
Generated static pages
```

ÄÃ£ kiá»ƒm tra API local:

```text
GET /api/app-data
STATUS=200
```

ÄÃ£ xÃ¡c nháº­n Google Sheet nháº­n dá»¯ liá»‡u.

## 11. CÃ¡c File Quan Trá»ng

```text
app/layout.tsx
app/globals.css
components/mettasoul-app.tsx
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

## 12. BÆ°á»›c Tiáº¿p Theo Äá» Xuáº¥t

CÃ¡c bÆ°á»›c nÃªn lÃ m tiáº¿p:

1. ThÃªm Google Login tháº­t.
2. Äá»c role tá»« tab `Users`.
3. Chá»‰ cho giÃ¡o viÃªn xem lá»‹ch cá»§a chÃ­nh mÃ¬nh.
4. Upload giÃ¡o Ã¡n tháº­t lÃªn Google Drive.
5. Gá»­i email lá»‹ch dáº¡y báº±ng Resend hoáº·c Gmail API.
6. Gá»­i email cÃ³ CTA xÃ¡c nháº­n lá»‹ch.
7. Ná»‘i chat tháº­t vÃ o Google Sheet.
8. ThÃªm mÃ n quáº£n lÃ½ trÆ°á»ng/lá»›p.
9. ThÃªm import/export dá»¯ liá»‡u máº«u.
10. ThÃªm validation dá»¯ liá»‡u trÆ°á»›c khi ghi Sheet.
11. ThÃªm loading state cho tá»«ng nÃºt lÆ°u.
12. ThÃªm audit log vÃ o tab `AuditLogs`.



