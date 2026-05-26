# Hướng Dẫn Sử Dụng - Bản Nháp

Tài liệu này được cập nhật sau mỗi phân hệ để tổng hợp đầy đủ tính năng, quy trình thao tác thực tế và các điểm cần lưu ý. Nội dung sẽ được dùng làm nền tảng cho file hướng dẫn sử dụng chính thức sau này.

## 1. Phân Hệ Giao Lịch

### Tính năng hiện có
- Tạo lịch dạy theo lô: một lần gửi có thể tạo nhiều dòng lịch và giao cho nhiều giáo viên.
- Xem trước lịch sắp gửi trước khi tạo lịch chính thức.
- Tự động tạo luồng chat, thông báo và nhật ký thao tác khi gửi lịch.
- Gửi email tổng hợp theo từng giáo viên thay vì gửi rời từng lịch.
- Kiểm tra dữ liệu ở backend cho trường, lớp, khung giờ, giáo viên và bài học.
- Kiểm tra bài học phải đúng khối của lớp ở cả giao diện và backend.

### Quy trình thao tác trên mỗi dòng lịch
- Luồng mới mỗi dòng: khi giao lịch sẽ chọn `Trường -> Khối -> Lớp -> Khung giờ -> Bài học`.
- Khi đổi `Khối`, danh sách `Lớp` chỉ hiển thị các lớp thuộc khối đã chọn.
- Danh sách `Bài học` chỉ hiển thị các bài thuộc khối đã chọn.
- Nếu khối chưa có bài học đang hoạt động, hệ thống hiển thị cảnh báo rõ ngay trên dòng lịch.

### Lợi ích nghiệp vụ
- Giảm danh sách quá dài khi chọn lớp.
- Giảm sai sót khi chọn nhầm bài học khác khối.
- Giúp giáo vụ giao lịch nhanh hơn và dễ hướng dẫn người dùng mới hơn.

## 2. Phân Hệ Giáo Viên

### Tính năng hiện có
- Thêm giáo viên đơn lẻ với các thông tin: họ tên, email, số điện thoại, chuyên môn và quyền.
- Tự động tạo tài khoản `Users` liên kết với bản ghi `Teachers`.
- Đổi phân quyền giáo viên hoặc quản trị trực tiếp trên danh sách giáo viên.
- Sửa thông tin giáo viên trực tiếp trên từng dòng (họ tên, email, số điện thoại, chuyên môn).
- Bật/Tắt trạng thái hoạt động giáo viên ngay trên bảng quản lý.
- Xóa giáo viên (có kiểm tra ràng buộc dữ liệu lịch dạy liên quan).
- Tìm giáo viên nhanh ngay trên thanh tìm kiếm: gõ từ khóa sẽ lọc tức thời theo tên, email, số điện thoại hoặc chuyên môn.
- Danh sách giáo viên hiển thị dạng bảng ngang như Excel với các cột: `Tên giáo viên`, `Số điện thoại`, `Email`, `Phân quyền`.
- Nút `Thêm giáo viên` mở modal riêng để thêm thủ công hoặc import hàng loạt.

### Quy trình thêm giáo viên thủ công
- Từ màn hình `Giáo viên`, bấm `Thêm giáo viên`.
- Modal hiển thị các trường nhập: `Họ tên`, `Email Google`, `Số điện thoại`, `Chuyên môn`, `Quyền`.
- Người dùng điền thông tin và bấm `Lưu giáo viên`.
- Hệ thống tạo đồng thời bản ghi giáo viên và tài khoản đăng nhập liên kết.

### Quy trình import giáo viên bằng Excel
- Từ modal `Thêm giáo viên`, bấm `Tải mẫu Excel`.
- File mẫu có sẵn 2 dòng ví dụ: một dòng quyền `admin` và một dòng quyền `giáo viên`.
- Người dùng điền dữ liệu theo các cột bắt buộc: `Họ tên`, `Email Google`, `Số điện thoại`, `Chuyên môn`, `Quyền`.
- Người dùng bấm `Import file` để nạp file `.xlsx`, `.csv` hoặc `.tsv`.
- Import thành công sẽ tạo đồng thời bản ghi `Teachers` và tài khoản `Users`.

### Kiểm tra dữ liệu khi import
- Bắt buộc có họ tên và email hợp lệ.
- Quyền chỉ nhận `Giáo viên` hoặc `Quản trị`; hệ thống tự chuẩn hóa về `teacher` hoặc `admin`.
- Chặn email trùng trong cùng file import.
- Cảnh báo và bỏ qua các dòng có email đã tồn tại trong hệ thống.

