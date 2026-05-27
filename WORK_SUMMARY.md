# WORK SUMMARY - HỌC VIỆN METTASOUL Scheduler

## Cập Nhật Cuối Phiên 27/05/2026

Trạng thái cuối phiên:

- Đã tiếp tục hoàn thiện phân hệ Giao lịch, đặc biệt là luồng gửi lịch hàng loạt, xem trước lịch, email xác nhận và đọc/ghi dữ liệu Google Sheets.
- Đã xử lý lỗi quota Google Sheets khi gửi lịch bằng cách giảm số lần đọc riêng lẻ và chuyển một phần đọc dữ liệu sang batch read.
- Đã sửa lỗi `Trường đã chọn không tồn tại` khi bấm gửi lịch. Nguyên nhân chính là `batchGet` của Google Sheets trả range không khớp format code cũ đang so sánh, làm dữ liệu `Schools` bị đọc rỗng. Đã sửa mapping batch theo thứ tự response và bổ sung fallback theo tên sheet.
- Đã bổ sung chuẩn hóa header Google Sheet để nhận các biến thể như `ID`, `Id`, `id`, `schoolId`, `timeSlotId`, cũng như một số header tiếng Việt như `Tiêu đề`, `Bài học`, `Tên bài học`, `Mục tiêu`.
- Đã gia cố API tạo lịch để resolve dữ liệu theo cả ID và tên hiển thị cho trường, lớp, bài học, khung giờ.
- Đã bổ sung luồng email xác nhận tất cả lịch trong một email bằng nút `XÁC NHẬN TẤT CẢ (TẤT CẢ LỊCH ĐƯỢC XÁC NHẬN)`.
- Đã cập nhật format email lịch dạy: subject in hoa, bảng viền cam `#ff9500`, nút từng dòng là `XÁC NHẬN`, cột `KHUNG GIỜ` hiển thị gọn dạng giờ, các header bảng viết in hoa.
- Đã cập nhật lại `scripts/gas-life-skill-webhook.js` để GAS có webhook chuẩn trong repo, có `requestId`, `templateVersion`, sender name `HỌC VIỆN METTASOUL`, và có lớp normalize nội dung email trước khi gửi.
- Đã xác nhận email vẫn còn lỗi chính tả ở cuối phiên: Gmail sender đã đổi sang `HỌC VIỆN METTASOUL`, chứng tỏ GAS mới có chạy; tuy nhiên HTML email vẫn còn nội dung cũ như `KỸ TRỐNG` và câu `giáo vụ vừa lịch giảng dạy`. Cần tiếp tục kiểm tra nguồn HTML thực tế hoặc phiên bản deploy app/GAS ở phiên sau.
- Đã rebrand giao diện/app sang `HỌC VIỆN METTASOUL` và đặt mặc định `Lịch tổng`, `Lịch của tôi` ở chế độ xem tuần.
- Đã thêm môi trường dạy học trong phân hệ Giao lịch gồm: `Trong lớp`, `Ngoài sân`, `Nhà thi đấu`, `Báo cáo sân trường`; môi trường hiển thị dạng badge và dùng cho thống kê/KPI sau này.
- Đã tinh gọn hiển thị khung giờ trong danh sách lịch: bỏ nhãn buổi như `tiết sáng`, chỉ hiển thị giờ để dễ đọc.
- Đã thêm menu Tổng quan cho giáo viên, có lọc thời gian, thống kê lịch đã dạy/sắp dạy, điểm danh trễ, không điểm danh, giáo án đã gửi/chưa gửi và thống kê theo môi trường dạy học.
- Đã chỉnh quyền xem Tổng quan giáo viên: admin được chọn/xem tài khoản khác; giáo viên chỉ xem dữ liệu của chính họ.
- Đã nâng cấp giao diện các card tổng quan giáo viên: nằm gọn trên một hàng, mỗi card có màu phân biệt theo nội dung và font số lớn hơn.
- Đã nâng cấp chuông thông báo để mở danh sách thông báo thay vì chỉ hiện badge.
- Đã thêm phân hệ `Hướng dẫn sử dụng` trong `Cấu hình`, tạo trang HTML hướng dẫn trực quan tại `public/huong-dan-su-dung/index.html`.
- Đã thêm chức năng feedback cho admin và giáo viên, mở modal nhập góp ý về tính năng/menu/quy trình mong muốn.
- Đã mở rộng hướng dẫn sử dụng theo các phân hệ, dùng font Quicksand và tham khảo `USAGE_GUIDE_DRAFT.md`.
- Đã bỏ phân hệ chat khỏi kế hoạch sử dụng hiện tại theo yêu cầu. Các phần chat từng làm trước đó được xem là không tiếp tục phát triển trong phiên kế tiếp, trừ khi có yêu cầu khôi phục.

Các commit chính đã push trong phiên:

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

Việc cần ưu tiên khi bắt đầu phiên sau:

