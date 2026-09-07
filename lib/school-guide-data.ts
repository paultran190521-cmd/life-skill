import type { SchoolGuideResponse } from "./school-guide-types";

// Dữ liệu được chuẩn hóa từ tài liệu "THÔNG TIN CÁC TRƯỜNG" và danh sách
// địa điểm năm học 2026 - 2027. Giữ ở phía máy chủ để thông tin nội bộ không
// bị đóng gói trực tiếp vào mã JavaScript gửi cho người chưa đăng nhập.
export const schoolGuide: SchoolGuideResponse = {
  schoolYear: "2026 - 2027",
  schools: [
    {
      id: "thcs-chi-lang",
      name: "Chi Lăng",
      schoolType: "Trường THCS",
      imageUrl: "/school-guide/chi-lang-cover.webp",
      address: "129/63A Nguyễn Hữu Hào, Khánh Hội, TP.HCM",
      mapUrl: "https://maps.app.goo.gl/7XKWqxcwTx7E4zzW8",
      distanceFromMettasoul: "9 km",
      partnershipYears: 4,
      teachingGrades: "Khối 6",
      coordinationNote:
        "Ban Giám hiệu tin tưởng, thấu hiểu và tạo điều kiện tốt để METTASOUL phối hợp cùng nhà trường.",
      studentProfile:
        "Học sinh lớp 6 còn nhiều bỡ ngỡ khi chuyển cấp. Phụ huynh khá bận rộn và có xu hướng gửi gắm việc đồng hành cùng con cho nhà trường.",
      leaders: [
        { role: "Hiệu trưởng", name: "Thầy Lê Ngọc Hải", imageUrl: "/school-guide/chi-lang-le-ngoc-hai.webp" },
        { role: "Hiệu phó", name: "Cô Lâm Thị Thanh Thúy", imageUrl: "/school-guide/chi-lang-lam-thi-thanh-thuy.webp" },
        { role: "Hiệu phó", name: "Thầy Bùi Văn Tài", imageUrl: "/school-guide/chi-lang-bui-van-tai.webp" },
      ],
    },
    {
      id: "nam-sai-gon",
      name: "Nam Sài Gòn",
      schoolType: "Trường TH - THCS - THPT",
      imageUrl: "/school-guide/nam-sai-gon-cover.webp",
      address: "Khu A Đô thị mới Nam Sài Gòn, Phường Tân Mỹ, TP.HCM",
      mapUrl: "https://maps.app.goo.gl/tzDXpHDeQPx4k2hs8",
      distanceFromMettasoul: "10 km",
      partnershipYears: 16,
      teachingGrades: "Khối 1, 2, 3, 6, 7, 8",
      coordinationNote:
        "Ban Giám hiệu tin tưởng và linh hoạt; việc chủ động phối hợp sẽ giúp các buổi học Kỹ năng sống đạt hiệu quả tốt.",
      studentProfile:
        "Học sinh có tư duy phản biện tốt, đề cao tính dân chủ và giàu tình cảm. Giáo viên nên chủ động lắng nghe, kết nối và thấu hiểu để tạo sự cởi mở.",
      leaders: [
        { role: "Hiệu trưởng", name: "Thầy Trần Nghĩa Nhân", imageUrl: "/school-guide/nam-sai-gon-tran-nghia-nhan.webp" },
        { role: "Hiệu phó chuyên môn", name: "Thầy Triệu Tấn Mẫn", imageUrl: "/school-guide/nam-sai-gon-trieu-tan-man.webp" },
        { role: "Hiệu phó năng khiếu", name: "Cô Nguyễn Thị Ngọc Diệp", imageUrl: "/school-guide/nam-sai-gon-nguyen-thi-ngoc-diep.webp" },
        { role: "Hiệu phó tiểu học", name: "Thầy Nguyễn Minh Thiên Hoàng", imageUrl: "/school-guide/nam-sai-gon-nguyen-minh-thien-hoang.webp" },
      ],
    },
    {
      id: "thpt-nguyen-thi-minh-khai",
      name: "Nguyễn Thị Minh Khai",
      schoolType: "Trường THPT",
      imageUrl: "/school-guide/nguyen-thi-minh-khai-cover.webp",
      address: "275 Điện Biên Phủ, Phường Xuân Hòa, TP.HCM",
      mapUrl: "https://share.google/xMoydZsneA0js7Go4",
      distanceFromMettasoul: "9 km",
      partnershipYears: 7,
      teachingGrades: "Khối 10, 11",
      coordinationNote:
        "Ban Giám hiệu tạo điều kiện thuận lợi, đồng thời sát sao và lắng nghe phản hồi từ học sinh, phụ huynh để nâng cao chất lượng chương trình.",
      studentProfile:
        "Học sinh có nền tảng đầu vào tốt, thông minh, sáng tạo, tư duy phản biện cao và chủ động thể hiện quan điểm cá nhân.",
      leaders: [
        { role: "Hiệu trưởng", name: "Cô Nguyễn Thị Hồng Chương", imageUrl: "/school-guide/nguyen-thi-minh-khai-nguyen-thi-hong-chuong.webp" },
        { role: "Hiệu phó", name: "Thầy Trần Văn Thoa", imageUrl: "/school-guide/nguyen-thi-minh-khai-tran-van-thoa.webp" },
        { role: "Hiệu phó", name: "Thầy Nguyễn Văn Ba", imageUrl: "/school-guide/nguyen-thi-minh-khai-nguyen-van-ba.webp" },
      ],
    },
    {
      id: "thpt-duong-van-thi",
      name: "Dương Văn Thì",
      schoolType: "Trường THPT",
      imageUrl: "/school-guide/duong-van-thi-cover.webp",
      address: "161 Đường Lã Xuân Oai, Phường Tăng Nhơn Phú, TP.HCM",
      mapUrl: "https://maps.app.goo.gl/z9x1pk2KftJRT5tw8",
      distanceFromMettasoul: "8,8 km",
      partnershipYears: 5,
      teachingGrades: "Khối 10, 11, 12",
      coordinationNote:
        "Ban Giám hiệu làm việc dứt khoát, chú trọng chuyên môn và theo sát chất lượng từng tiết học. Nhà trường nghiêm cấm dùng điện thoại trong giờ và có camera tại các lớp.",
      studentProfile:
        "Học sinh năng động, ngoan ngoãn, hợp tác tốt và đã có sự gắn kết, nhiều thiện cảm với giáo viên Kỹ năng sống.",
      leaders: [
        { role: "Hiệu trưởng", name: "Cô Lê Tường Quyên", imageUrl: "/school-guide/duong-van-thi-le-tuong-quyen.webp" },
        { role: "Hiệu phó", name: "Cô Phạm Thị Tỉnh", imageUrl: "/school-guide/duong-van-thi-pham-thi-tinh.webp" },
        { role: "Hiệu phó", name: "Cô Nguyễn Thị Hà", imageUrl: "/school-guide/duong-van-thi-nguyen-thi-ha.webp" },
      ],
    },
    {
      id: "thpt-thu-duc",
      name: "Thủ Đức",
      schoolType: "Trường THPT",
      imageUrl: "/school-guide/thu-duc-cover.webp",
      address: "166/24 Đặng Văn Bi, Phường Thủ Đức, TP.HCM",
      mapUrl: "https://share.google/UfRhjN6gSOztn8WSU",
      distanceFromMettasoul: "7,5 km",
      partnershipYears: 2,
      teachingGrades: "Khối 10, 11, 12",
      coordinationNote:
        "Nhà trường có Hiệu trưởng mới, tác phong dứt khoát, chú trọng chuyên môn và tâm huyết. Ban Giám hiệu tạo điều kiện nhưng theo sát chất lượng từng tiết dạy.",
      studentProfile:
        "Học sinh có nền tảng đầu vào tốt, thông minh, sáng tạo, tư duy phản biện cao và chủ động thể hiện quan điểm cá nhân.",
      leaders: [
        { role: "Hiệu trưởng", name: "Cô Nguyễn Thị Thanh Trúc", imageUrl: "/school-guide/thu-duc-nguyen-thi-thanh-truc.webp" },
        { role: "Hiệu phó", name: "Thầy Võ Thanh Toàn", imageUrl: "/school-guide/thu-duc-vo-thanh-toan.webp" },
        { role: "Hiệu phó", name: "Thầy Đỗ Vũ Ngọc Trung", imageUrl: "/school-guide/thu-duc-do-vu-ngoc-trung.webp" },
      ],
    },
    {
      id: "thpt-phong-phu",
      name: "Phong Phú",
      schoolType: "Trường THPT",
      imageUrl: "/school-guide/phong-phu-cover.webp",
      address: "Số 2 đường số 14B, KDC số 4, Xã Bình Hưng, TP.HCM",
      mapUrl: "https://maps.app.goo.gl/KfcXRdRH6FbdPQ5PA",
      distanceFromMettasoul: "14 km",
      partnershipYears: 5,
      teachingGrades: "Khối 10",
      coordinationNote:
        "Nhà trường có Hiệu trưởng mới, làm việc dứt khoát, đề cao chuyên môn. Ban Giám hiệu cởi mở và tạo điều kiện cho đơn vị đồng hành.",
      studentProfile:
        "Mặt bằng điểm đầu vào chưa cao; quãng đường xa và lịch học sáng Thứ 7 khiến một số học sinh thiếu tự giác. Giáo viên cần tăng tương tác và động lực học tập.",
      leaders: [
        { role: "Hiệu trưởng", name: "Thầy Đoàn Nhật Quang", imageUrl: "/school-guide/phong-phu-doan-nhat-quang.webp" },
        { role: "Hiệu phó", name: "Thầy Phạm Văn Thiện", imageUrl: "/school-guide/phong-phu-pham-van-thien.webp" },
        { role: "Hiệu phó", name: "Thầy Lê Viết Cang", imageUrl: "/school-guide/phong-phu-le-viet-cang.webp" },
      ],
    },
    {
      id: "thpt-tan-tuc",
      name: "Tân Túc",
      schoolType: "Trường THPT",
      imageUrl: "/school-guide/tan-tuc-cover.webp",
      address: "C1/3K Đường Bùi Thanh Khiết, Ấp 59, Xã Tân Nhựt, TP.HCM",
      mapUrl: "https://maps.app.goo.gl/T8MVZPhVfnYVibFd8",
      distanceFromMettasoul: "20 km",
      partnershipYears: 4,
      teachingGrades: "Khối 10",
      coordinationNote:
        "Nhà trường đề cao tác phong, thái độ và chuẩn mực sư phạm; đồng thời theo sát chuyên môn và coi trọng phản hồi của học sinh, phụ huynh.",
      studentProfile:
        "Học sinh cá tính, tiếp thu ở mức cơ bản và thích trải nghiệm thực tế. Giáo viên nên linh hoạt phương pháp, tăng thực hành và tương tác.",
      leaders: [
        { role: "Hiệu trưởng", name: "Thầy Nguyễn Thanh Tòng", imageUrl: "/school-guide/tan-tuc-nguyen-thanh-tong.webp" },
        { role: "Hiệu phó", name: "Thầy Nguyễn Văn Dũng", imageUrl: "/school-guide/tan-tuc-nguyen-van-dung.webp" },
        { role: "Hiệu phó", name: "Thầy Nguyễn Phi Hùng", imageUrl: "/school-guide/tan-tuc-nguyen-phi-hung.webp" },
        { role: "Hiệu phó", name: "Thầy Nguyễn Trang Hoàng", imageUrl: "/school-guide/tan-tuc-nguyen-trang-hoang.webp" },
      ],
    },
    {
      id: "ptnk-tdtt-binh-chanh",
      name: "TDTT Bình Chánh",
      schoolType: "Phổ thông Năng khiếu",
      imageUrl: "/school-guide/tdtt-binh-chanh-cover.webp",
      address: "A10/3D Mai Bá Hương, Ấp 3, Bình Lợi, TP.HCM",
      mapUrl: "https://maps.app.goo.gl/tD64uDgXvpU54q3m6",
      distanceFromMettasoul: "23 km",
      partnershipYears: 6,
      teachingGrades: "Khối 6, 7, 10, 11",
      coordinationNote:
        "Ban Giám hiệu năng nổ, làm việc nhanh và hỗ trợ đơn vị. Giáo viên cần lưu ý quy định nghiêm cấm sử dụng điện thoại trong lớp.",
      studentProfile:
        "Học sinh thân thiện, chân thật nhưng chịu nhiều áp lực và vận động thể thao nhiều. Giáo viên cần khéo léo, bình tĩnh và kiên nhẫn khi đồng hành.",
      leaders: [
        { role: "Hiệu trưởng", name: "Thầy Dương Hoài Bảo", imageUrl: "/school-guide/tdtt-binh-chanh-duong-hoai-bao.webp" },
        { role: "Hiệu phó", name: "Cô Trần Thị Huyền Trang", imageUrl: "/school-guide/tdtt-binh-chanh-tran-thi-huyen-trang.webp" },
        { role: "Hiệu phó", name: "Cô Bùi Thị Huyền Trang", imageUrl: "/school-guide/tdtt-binh-chanh-bui-thi-huyen-trang.webp" },
      ],
    },
  ],
};

export function schoolGuideMapUrlForName(schoolName: string) {
  const key = schoolNameKey(schoolName);
  if (!key) {
    return undefined;
  }
  return schoolGuide.schools.find((school) => {
    const guideKey = schoolNameKey(school.name);
    return key === guideKey || key.endsWith(guideKey) || guideKey.endsWith(key);
  })?.mapUrl;
}

function schoolNameKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\b(pho thong nang khieu|trung hoc pho thong|trung hoc co so|tieu hoc|truong|thpt|thcs|th)\b/g, "")
    .replace(/[^a-z0-9]+/g, "");
}
