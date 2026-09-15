# Rà soát và tối ưu hiệu năng METTASOUL — 15/09/2026

## Phạm vi và kết quả

Rà soát 9 menu, đường tải `/api/app-data`, cẩm nang trường, các tác vụ làm mới nền và phần hiển thị dùng chung. Bản mã tối ưu: `f96507a`.

Các thay đổi đã triển khai trong mã:

- Chuyển 30 chỗ sử dụng component khai báo bên trong component cha sang hàm dựng giao diện không chứa hook. React có thể cập nhật các phần tử hiện có thay vì tháo và tạo lại cả khối. 26 hàm dựng giao diện có kiểm tra tự động ngăn hook chạy có điều kiện và ngăn tái xuất hiện kiểu component không ổn định.
- Tạo chỉ mục được ghi nhớ cho giáo viên, trường, lớp, bài học, khung giờ, lịch; nhóm giáo án theo lịch và điểm danh theo cặp lịch/người tham gia. Chỉ tạo lại khi danh sách nguồn tương ứng đổi. Giữ cách chọn bản ghi đầu tiên khi dữ liệu cũ có ID trùng.
- Tra đồng giảng theo nhóm, giữ quy tắc nhóm cũ và loại lịch hủy; lưu thứ tự giáo án mới nhất khi tạo chỉ mục.
- Tái sử dụng bộ định dạng ngày tiếng Việt, giữ xử lý ngày lỗi an toàn.
- Phân trang thư viện bài học 24 bài/trang; danh sách giáo viên và danh sách lịch dùng chung 30 dòng/trang. Tìm kiếm, tổng số, lựa chọn hàng loạt và xuất Excel vẫn dựa trên toàn bộ danh sách đã lọc.
- Cẩm nang trường tách thành phần mã tải khi cần; lưu trong bộ nhớ tối đa 5 phút theo người dùng/vai trò, hủy yêu cầu khi rời menu. Quay lại trong thời hạn không tải lại. Sau thời hạn, hiển thị bản đang có trong lúc làm mới; F5 để tải mới ngay. Không lưu dữ liệu này xuống localStorage.
- Mục Cấu hình đang thu gọn không dựng nội dung JSX bên trong. Bỏ lớp làm mờ nền trên các Panel lớn; giữ hiệu ứng chuyển menu và nút.
- Tìm kiếm giáo viên/lịch/bài học dùng giá trị trì hoãn của React. Tác vụ tổng hợp chat bỏ qua lần cập nhật định kỳ khi tab ẩn/mất focus, tránh yêu cầu chồng nhau và không cập nhật state khi kết quả không đổi.
- API tải dữ liệu chuyển phép tìm lịch được phân công sang Set; giữ nguyên điều kiện xác thực và phạm vi giáo viên/trợ giảng.

## Đánh giá từng menu