- Kiểm tra triệt để nguồn HTML email thực tế trước khi GAS gửi: log `payload.templateVersion`, một đoạn đầu `payload.html`, và xác nhận app deploy đang chạy đúng commit mới.
- Nếu vẫn còn `KỸ TRỐNG`, cần kiểm tra có template email nào khác ngoài `lib/email.ts` hoặc có Apps Script file cũ nào vẫn được deploy.
- Xem lại dữ liệu bài học trong Google Sheet tab `Lessons` để xác nhận `title` đúng là `Thấu cảm và trắc ẩn`, không phải dữ liệu sai đã lưu trong sheet.
- Sau khi sửa email triệt để, gửi lại một lịch test và chụp lại email để xác nhận: sender, subject, tiêu đề hệ thống, câu chào, tên bài, khung giờ, header bảng và CTA đều đúng.

NgÃ y cáº­p nháº­t: 26/05/2026
NhÃ¡nh hiá»‡n táº¡i: `main`

## 1. Tá»•ng Quan Tráº¡ng ThÃ¡i

HỌC VIỆN METTASOUL Scheduler lÃ  web app Next.js dÃ¹ng cho giÃ¡o vá»¥/admin quáº£n lÃ½ lá»‹ch dáº¡y ká»¹ nÄƒng sá»‘ng, giao lá»‹ch cho giÃ¡o viÃªn, theo dÃµi giÃ¡o Ã¡n, Ä‘iá»ƒm danh, thÃ´ng bÃ¡o váº­n hÃ nh vÃ  chat ná»™i bá»™.

Tráº¡ng thÃ¡i Ä‘Ã£ hoÃ n táº¥t Ä‘áº¿n hiá»‡n táº¡i:

- Dá»¯ liá»‡u chÃ­nh Ä‘á»c/ghi qua Google Sheets.
- Google Apps Script Ä‘Æ°á»£c dÃ¹ng cho email lá»‹ch dáº¡y vÃ  upload/xÃ³a file giÃ¡o Ã¡n trÃªn Google Drive.
- UI chÃ­nh Ä‘Ã£ chuyá»ƒn sang font `Quicksand` vÃ  tÄƒng Ä‘á»™ dÃ y chá»¯ máº·c Ä‘á»‹nh lÃªn má»™t cáº¥p Ä‘á»ƒ dá»… Ä‘á»c hÆ¡n.
- ÄÃ£ má»Ÿ rá»™ng giao diá»‡n khá»i giá»›i háº¡n 2 mÃ u thÆ°Æ¡ng hiá»‡u: thÃªm báº£ng mÃ u semantic dá»‹u cho tráº¡ng thÃ¡i, khá»‘i, toast vÃ  cÃ¡c Ä‘iá»ƒm nháº¥n.
- ÄÃ£ nÃ¢ng cáº¥p hiá»‡u á»©ng giao diá»‡n: ná»n nhiá»u lá»›p, panel cÃ³ chiá»u sÃ¢u, sidebar/header dáº¡ng glass, CTA gradient, hover má»m vÃ  toast cÃ³ animation.
- Viá»n card, Ã´ lá»c vÃ  Ã´ tÃ¬m kiáº¿m Ä‘Ã£ Ä‘Æ°á»£c tÄƒng mÃ u nháº¥n Ä‘á»ƒ ná»•i báº­t hÆ¡n trÃªn ná»n giao diá»‡n.
- ÄÃ£ thay `window.confirm`/`window.prompt` báº±ng dialog ná»™i bá»™ vÃ  toast trong app.
- PhÃ¢n há»‡ Khung giá» Ä‘Ã£ chuyá»ƒn vÃ o `Cáº¥u hÃ¬nh`, cÃ³ quáº£n trá»‹ báº£ng, sá»­a/báº­t/táº¯t/xÃ³a má»m vÃ  import Excel chuáº©n 45/90 phÃºt.
- ÄÃ£ cÃ³ quy trÃ¬nh báº¯t buá»™c: sau khi chá»‘t tÃ­nh nÄƒng phÃ¢n há»‡, cáº­p nháº­t `USAGE_GUIDE_DRAFT.md`, build/test, commit vÃ  push lÃªn `main`.

## 2. PhÃ¢n Há»‡ Giao Lá»‹ch

ÄÃ£ hoÃ n táº¥t:

