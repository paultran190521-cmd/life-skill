# Thử hiệu ứng thẻ Tổng quan

- Chỉ nhóm thống kê chính: admin 4 thẻ, trợ giảng 4 thẻ, giáo viên 6 thẻ. Không áp dụng vào thẻ theo môi trường, lịch, giáo án, điểm danh hoặc form.
- Nền vàng/xanh nhẹ; sáng quét một lượt khi hover; nghiêng tối đa ±2 độ, nâng 2 px. Không giảm độ rõ của thẻ khác, không vòng lặp animation, không thêm dependency.
- Giữ nguyên component Stat, số liệu, callback và ngữ nghĩa button/div. Thêm focus-visible cho thẻ có thao tác.
- Một handler pointermove ủy nhiệm mỗi grid; tối đa một requestAnimationFrame chờ, đo bounds khi đổi thẻ. Reset khi cuộn, đổi kích thước, ẩn tab, đổi media preference, rời thẻ hoặc unmount.
- Touch/coarse/no-hover/reduced-motion tắt chuyển động. CSS scoped thay hover cũ và bỏ backdrop blur cho nhóm thử nghiệm. Không thay CSS nghiệp vụ ngoài nhóm.
- Test menu: 16 tổ hợp nội dung không đổi. Test spotlight giả lập: 100 pointer events → 1 frame, góc giới hạn, không React state, các guard và cleanup đều đạt. TypeScript đạt.
- Chưa đo FPS/INP hay kiểm tra trực quan trên điện thoại thật. Chưa push/deploy do chặn quyền từ bước trước; GAS không thay đổi trong đợt này.

Kiểm tra thủ công trước khi phát hành: hover từng góc, di chuột qua khoảng trống, cuộn/rời menu, bấm thẻ giáo viên mở đúng danh sách, Tab/Enter và focus ring, touch không nghiêng, bật giảm chuyển động, kiểm tra không tràn ngang hoặc cắt chữ.