| Menu | Điểm gây tốn công xử lý | Cải tiến trong đợt này | Bước tiếp theo nên ưu tiên |
|---|---|---|---|
| Tổng quan | Tra metadata và giáo án lặp lại cho mỗi dòng; các khối giáo viên/trợ giảng bị tạo lại khi cha cập nhật | Chỉ mục dùng chung, định dạng ngày tái sử dụng, cây hiển thị ổn định | Tách thống kê thành component riêng với dữ liệu đầu vào hẹp; đo khi có lịch nhiều tháng |
| Giao lịch | Báo cáo lịch đã gửi dựng toàn bộ dòng; component con bị tạo lại khi nhập cập nhật tuần | Báo cáo 30 dòng/trang, ghi nhớ lọc/sắp xếp báo cáo, tra nhanh giáo viên/trường/lớp, giữ phần tử nhập liệu | Tách form giao lịch và lịch trống; đo riêng kiểm tra xung đột với nhiều dòng nháp. Luôn giữ kiểm tra cuối ở server |
| Lịch tổng | Mỗi dòng tra nhiều danh sách; danh sách trong ngày lớn gây nhiều phần tử | Tra metadata/đồng giảng/điểm danh qua chỉ mục; 30 dòng/trang; tìm kiếm trì hoãn. Giữ cách gom lịch theo ngày đã có | Tải lịch theo khoảng ngày khi dữ liệu tích lũy lớn; vẫn cần dữ liệu phục vụ kiểm tra xung đột ở server |
| Giáo viên | Dựng toàn bộ bảng và lọc ngay theo mỗi ký tự | 30 dòng/trang; trì hoãn lọc để ưu tiên nhập; giữ bản nháp sửa ở cha | Tách bảng khỏi trạng thái menu khác; tra user theo teacherId bằng chỉ mục nếu tài khoản tăng nhiều |
| Bài học | Website thực tế dựng 180 thẻ cùng lúc; mỗi thẻ có mô tả dài | 24 bài/trang; tìm kiếm trên tất cả bài; đổi bộ lọc về trang đầu | Tách mã nhập Excel/form hàng loạt khỏi thư viện; đo riêng nhập tệp lớn trước khi cân nhắc Web Worker |
| Giáo án | Lặp quét và sắp xếp giáo án cho mỗi lịch; tạo lại ô nhập liên kết; cập nhật chat không đổi vẫn dựng lại | Nhóm giáo án được sắp xếp một lần; tra lịch nhanh; giữ DOM ô nhập; giảm làm mới nền | Phân trang lịch sử tệp/chat theo server khi dữ liệu lớn; tải hội thoại khi mở một giáo án |
| Điểm danh | Liên kết lịch/người tham gia bằng nhiều phép find trong vòng lặp | Chỉ mục lịch và cặp lịch/người; giữ đúng điểm danh giáo viên/trợ giảng | Tách thống kê theo ngày và bộ lọc; tải lịch sử theo khoảng ngày thay vì toàn bộ |
| Cấu hình | JSX danh sách trường/lớp/khung giờ vẫn được tạo dù Panel thu gọn | Chỉ dựng nội dung phần đang mở; giảm lớp làm mờ Panel; tra nhãn trường/lớp nhanh | Tải nhật ký/observability theo nhu cầu và lưu kết quả ngắn hạn kèm nút làm mới |
| Thông tin trường | Tải mã cùng ứng dụng, tải lại dữ liệu mỗi lần quay lại | Tải mã theo nhu cầu, cache 5 phút theo người/vai trò, hủy request cũ, memo component | Nếu cẩm nang tăng nhiều ảnh: đo ảnh theo thiết bị, đặt kích thước và tối ưu định dạng ảnh |

## Bằng chứng kiểm tra

- `npm run build`: đạt; TypeScript và 31/31 trang tĩnh hoàn tất.
- 10 nhóm kiểm thử hiện có đạt: phân quyền (32 route), nhóm điểm danh, trợ giảng, bài học, tiến trình tiết 1 trong 2 tháng, xung đột lịch, xóa dây chuyền, phạm vi tham gia, lịch trống, gom lượt đọc Sheets.
- `npm run test:menu-performance`: đạt. So sánh trực tiếp hàm cũ từ commit `641f693` và hàm mới trên dữ liệu giả lập; kiểm tra đủ vai trò admin/giáo viên/trợ giảng, bản ghi không tồn tại, thứ tự giáo án, lịch hủy và nhóm đồng giảng.
- 16 tổ hợp menu/vai trò dựng bằng React với dữ liệu giả lập nhỏ: nội dung chữ khớp bản trước. Bài kiểm thử không truy cập mạng hay ghi dữ liệu thật.
- 3.000 lịch + 6.000 giáo án + 6.000 bản ghi điểm danh: trung vị 5 lần tra toàn bộ dữ liệu giảm từ khoảng **248 ms xuống 4,4 ms**; tạo chỉ mục khoảng **18 ms**. Đây là phép đo CPU tại máy, không phải tốc độ chuyển menu hay tốc độ mạng production.
- 1.000 lần định dạng ngày cùng kiểu chỉ tạo **1** `Intl.DateTimeFormat`, thay vì 1.000 đối tượng.
- Trước triển khai: menu Bài học production có **180** nút sửa bài, tổng **4.019** phần tử DOM. Số đo DOM là cấu trúc giao diện, không phải chỉ số FPS hoặc INP.