- Táº¡o lá»‹ch dáº¡y theo lÃ´: má»™t láº§n gá»­i cÃ³ thá»ƒ táº¡o nhiá»u dÃ²ng lá»‹ch.
- Má»™t láº§n gá»­i cÃ³ thá»ƒ giao cho nhiá»u giÃ¡o viÃªn.
- Má»—i dÃ²ng lá»‹ch gá»“m: ngÃ y dáº¡y, trÆ°á»ng, khá»‘i/lá»›p, khung giá», bÃ i há»c.
- Luá»“ng chá»n má»›i theo thá»© tá»± `TrÆ°á»ng -> Khá»‘i -> Lá»›p -> Khung giá» -> BÃ i há»c`.
- Khi Ä‘á»•i khá»‘i, danh sÃ¡ch lá»›p vÃ  bÃ i há»c tá»± lá»c theo khá»‘i tÆ°Æ¡ng á»©ng.
- CÃ³ preview lá»‹ch sáº¯p gá»­i trÆ°á»›c khi táº¡o lá»‹ch chÃ­nh thá»©c.
- Backend validate trÆ°á»ng, lá»›p, khung giá», giÃ¡o viÃªn, bÃ i há»c vÃ  quan há»‡ bÃ i há»c Ä‘Ãºng khá»‘i.
- Sau khi táº¡o lá»‹ch, há»‡ thá»‘ng ghi `Schedules`, táº¡o `ChatThreads`, táº¡o `Notifications` vÃ  ghi `AuditLogs`.
- Email lá»‹ch dáº¡y Ä‘Æ°á»£c gom theo tá»«ng giÃ¡o viÃªn, má»—i giÃ¡o viÃªn nháº­n má»™t email tá»•ng há»£p thay vÃ¬ nhiá»u email rá»i.
- Email cÃ³ tiÃªu Ä‘á» theo tuáº§n ISO vÃ  ná»™i dung dáº¡ng báº£ng Ä‘á»ƒ xem nhanh nhiá»u lá»‹ch.
- Má»—i dÃ²ng lá»‹ch trong email tá»•ng há»£p cÃ³ nÃºt xÃ¡c nháº­n riÃªng.
- Teacher chá»‰ tháº¥y lá»‹ch cá»§a mÃ¬nh; admin tháº¥y toÃ n bá»™.
- Backend cÃ³ kiá»ƒm tra quyá»n cho táº¡o, há»§y, chuyá»ƒn vÃ  xÃ¡c nháº­n lá»‹ch.
- ChÃ­nh sÃ¡ch hiá»‡n táº¡i: cho phÃ©p trÃ¹ng giá», khÃ´ng cháº·n conflict.

CÃ¡c lá»—i Ä‘Ã£ xá»­ lÃ½ trong phÃ¢n há»‡ nÃ y:

- Lá»—i `Unauthorized` khi gá»­i lá»‹ch báº±ng tÃ i khoáº£n ná»™i bá»™.
- Lá»—i trÆ°á»ng/lá»›p/khung giá»/giÃ¡o viÃªn khÃ´ng tá»“n táº¡i do dá»¯ liá»‡u Sheet vÃ  ID chÆ°a Ä‘á»“ng bá»™.
- Lá»—i preview hiá»‡n lá»‹ch cÅ© thay vÃ¬ lá»‹ch sáº¯p gá»­i.
- Lá»—i danh sÃ¡ch giÃ¡o viÃªn chá»n bá»‹ lá»‡ch khi giÃ¡o viÃªn Ä‘Ã£ táº¯t hoáº·c khÃ´ng há»£p lá»‡.

## 3. PhÃ¢n Há»‡ GiÃ¡o ViÃªn

ÄÃ£ hoÃ n táº¥t:

- ThÃªm giÃ¡o viÃªn Ä‘Æ¡n láº» vá»›i há» tÃªn, email, sá»‘ Ä‘iá»‡n thoáº¡i, chuyÃªn mÃ´n vÃ  quyá»n.
- Tá»± Ä‘á»™ng táº¡o tÃ i khoáº£n `Users` liÃªn káº¿t vá»›i báº£n ghi `Teachers`.
- Äá»•i phÃ¢n quyá»n giÃ¡o viÃªn/admin trá»±c tiáº¿p trÃªn danh sÃ¡ch.
- Sá»­a thÃ´ng tin giÃ¡o viÃªn ngay trÃªn tá»«ng dÃ²ng.
- Báº­t/táº¯t tráº¡ng thÃ¡i hoáº¡t Ä‘á»™ng cá»§a giÃ¡o viÃªn.
- XÃ³a giÃ¡o viÃªn, cÃ³ kiá»ƒm tra rÃ ng buá»™c lá»‹ch dáº¡y liÃªn quan.
- TÃ¬m giÃ¡o viÃªn nhanh trÃªn thanh tÃ¬m kiáº¿m; gÃµ tá»« khÃ³a sáº½ lá»c tá»©c thá»i theo tÃªn, email, sá»‘ Ä‘iá»‡n thoáº¡i hoáº·c chuyÃªn mÃ´n.
- Danh sÃ¡ch giÃ¡o viÃªn hiá»ƒn thá»‹ dáº¡ng báº£ng ngang nhÆ° Excel vá»›i cÃ¡c cá»™t chÃ­nh.
- NÃºt `ThÃªm giÃ¡o viÃªn` má»Ÿ modal riÃªng.
- Há»— trá»£ táº£i máº«u Excel vÃ  import hÃ ng loáº¡t giÃ¡o viÃªn tá»« `.xlsx`, `.csv`, `.tsv`.
- Import cÃ³ validate báº¯t buá»™c há» tÃªn/email, chuáº©n hÃ³a quyá»n, cháº·n email trÃ¹ng trong file vÃ  bá» qua email Ä‘Ã£ tá»“n táº¡i.