### Ý nghĩa Bật/Tắt giáo viên
- `Bật`: giáo viên đang hoạt động, có thể được chọn để giao lịch mới.
- `Tắt`: giáo viên tạm ngưng, không mất dữ liệu lịch sử; hệ thống không cho chọn để giao lịch mới.
- Khi tắt, tài khoản `Users` liên kết cũng chuyển sang trạng thái không hoạt động.

## 3. Phân Hệ Khung Giờ

### Tính năng hiện có
- Khung giờ dạy đã được chuyển vào màn `Cấu hình` để quản trị cùng nhóm dữ liệu nền.
- Các khối trong màn `Cấu hình` mặc định thu gọn để xem tổng quan; bấm mũi tên để mở rộng khi cần chỉnh dữ liệu.
- Màn `Cấu hình` hiện giữ các khối vận hành cần dùng: `Thiết lập Trường và Lớp`, `Thêm lớp`, `Thiết lập Khung giờ dạy`.
- Thêm khung giờ thủ công với tên, giờ bắt đầu và giờ kết thúc.
- Danh sách khung giờ hiển thị dạng bảng với các cột: `Tên`, `Bắt đầu`, `Kết thúc`, `Số phút`, `Trạng thái`, `Thao tác`.
- Hệ thống tự tính thời lượng từ giờ bắt đầu/kết thúc và chỉ chấp nhận 45 phút hoặc 90 phút.
- Có sửa nhanh từng khung giờ ngay trên bảng.
- Có bật/tắt khung giờ; khung giờ bị tắt không còn hiện trong danh sách chọn khi giao lịch mới.
- Có chọn nhiều khung giờ rồi bật/tắt hàng loạt để thao tác nhanh.
- Có xóa mềm khung giờ bằng cách chuyển trạng thái sang `Tắt`, giữ an toàn cho lịch sử lịch dạy đã tạo.
- Có tải mẫu Excel và import hàng loạt khung giờ từ `.xlsx`, `.csv`, `.tsv`.

### Quy trình thao tác
- Vào tab `Cấu hình`.
- Bấm mũi tên tại từng khối để mở rộng hoặc thu gọn nội dung chi tiết.
- Tại khu vực `Thiết lập Khung giờ dạy`, nhập tên khung giờ, giờ bắt đầu và giờ kết thúc rồi bấm `Lưu khung giờ`.
- Để import nhanh, bấm `Tải mẫu Excel`, điền dữ liệu theo mẫu rồi bấm `Import file`.
- Dùng biểu tượng sửa để cập nhật tên hoặc giờ.
- Dùng biểu tượng bật/tắt để kiểm soát khung giờ nào được phép chọn khi giao lịch.
- Tick chọn nhiều dòng hoặc checkbox chọn tất cả, sau đó bấm `Bật đã chọn` hoặc `Tắt đã chọn`.
- Dùng biểu tượng xóa để xóa mềm khung giờ khỏi luồng giao lịch mới.

### Kiểm tra dữ liệu
- Bắt buộc có `Tên khung giờ`, `Giờ bắt đầu`, `Giờ kết thúc`, `Số phút` khi import.
- Giờ phải đúng định dạng `HH:mm`.
- Số phút chỉ được là `45` hoặc `90`.
- Số phút trong file phải khớp với chênh lệch giữa giờ bắt đầu và giờ kết thúc.
- Chặn khung giờ trùng tên hoặc trùng cặp giờ bắt đầu/kết thúc.

## 4. Phân Hệ Lịch Tổng