## Kiểm chứng production sau triển khai

Đã mở bản mới tại https://giaovukns.mettasoul.vn/ sau khi push `f96507a`.

- Thư viện bài học: **24** thẻ, **906** phần tử DOM ở trang đầu (giảm khoảng **77,5%** phần tử so với trước). Trang sau hiển thị 25–48/180.
- Tìm `cảm xúc`: kết quả 31/180 bài trên toàn bộ thư viện, phân trang về trang đầu, ô tìm kiếm giữ focus. Xóa từ khóa bằng bàn phím trở lại 1–24/180.
- Giao lịch: nhập liên tục `Kiem tra do muot` vào ghi chú cập nhật tuần, đủ ký tự và giữ focus. Đã xóa ghi chú thử; không bấm lưu/gửi.
- Mở đủ 9 menu admin; kiểm tra mở/thu phần Thêm lớp trong Cấu hình.
- Dùng bộ chuyển vai trò trong phiên admin để kiểm tra Tổng quan, Lịch, Giáo án, Điểm danh của giáo viên và trợ giảng. Đây là kiểm tra giao diện theo vai trò, không phải hai phiên đăng nhập độc lập.
- Cẩm nang lần đầu tải đủ dữ liệu; quay lại thấy nội dung và không thấy trạng thái tải. Công cụ trình duyệt không cung cấp bộ đếm network resource nên không ghi nhận số request thực tế.
- Cuộn xuống cuối cẩm nang: sidebar có tọa độ trên bằng 0, toàn bộ nút menu còn trong viewport. Không tái xuất hiện lỗi sidebar trôi theo trang.
- Kiểm tra viewport **390 × 844**: các nút phân trang, thẻ bài học và menu di động hiển thị đúng. Đã khôi phục kích thước trình duyệt sau kiểm tra.
- Không ghi nhận lỗi console JavaScript của trang trong các thao tác đã kiểm tra. Công cụ điều khiển có một số timeout thao tác chuột; đã đối chiếu trạng thái và kiểm tra tiếp bằng bàn phím. Chưa đo được INP, FPS hoặc thời gian chuyển menu với độ trễ mạng được kiểm soát.

## Checklist tự kiểm tra nhanh

- [ ] Cuộn sâu, chuyển qua các menu; sidebar desktop vẫn hiển thị đủ nút.
- [ ] Bài học: bấm Sau/Trước, tìm một từ khóa và đổi khối; số kết quả đầy đủ và trang đầu được đặt lại.
- [ ] Giáo viên: nhập vào bản nháp sửa, bảo đảm con trỏ không bị mất; hủy bản nháp nếu chỉ kiểm tra.
- [ ] Giao lịch: nhập ghi chú cập nhật tuần; nếu chỉ thử thì xóa nội dung và không gửi lịch.
- [ ] Giáo án: nhập liên kết vào bản nháp, bảo đảm giữ focus; không lưu nếu chỉ kiểm tra.
- [ ] Cấu hình: mở/thu từng mục trường, lớp, khung giờ.
- [ ] Thông tin trường: quay lại trong vòng 5 phút, thấy dữ liệu ngay; F5 nếu cần lấy mới ngay.
- [ ] Khi chọn hàng loạt hoặc xuất Excel, đối chiếu tổng danh sách đã lọc: thao tác vẫn áp dụng toàn bộ kết quả, không chỉ trang đang nhìn thấy.

## Hướng tối ưu tiếp theo