Ã nghÄ©a báº­t/táº¯t giÃ¡o viÃªn:

- `Báº­t`: giÃ¡o viÃªn Ä‘ang hoáº¡t Ä‘á»™ng vÃ  cÃ³ thá»ƒ Ä‘Æ°á»£c chá»n Ä‘á»ƒ giao lá»‹ch má»›i.
- `Táº¯t`: giÃ¡o viÃªn táº¡m ngÆ°ng, khÃ´ng máº¥t dá»¯ liá»‡u lá»‹ch sá»­, khÃ´ng Ä‘Æ°á»£c chá»n khi giao lá»‹ch má»›i.
- Khi táº¯t giÃ¡o viÃªn, tÃ i khoáº£n `Users` liÃªn káº¿t cÅ©ng chuyá»ƒn sang tráº¡ng thÃ¡i khÃ´ng hoáº¡t Ä‘á»™ng.

## 4. PhÃ¢n Há»‡ Lá»‹ch Tá»•ng

ÄÃ£ hoÃ n táº¥t:

- Hiá»ƒn thá»‹ lá»‹ch tá»•ng dáº¡ng lÆ°á»›i thÃ¡ng, chia thÃ nh cÃ¡c Ã´ theo ngÃ y.
- NgÃ y hiá»‡n táº¡i luÃ´n Ä‘Æ°á»£c lÃ m ná»•i báº­t.
- CÃ³ cháº¿ Ä‘á»™ xem `ThÃ¡ng`, `Tuáº§n`, `NgÃ y`.
- Ã” ngÃ y trong cháº¿ Ä‘á»™ thÃ¡ng chá»‰ hiá»‡n nhÃ£n sá»‘ lÆ°á»£ng lá»‹ch vÃ  tÃªn giÃ¡o viÃªn, khÃ´ng hiá»‡n tÃªn chuyÃªn Ä‘á» Ä‘á»ƒ giá»¯ giao diá»‡n gá»n.
- NgÃ y khÃ´ng cÃ³ lá»‹ch khÃ´ng hiá»‡n chá»¯ `Trá»‘ng`.
- Khi báº¥m vÃ o Ã´ ngÃ y, mÃ n hÃ¬nh tá»± cuá»™n xuá»‘ng vÃ¹ng chi tiáº¿t bÃªn dÆ°á»›i.
- VÃ¹ng chi tiáº¿t hiá»‡n danh sÃ¡ch lá»‹ch trong ngÃ y theo dáº¡ng dÃ²ng lá»‹ch hiá»‡n táº¡i.
- Báº¥m vÃ o báº¥t ká»³ Ä‘iá»ƒm nÃ o trÃªn dÃ²ng lá»‹ch chi tiáº¿t sáº½ má»Ÿ modal chi tiáº¿t giá»¯a mÃ n hÃ¬nh.
- Modal chi tiáº¿t lá»‹ch hiá»‡n Ä‘áº§y Ä‘á»§: ngÃ y dáº¡y, giÃ¡o viÃªn, sá»‘ Ä‘iá»‡n thoáº¡i, trÆ°á»ng, lá»›p, tráº¡ng thÃ¡i, khung giá», giÃ¡o Ã¡n vÃ  má»¥c tiÃªu bÃ i há»c.
- Má»¥c tiÃªu bÃ i há»c trong modal Ä‘Æ°á»£c tÃ¡ch dÃ²ng thÃ nh tá»«ng má»¥c Ä‘á»ƒ dá»… Ä‘á»c.
- Giao diá»‡n lá»‹ch dÃ¹ng mÃ u nháº¥n theo ngá»¯ nghÄ©a: tráº¡ng thÃ¡i, Ä‘iá»ƒm danh, khung giá», trÆ°á»ng, lá»›p.
- CÃ³ bá»™ lá»c nÃ¢ng cao theo tráº¡ng thÃ¡i, giÃ¡o viÃªn, trÆ°á»ng, lá»›p, khung giá» vÃ  khoáº£ng ngÃ y.
- CÃ³ sáº¯p xáº¿p theo ngÃ y tÄƒng dáº§n, ngÃ y giáº£m dáº§n hoáº·c tráº¡ng thÃ¡i.
- Bá»™ lá»c lá»‹ch Ä‘Æ°á»£c ghi nhá»› trÃªn trÃ¬nh duyá»‡t.
- CÃ³ thá»‘ng kÃª nhanh tá»•ng lá»‹ch, lá»‹ch chá» xÃ¡c nháº­n, Ä‘Ã£ nháº­n, Ä‘Ã£ Ä‘iá»ƒm danh vÃ  Ä‘Ã£ há»§y.
- CÃ³ cáº£nh bÃ¡o váº­n hÃ nh: lá»‹ch sáº¯p dáº¡y chÆ°a xÃ¡c nháº­n, lá»‹ch quÃ¡ ngÃ y chÆ°a Ä‘iá»ƒm danh, giÃ¡o viÃªn cÃ³ nhiá»u lá»‹ch há»§y.
- Báº¥m vÃ o tháº» cáº£nh bÃ¡o váº­n hÃ nh sáº½ má»Ÿ modal liá»‡t kÃª tá»«ng lá»‹ch liÃªn quan vá»›i: ngÃ y dáº¡y, giÃ¡o viÃªn, lá»›p, trÆ°á»ng, tÃªn chuyÃªn Ä‘á».
- Trong modal cáº£nh bÃ¡o, báº¥m vÃ o má»™t dÃ²ng lá»‹ch sáº½ má»Ÿ tiáº¿p modal chi tiáº¿t Ä‘áº§y Ä‘á»§ cá»§a lá»‹ch Ä‘Ã³.
- CÃ³ thao tÃ¡c hÃ ng loáº¡t trong chi tiáº¿t ngÃ y: chá»n nhiá»u lá»‹ch Ä‘á»ƒ há»§y, chuyá»ƒn giÃ¡o viÃªn hoáº·c gá»­i nháº¯c xÃ¡c nháº­n.
- CÃ³ lá»‹ch sá»­ thao tÃ¡c trÃªn tá»«ng lá»‹ch, Ä‘á»c tá»« `AuditLogs`.
- Admin cÃ³ thá»ƒ há»§y lá»‹ch hoáº·c chuyá»ƒn lá»‹ch ngay trong danh sÃ¡ch chi tiáº¿t.
- GiÃ¡o viÃªn chá»‰ tháº¥y lá»‹ch cá»§a mÃ¬nh vÃ  cÃ³ thá»ƒ xÃ¡c nháº­n lá»‹ch trong danh sÃ¡ch chi tiáº¿t.