### Tính năng hiện có
- Hiển thị lịch tổng theo dạng lưới tháng, chia thành các ô theo từng ngày.
- Ngày hiện tại luôn được làm nổi bật để giáo vụ nhận diện nhanh.
- Mỗi ô ngày hiển thị số lượng lịch và bài học đại diện nếu ngày đó có lịch.
- Khi bấm vào một ngày, hệ thống mở danh sách chi tiết của ngày đó theo giao diện dòng lịch hiện tại.
- Ở chế độ tháng, ô ngày chỉ hiển thị nhãn số lịch và tên giáo viên để giữ lịch gọn, không hiển thị tên chuyên đề.
- Ngày không có lịch không hiển thị chữ `Trống`, giúp lưới tháng đỡ rối.
- Khi bấm một ô ngày, màn hình tự cuộn xuống vùng chi tiết của ngày đó.
- Khi bấm vào bất kỳ điểm nào trên dòng lịch chi tiết, hệ thống mở modal chi tiết lịch với đầy đủ trường/lớp/giáo viên/trạng thái/khung giờ.
- Mục tiêu bài học trong modal được tách dòng để giáo vụ đọc nhanh từng mục tiêu.
- Giao diện lịch sử dụng linh hoạt hai màu thương hiệu `#1992b0` và `#ff9500` để tạo điểm nhấn rõ hơn.
- Dòng lịch và modal chi tiết dùng nhiều nhóm màu theo ý nghĩa: trạng thái, điểm danh, khung giờ, trường và lớp được tô khác nhau để quét thông tin nhanh hơn.
- Có chế độ xem `Tháng`, `Tuần`, `Ngày`.
- Có bộ lọc nâng cao theo trạng thái, giáo viên, trường, lớp, khung giờ và khoảng ngày.
- Có sắp xếp theo ngày tăng dần, ngày giảm dần hoặc trạng thái; bộ lọc được ghi nhớ trên trình duyệt.
- Có thống kê nhanh tổng lịch, lịch chờ xác nhận, đã nhận, đã điểm danh và đã hủy.
- Có cảnh báo vận hành: lịch sắp dạy chưa xác nhận, lịch quá ngày chưa điểm danh và giáo viên có nhiều lịch hủy.
- Khi bấm vào thẻ cảnh báo vận hành, hệ thống mở modal liệt kê từng lịch liên quan với ngày dạy, giáo viên, lớp, trường và tên chuyên đề; bấm tiếp vào một dòng để xem đầy đủ chi tiết lịch.
- Có thao tác hàng loạt trong chi tiết ngày: chọn nhiều lịch để hủy, chuyển giáo viên hoặc gửi nhắc xác nhận.
- Có lịch sử thao tác trên từng lịch, đọc từ `AuditLogs` để xem ai đã tạo, xác nhận, hủy, chuyển hoặc điểm danh.
- Admin vẫn có thể hủy lịch hoặc chuyển lịch ngay trong danh sách chi tiết.
- Giáo viên chỉ thấy lịch của mình và có thể xác nhận lịch trong danh sách chi tiết.

### Quy trình thao tác
- Vào tab `Lịch tổng`.
- Dùng nút mũi tên để chuyển tháng hoặc bấm `Hôm nay` để quay lại tháng hiện tại.
- Chọn chế độ `Tháng`, `Tuần` hoặc `Ngày` tùy nhu cầu xem lịch.
- Dùng vùng lọc để thu hẹp danh sách lịch theo trạng thái, giáo viên, trường, lớp, khung giờ hoặc ngày.
- Bấm vào một ô ngày để xem toàn bộ lịch dạy trong ngày đó.
- Thực hiện thao tác chi tiết trên từng lịch trong phần danh sách bên dưới.
- Với quyền admin, có thể chọn nhiều lịch trong ngày để thao tác hàng loạt.

## 5. Ghi Chú Cập Nhật Tài Liệu

## 5. Phân Hệ Giáo Án

### Tính năng hiện có
- Màn giáo án đã tách trải nghiệm theo vai trò.
- Quản trị thấy `Tổng quan giáo án` với thống kê giáo án đã nộp, lịch đã có giáo án, lịch chưa có giáo án và lịch sắp dạy còn thiếu.
- Quản trị có thể bấm từng card thống kê để đổi nhanh danh sách bên dưới theo đúng nhóm dữ liệu.
- Quản trị có bảng giáo án mới nhất theo thời gian upload, kèm giáo viên, bài học, trường/lớp, ngày dạy và thao tác sửa/xóa.
- Quản trị có danh sách lịch chưa có giáo án để theo dõi và có thể tải lên thay khi cần.
- Quản trị có nút chat nhanh với giáo viên trên từng dòng giáo án/lịch để trao đổi về giáo án.
- Giáo viên thấy `Giáo án của tôi`, gồm nhóm lịch cần nộp giáo án và danh sách giáo án mới nhất của chính mình.
- Giáo viên có thể bấm card thống kê để mở danh sách giáo án đã gửi, lịch cần nộp hoặc lịch đã có giáo án.
- Giáo viên có thể tải nhiều file giáo án, mở file Google Drive, sửa tên hoặc xóa giáo án của mình.
- Các lịch dạy trong phân hệ giáo án hiển thị đủ ngày, tên khung giờ và giờ bắt đầu/kết thúc.