1. **Tách trạng thái và mã theo từng menu.** File ứng dụng vẫn lớn; các hàm render hiện ổn định DOM nhưng vẫn chạy trong component cha. Tách từng menu thành component cấp module, truyền props hẹp, dùng memo ở ranh giới có ích. Làm từng menu và so sánh hành vi trước/sau; ưu tiên Giao lịch → Giáo án → Cấu hình.
2. **Tách tải dữ liệu ban đầu theo nhu cầu.** `/api/app-data` vẫn tải nhiều bảng Sheets. Giữ dữ liệu danh mục dùng chung, còn lịch/giáo án/điểm danh/nhật ký tải theo menu và khoảng ngày. Thiết kế rõ việc làm mới sau ghi, vô hiệu hóa cache, phạm vi vai trò và kiểm tra xung đột ở server trước khi thay đổi.
3. **Đo thời gian tương tác thực tế trước khi đầu tư thêm.** Thu thập INP, thời gian chờ API và tác vụ JavaScript dài trên điện thoại cấu hình thấp và dữ liệu nhiều tháng. Không suy diễn số đo tra cứu CPU thành phần trăm tăng tốc toàn website.

Chưa bổ sung thư viện hiệu ứng, thư viện phân trang hoặc dịch vụ đo lường bên ngoài. Các thay đổi GAS/webhook không thuộc bản này.

## Cơ sở kỹ thuật

- React giữ trạng thái theo vị trí và loại component trong cây giao diện: [Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state).
- Next.js hỗ trợ tải component theo nhu cầu: [Lazy Loading](https://nextjs.org/docs/app/guides/lazy-loading).
- React cho phép ưu tiên thao tác nhập khi cập nhật kết quả nặng: [useDeferredValue](https://react.dev/reference/react/useDeferredValue). Hiệu quả đầy đủ còn phụ thuộc ranh giới component và mức giảm công việc dựng giao diện.
# Bổ sung: giáo án trên điện thoại và menu gọn (15/09/2026)

- Sidebar giới hạn chiều cao theo số mục (48px/mục, gồm khoảng cách), thay vì chia 432px cho cả vai trò chỉ có 5 mục. Giữ cơ chế fixed và co theo chiều cao màn hình hiện có.
- Thẻ giáo án co đúng cột; tên tệp dài được xuống dòng; nhóm phản hồi/sửa/xóa tự bọc; ô link dùng cột minmax(0,1fr). Không che nội dung bằng overflow-x:hidden.
- Giáo viên/trợ giảng dựng tối đa 12 thẻ chuyên đề/trang; các danh sách trạng thái giáo viên tối đa 30 dòng/trang. Tổng số vẫn tính trên toàn bộ dữ liệu.
- Tách LessonPlanLinkForm: gõ link chỉ cập nhật component nhỏ; nháp nằm trong ref theo tài khoản+lịch, giữ khi chuyển menu/trang; thất bại giữ nháp; thành công mới xóa; chặn bấm lưu kép.
- Không thêm thư viện animation hoặc dependency. Không thay đổi quyền trợ giảng, API ghi, GAS, dữ liệu trường/lớp hay quy tắc trùng lịch.
- Kiểm thử: 16 tổ hợp vai trò/menu giữ nguyên nội dung; kiểm thử link form (khôi phục nháp, cách ly tài khoản, thành công/thất bại, chống gửi kép); TypeScript và production build đạt.
- Chưa triển khai việc chia bootstrap theo miền dữ liệu/khoảng ngày hay tách toàn bộ state từng menu. Đây vẫn là phần tiếp theo của kế hoạch, cần endpoint tổng hợp thống kê và giữ đủ lịch sử kiểm tra trùng lịch ở server; không được thay bằng việc cắt bớt mảng schedules đang dùng chung.
- Production: commit d98aad9, deployment FEK79Pb5ckQH9N7aMqBAvqYXGtZA Ready/Current, build Vercel 55 giây. Đã kiểm tra trên giaovukns.mettasoul.vn bằng chức năng admin chuyển góc nhìn giáo viên/trợ giảng (không phải đăng nhập độc lập hai tài khoản).
- Browser: menu giáo viên 432px/5 hàng ~83px trước sửa, 240px/5 hàng ~45px sau sửa; trợ giảng 240px. Khung viewport 390px và 320px: scrollWidth bằng clientWidth ở menu giáo án, đã xem screenshot; nháp giữ khi chuyển menu, đã xóa nháp thử không bấm lưu. Thu/mở sidebar đạt. Lượt kiểm tra console không có lỗi; chưa đo INP/FPS hay Safari trên iPhone thật.