## 5. PhÃ¢n Há»‡ GiÃ¡o Ãn

ÄÃ£ hoÃ n táº¥t:

- Upload giÃ¡o Ã¡n qua GAS Web App.
- Há»— trá»£ nhiá»u Ä‘á»‹nh dáº¡ng: `pdf`, `doc`, `docx`, `ppt`, `pptx`, `xls`, `xlsx`, `txt`, `csv`.
- Há»— trá»£ upload nhiá»u file trong má»™t láº§n.
- Giá»›i háº¡n má»—i file 10MB.
- Má»—i lá»‹ch cÃ³ thá»ƒ lÆ°u nhiá»u giÃ¡o Ã¡n.
- TÃ¡ch giao diá»‡n giÃ¡o Ã¡n theo vai trÃ² admin/teacher.
- Admin cÃ³ mÃ n tá»•ng quan giÃ¡o Ã¡n vá»›i thá»‘ng kÃª Ä‘Ã£ ná»™p, chÆ°a ná»™p, lá»‹ch sáº¯p dáº¡y cÃ²n thiáº¿u vÃ  báº£ng giÃ¡o Ã¡n má»›i nháº¥t.
- CÃ¡c card thá»‘ng kÃª giÃ¡o Ã¡n cÃ³ thá»ƒ báº¥m Ä‘á»ƒ lá»c nhanh danh sÃ¡ch tÆ°Æ¡ng á»©ng.
- Admin cÃ³ nÃºt chat nhanh vá»›i giÃ¡o viÃªn ngay trÃªn dÃ²ng giÃ¡o Ã¡n/lá»‹ch giÃ¡o Ã¡n.
- Admin khÃ´ng cÃ²n nÃºt táº£i lÃªn theo tá»«ng giÃ¡o Ã¡n trong giao diá»‡n giÃ¡m sÃ¡t.
- Teacher cÃ³ mÃ n giÃ¡o Ã¡n cá»§a tÃ´i, Æ°u tiÃªn lá»‹ch cáº§n ná»™p vÃ  danh sÃ¡ch giÃ¡o Ã¡n má»›i nháº¥t theo thá»i gian upload.
- Teacher cÃ³ thá»ƒ báº¥m cÃ¡c card thá»‘ng kÃª Ä‘á»ƒ má»Ÿ nhanh danh sÃ¡ch giÃ¡o Ã¡n/lá»‹ch phÃ¹ há»£p.
- Hiá»‡n danh sÃ¡ch giÃ¡o Ã¡n theo tá»«ng lá»‹ch vÃ  theo dÃ²ng file má»›i nháº¥t.
- Sá»­a tÃªn giÃ¡o Ã¡n.
- XÃ³a báº£n ghi giÃ¡o Ã¡n trÃªn Google Sheet.
- XÃ³a file giÃ¡o Ã¡n trÃªn Google Drive qua GAS.
- Backend kiá»ƒm tra quyá»n: teacher chá»‰ xá»­ lÃ½ giÃ¡o Ã¡n cá»§a mÃ¬nh, admin cÃ³ toÃ n quyá»n.

## 6. PhÃ¢n Há»‡ Äiá»ƒm Danh