### Kiểm tra dữ liệu và phân quyền
- Teacher chỉ thấy lịch và giáo án thuộc tài khoản giáo viên của mình.
- Admin thấy toàn bộ dữ liệu giáo án và có quyền thao tác toàn hệ thống.
- File giáo án tối đa 10MB/file.
- Định dạng hỗ trợ: `pdf`, `doc`, `docx`, `ppt`, `pptx`, `xls`, `xlsx`, `txt`, `csv`.

## 6. Phân Hệ Điểm Danh

### Tính năng hiện có
- Teacher có màn `Điểm danh` theo từng tiết của chính mình.
- Mỗi tiết hiển thị chuyên đề, giáo viên, trường/lớp, giờ bắt đầu và giờ kết thúc.
- Khi teacher bấm `Điểm danh`, hệ thống lưu thời gian bấm vào tab `Attendance`, cập nhật lịch sang trạng thái `Đã điểm danh` và ghi lịch sử thao tác vào `AuditLogs`.
- Hệ thống chặn điểm danh trùng cho cùng một tiết.
- Hệ thống chặn điểm danh lịch đã hủy.
- Teacher chỉ được điểm danh lịch thuộc tài khoản giáo viên của mình.
- Admin có màn tổng quan điểm danh với các card: `Tiết hôm nay`, `Đã điểm danh hôm nay`, `Chưa điểm danh hôm nay`, `Điểm danh trễ hôm nay`.
- Admin bấm vào từng card để mở modal danh sách chi tiết tương ứng.
- Admin có cảnh báo giáo viên thường chưa điểm danh hoặc điểm danh trễ, tính từ dữ liệu lịch quá ngày.
- Admin có danh sách lịch sử điểm danh gần nhất để kiểm tra nhanh các lần bấm điểm danh mới.

### Rule điểm danh
- Cho phép điểm danh sớm tối đa 30 phút trước giờ bắt đầu tiết.
- Cho phép điểm danh muộn tối đa 90 phút sau giờ kết thúc tiết.
- Nếu thời gian điểm danh sau giờ bắt đầu tiết, hệ thống tính là điểm danh trễ và hiển thị số phút trễ trong danh sách admin.
- Giáo viên được đưa vào cảnh báo khi có từ 2 lần chưa điểm danh hoặc từ 2 lần điểm danh trễ trong dữ liệu lịch quá ngày.

### Quy trình thao tác
- Teacher vào tab `Điểm danh`, kiểm tra đúng tiết, giờ bắt đầu/kết thúc và bấm `Điểm danh`.
- Admin vào tab `Điểm danh` để xem tổng quan trong ngày.
- Admin bấm card `Chưa điểm danh hôm nay` để kiểm tra danh sách giáo viên chưa bấm.
- Admin bấm card `Điểm danh trễ hôm nay` để xem các tiết có điểm danh sau giờ bắt đầu.
- Admin dùng khối `Cảnh báo điểm danh` để theo dõi giáo viên có thói quen thiếu/trễ điểm danh.

## 7. Ghi Chú Cập Nhật Tài Liệu

Sau mỗi lần nâng cấp phân hệ, cần bổ sung vào tài liệu này:
- Danh sách tính năng mới.
- Quy trình thao tác thực tế cho người dùng.
- Các kiểm tra dữ liệu, cảnh báo hoặc giới hạn quan trọng.

### Quy trình làm việc bắt buộc (chốt phiên)
- Bước 1: Hoàn tất code + tự kiểm tra chạy ổn.
- Bước 2: Cập nhật `USAGE_GUIDE_DRAFT.md` cho đúng phân hệ vừa làm (tính năng, thao tác, lưu ý).
- Bước 3: Rà lại nhanh nội dung tài liệu để khớp hành vi thực tế trên UI/API.
- Bước 4: Mới được commit và push.

## 7. Cập Nhật Giao Diện Toàn Hệ Thống

- Font chữ hiển thị chính đã chuyển từ `Be Vietnam Pro` sang `Quicksand` để thử nghiệm thẩm mỹ mới cho toàn bộ ứng dụng.
- Đã tăng độ dày chữ mặc định toàn hệ thống thêm 1 mức (`font-weight: 500`) để cải thiện độ rõ khi hiển thị.
- Giao diện đã mở rộng bảng màu ngoài 2 màu thương hiệu, dùng thêm xanh lá, xanh dương, tím, hồng/đỏ và vàng hổ phách cho trạng thái và điểm nhấn.
- Các panel, sidebar, header, nút chính, input và toast được tăng hiệu ứng hover, bóng đổ, glass nhẹ và animation để hệ thống mềm mại hơn.
- Card, ô lọc và ô tìm kiếm có viền màu nổi bật hơn để dễ nhận diện vùng thao tác.