ÄÃ£ hoÃ n táº¥t:

- Backend Ä‘iá»ƒm danh chuyá»ƒn sang má»™t endpoint kiá»ƒm soÃ¡t táº­p trung: ghi `Attendance`, cáº­p nháº­t `Schedules` sang `attended` vÃ  ghi `AuditLogs`.
- API Ä‘iá»ƒm danh Ä‘Ã£ kiá»ƒm tra Ä‘Äƒng nháº­p/quyá»n: teacher chá»‰ Ä‘iá»ƒm danh lá»‹ch cá»§a mÃ¬nh, admin cÃ³ quyá»n toÃ n há»‡ thá»‘ng.
- API cháº·n Ä‘iá»ƒm danh trÃ¹ng cho cÃ¹ng má»™t lá»‹ch.
- API cháº·n Ä‘iá»ƒm danh lá»‹ch Ä‘Ã£ há»§y.
- Rule thá»i gian hiá»‡n táº¡i: cháº·n Ä‘iá»ƒm danh sá»›m quÃ¡ 30 phÃºt trÆ°á»›c giá» báº¯t Ä‘áº§u; cÃ¡c láº§n Ä‘iá»ƒm danh sau giá» báº¯t Ä‘áº§u váº«n Ä‘Æ°á»£c lÆ°u vÃ  Ä‘Æ°á»£c tÃ­nh lÃ  trá»… Ä‘á»ƒ admin theo dÃµi.
- Admin cÃ³ mÃ n tá»•ng quan Ä‘iá»ƒm danh theo ngÃ y hiá»‡n táº¡i vá»›i cÃ¡c card: tiáº¿t hÃ´m nay, Ä‘Ã£ Ä‘iá»ƒm danh hÃ´m nay, chÆ°a Ä‘iá»ƒm danh hÃ´m nay vÃ  Ä‘iá»ƒm danh trá»… hÃ´m nay.
- Báº¥m vÃ o tá»«ng card sáº½ má»Ÿ modal danh sÃ¡ch lá»‹ch tÆ°Æ¡ng á»©ng, hiá»ƒn thá»‹ giÃ¡o viÃªn, trÆ°á»ng/lá»›p, chuyÃªn Ä‘á», khung giá», tráº¡ng thÃ¡i vÃ  sá»‘ phÃºt trá»… náº¿u cÃ³.
- Admin cÃ³ cáº£nh bÃ¡o giÃ¡o viÃªn cáº§n theo dÃµi khi giÃ¡o viÃªn cÃ³ tá»« 2 láº§n chÆ°a Ä‘iá»ƒm danh hoáº·c tá»« 2 láº§n Ä‘iá»ƒm danh trá»… trong dá»¯ liá»‡u lá»‹ch quÃ¡ ngÃ y; báº¥m vÃ o tá»«ng tháº» cáº£nh bÃ¡o sáº½ má»Ÿ danh sÃ¡ch cÃ¡c lá»‹ch cá»¥ thá»ƒ.
- Admin cÃ³ danh sÃ¡ch lá»‹ch sá»­ Ä‘iá»ƒm danh gáº§n nháº¥t.
- Giao diá»‡n teacher váº«n giá»¯ dáº¡ng Ä‘iá»ƒm danh tá»«ng tiáº¿t, bá»• sung hiá»ƒn thá»‹ giá» báº¯t Ä‘áº§u vÃ  giá» káº¿t thÃºc cá»§a tiáº¿t.

## 7. PhÃ¢n Há»‡ Cáº¥u HÃ¬nh TrÆ°á»ng/Lá»›p

ÄÃ£ hoÃ n táº¥t:

- ThÃªm, sá»­a, xÃ³a trÆ°á»ng.
- ThÃªm, sá»­a, xÃ³a lá»›p.
- MÃ n `Cáº¥u hÃ¬nh` máº·c Ä‘á»‹nh thu gá»n cÃ¡c khá»‘i Ä‘á»ƒ xem tá»•ng quan; báº¥m mÅ©i tÃªn Ä‘á»ƒ má»Ÿ chi tiáº¿t.
- TÃ¡ch `ThÃªm lá»›p` thÃ nh má»™t khá»‘i thu gá»n/má»Ÿ rá»™ng riÃªng.
- ÄÃ£ bá» khá»‘i `Cáº¥u hÃ¬nh Google Workspace` khá»i giao diá»‡n vÃ¬ khÃ´ng cÃ²n cáº§n thao tÃ¡c thÆ°á»ng xuyÃªn.
- Khi thÃªm lá»›p cÃ³ thá»ƒ nháº­p nhiá»u tÃªn lá»›p cÃ¹ng lÃºc, cÃ¡ch nhau báº±ng dáº¥u pháº©y.
- Há»‡ thá»‘ng tá»± xÃ¡c Ä‘á»‹nh khá»‘i tá»« tÃªn lá»›p, vÃ­ dá»¥ `10A1` thÃ nh `Khá»‘i 10`.
- Dá»¯ liá»‡u trÆ°á»ng/lá»›p ghi vÃ o Google Sheet vÃ  Ä‘Æ°á»£c dÃ¹ng láº¡i trong phÃ¢n há»‡ Giao lá»‹ch.

## 8. PhÃ¢n Há»‡ Khung Giá»

ÄÃ£ hoÃ n táº¥t:

- Chuyá»ƒn quáº£n lÃ½ khung giá» vÃ o tab `Cáº¥u hÃ¬nh` Ä‘á»ƒ gom cÃ¹ng dá»¯ liá»‡u ná»n.
- Bá» tab `Khung giá»` riÃªng khá»i sidebar admin.
- ThÃªm khung giá» thá»§ cÃ´ng vá»›i validate giá» báº¯t Ä‘áº§u/káº¿t thÃºc.
- Chá»‰ cháº¥p nháº­n khung giá» cÃ³ thá»i lÆ°á»£ng 45 phÃºt hoáº·c 90 phÃºt.
- Hiá»ƒn thá»‹ danh sÃ¡ch khung giá» dáº¡ng báº£ng vá»›i tÃªn, giá» báº¯t Ä‘áº§u, giá» káº¿t thÃºc, sá»‘ phÃºt, tráº¡ng thÃ¡i vÃ  thao tÃ¡c.
- Sá»­a nhanh tá»«ng khung giá» ngay trÃªn báº£ng.
- Báº­t/táº¯t khung giá»; khung giá» táº¯t khÃ´ng Ä‘Æ°á»£c chá»n khi giao lá»‹ch má»›i.
- Chá»n nhiá»u khung giá» vÃ  báº­t/táº¯t hÃ ng loáº¡t ngay trÃªn báº£ng.
- XÃ³a má»m khung giá» báº±ng cÃ¡ch chuyá»ƒn tráº¡ng thÃ¡i sang táº¯t, giá»¯ an toÃ n cho lá»‹ch sá»­.
- Táº£i máº«u Excel khung giá».
- Import hÃ ng loáº¡t khung giá» tá»« `.xlsx`, `.csv`, `.tsv`.
- Import cÃ³ validate cá»™t báº¯t buá»™c, Ä‘á»‹nh dáº¡ng `HH:mm`, thá»i lÆ°á»£ng 45/90 phÃºt, sá»‘ phÃºt khá»›p giá» vÃ  cháº·n trÃ¹ng tÃªn/trÃ¹ng giá».
- API `/api/time-slots` há»— trá»£ táº¡o nhiá»u khung giá» má»™t láº§n.
- API `/api/time-slots/[id]` há»— trá»£ cáº­p nháº­t/sá»­a/báº­t/táº¯t tá»«ng khung giá».

## 9. PhÃ¢n Há»‡ Chat

ÄÃ£ hoÃ n táº¥t:

- Tin nháº¯n chat Ä‘Ã£ ghi tháº­t vÃ o Google Sheet tab `ChatMessages`, khÃ´ng cÃ²n chá»‰ lÆ°u táº¡m trÃªn trÃ¬nh duyá»‡t.
- ThÃªm API `/api/chat-messages` Ä‘á»ƒ gá»­i tin nháº¯n cÃ³ kiá»ƒm tra Ä‘Äƒng nháº­p vÃ  quyá»n theo kÃªnh chat.
- ThÃªm API `/api/chat-threads` Ä‘á»ƒ táº¡o nhanh kÃªnh trao Ä‘á»•i theo giÃ¡o viÃªn vÃ  lÆ°u vÃ o `ChatThreads`.
- ThÃªm API `/api/chat-threads/[id]/read` Ä‘á»ƒ há»— trá»£ Ä‘Ã¡nh dáº¥u Ä‘Ã£ Ä‘á»c khi cáº§n.
- Script setup Google Sheets Ä‘Ã£ bá»• sung cÃ¡c header má»Ÿ rá»™ng cho `ChatMessages`: `attachmentName`, `attachmentUrl`, `readByAdminAt`, `readByTeacherAt`; API Ä‘á»c/Ä‘Ã¡nh dáº¥u Ä‘Ã£ Ä‘á»c cÅ©ng cÃ³ thá»ƒ bá»• sung header khi cáº§n.
- Admin xem toÃ n bá»™ kÃªnh chat; teacher chá»‰ xem/gá»­i trong kÃªnh thuá»™c giÃ¡o viÃªn cá»§a mÃ¬nh.
- Danh sÃ¡ch kÃªnh chat cÃ³ tÃ¬m kiáº¿m theo giÃ¡o viÃªn, lá»›p, trÆ°á»ng, chuyÃªn Ä‘á» vÃ  ná»™i dung tin nháº¯n.
- CÃ³ bá»™ lá»c kÃªnh: táº¥t cáº£, chÆ°a Ä‘á»c, theo giÃ¡o viÃªn, theo tiáº¿t.
- Má»—i kÃªnh hiá»ƒn thá»‹ tin nháº¯n má»›i nháº¥t, sá»‘ tin chÆ°a Ä‘á»c, giÃ¡o viÃªn liÃªn quan vÃ  ngá»¯ cáº£nh ngÃ y/lá»›p náº¿u lÃ  kÃªnh theo tiáº¿t.
- Khung chat theo tiáº¿t hiá»ƒn thá»‹ ngá»¯ cáº£nh lá»‹ch: ngÃ y dáº¡y, trÆ°á»ng, lá»›p, bÃ i há»c vÃ  khung giá».
- Tin nháº¯n há»— trá»£ Ä‘Ã­nh kÃ¨m báº±ng link vá»›i tÃªn Ä‘Ã­nh kÃ¨m.
- ÄÃ£ bá» tá»± táº£i láº¡i Ä‘á»‹nh ká»³ Ä‘á»ƒ trÃ¡nh vÆ°á»£t quota Ä‘á»c Google Sheets; tráº¡ng thÃ¡i Ä‘Ã£ Ä‘á»c Ä‘Æ°á»£c cáº­p nháº­t tá»©c thá»i trÃªn phiÃªn Ä‘ang má»Ÿ.

## 10. Email Lá»‹ch Dáº¡y

ÄÃ£ hoÃ n táº¥t:

- Äá»•i nháº­n diá»‡n email sang `Há»† THá»NG THÃ”NG BÃO Lá»ŠCH Dáº Y Ká»¸ NÄ‚NG Sá»NG METTASOUL`.
- Sá»­a ná»™i dung tiáº¿ng Viá»‡t cÃ³ dáº¥u trong máº«u email.
- CÄƒn giá»¯a tiÃªu Ä‘á» vÃ  nÃºt xÃ¡c nháº­n lá»‹ch dáº¡y.
- Má»¥c tiÃªu bÃ i há»c trong email Ä‘Æ°á»£c tÃ¡ch thÃ nh tá»«ng dÃ²ng.
- Email tá»•ng há»£p cÃ³ báº£ng lá»‹ch vÃ  nÃºt xÃ¡c nháº­n riÃªng cho tá»«ng dÃ²ng.

## 11. Dá»¯ Liá»‡u VÃ  TÃ­ch Há»£p

Nguá»“n dá»¯ liá»‡u chÃ­nh hiá»‡n táº¡i lÃ  Google Sheets vá»›i cÃ¡c tab:

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

CÃ¡c API/tÃ­ch há»£p Ä‘Ã£ dÃ¹ng:

- Next.js API routes cho dá»¯ liá»‡u á»©ng dá»¥ng, lá»‹ch, giÃ¡o viÃªn, trÆ°á»ng/lá»›p, bÃ i há»c, khung giá», giÃ¡o Ã¡n, Ä‘iá»ƒm danh, chat, thÃ´ng bÃ¡o, auth.
- Google Sheets cho Ä‘á»c/ghi dá»¯ liá»‡u nghiá»‡p vá»¥.
- Google Drive qua GAS cho file giÃ¡o Ã¡n.
- GAS cho gá»­i email lá»‹ch dáº¡y vÃ  xá»­ lÃ½ file.

## 12. TÃ i Liá»‡u VÃ  Quy TrÃ¬nh LÃ m Viá»‡c

ÄÃ£ thiáº¿t láº­p quy trÃ¬nh:

- Má»—i khi chá»‘t xong má»™t tÃ­nh nÄƒng/phiÃªn nÃ¢ng cáº¥p phÃ¢n há»‡, cáº­p nháº­t `USAGE_GUIDE_DRAFT.md`.
- Sau khi cáº­p nháº­t code vÃ  tÃ i liá»‡u, cháº¡y build/kiá»ƒm tra phÃ¹ há»£p.
- Commit vÃ  push lÃªn `main` Ä‘á»ƒ Vercel cÃ³ thá»ƒ deploy giao diá»‡n má»›i.
- Máº·c Ä‘á»‹nh push lÃªn GitHub sau khi hoÃ n táº¥t, khÃ´ng há»i láº¡i tá»«ng láº§n.

## 13. Kiá»ƒm Tra Gáº§n Nháº¥t

Láº§n kiá»ƒm tra gáº§n nháº¥t:

- Lá»‡nh: `npm.cmd run -s build`
- Káº¿t quáº£: build thÃ nh cÃ´ng.
- Cáº­p nháº­t gáº§n nháº¥t: tá»‘i Æ°u phÃ¢n há»‡ chat Ä‘á»ƒ giáº£m read quota Google Sheets khi gá»­i tin, bá» polling tá»± Ä‘á»™ng, giá»¯ lÆ°u tin nháº¯n vÃ o Google Sheet vÃ  UI unread trong phiÃªn Ä‘ang má»Ÿ.
- Commit phÃ¢n há»‡ giÃ¡o Ã¡n theo vai trÃ² Ä‘Ã£ push: `3695378 Split lesson plan views by role`


