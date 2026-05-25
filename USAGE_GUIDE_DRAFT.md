# Huong Dan Su Dung - Ban Nhap

Tai lieu nay duoc cap nhat sau moi phan he de tong hop tinh nang va quy trinh thao tac thuc te, phuc vu viet huong dan su dung chinh thuc sau nay.

## 1) Phan He Giao Lich

### Tinh nang hien co
- Tao lich day theo lo: mot lan gui co the tao nhieu dong lich va gui cho nhieu giao vien.
- Preview truoc khi gui: hien thi danh sach lich se tao.
- Tu dong tao Chat thread, Notification, Audit log khi gui lich.
- Gui email tong hop theo tung giao vien (khong gui roi tung lich).
- Kiem tra hop le backend cho truong, lop, khung gio, giao vien, bai hoc.
- Kiem tra khop khoi giua lop va bai hoc (backend + UI).

### Quy trinh thao tac moi moi dong
- Luong moi moi dong: khi giao lich se chon `Truong -> Khoi -> Lop -> Khung gio -> Bai hoc`.
- Khi doi `Khoi`: danh sach `Lop` duoc loc theo khoi da chon.
- Danh sach `Bai hoc` duoc loc theo khoi da chon.
- Neu khoi chua co bai hoc hoat dong: hien canh bao ro ngay tren dong lich.

### Loi ich nghiep vu
- Giam danh sach qua dai khi chon lop.
- Giam sai bai hoc khac khoi.
- Toc do giao lich nhanh hon va de dao tao nguoi dung moi.

## 2) Phan He Giao Vien

### Tinh nang hien co
- Them giao vien don le (ho ten, email, so dien thoai, chuyen mon, quyen).
- Tu dong tao tai khoan `Users` lien ket voi `Teachers`.
- Doi phan quyen giao vien/quan tri truc tiep tren danh sach giao vien.
- Danh sach giao vien hien dang bang ngang nhu Excel voi cac cot: `Ten giao vien`, `So dien thoai`, `Email`, `Phan quyen`.
- Nut `Them giao vien` mo modal rieng de them thu cong hoac import hang loat.

### Quy trinh them giao vien
- Tu man hinh `Giao vien`, bam `Them giao vien`.
- Modal hien cac truong nhap thu cong: `Ho ten`, `Email Google`, `So dien thoai`, `Chuyen mon`, `Quyen`.
- Nguoi dung co the bam `Luu giao vien` de them mot giao vien.
- Nguoi dung co the tai file mau va import hang loat ngay trong modal.

### Tinh nang import nhanh bang Excel
- Co nut `Tai mau Excel` de tai file mau.
- File mau co 2 dong vi du san: mot dong quyen `admin` va mot dong quyen `giao vien`.
- Co nut `Import file` de nap `.xlsx/.csv/.tsv`.
- Cot mau bat buoc: `Ho ten`, `Email Google`, `So dien thoai`, `Chuyen mon`, `Quyen`.
- He thong validate du lieu truoc khi ghi:
  - Bat buoc co ho ten + email hop le.
  - Quyen chi nhan `Giao vien` hoac `Quan tri` (tu dong normalize).
  - Chan email trung trong file.
  - Canh bao va bo qua email da ton tai trong he thong.
- Import thanh cong se tao dong thoi ban ghi `Teachers` va `Users`.

### Ghi chu tiep tuc cap nhat
- Sau moi lan nang cap phan he, bo sung vao tai lieu nay:
  - Danh sach tinh nang moi.
  - Quy trinh thao tac thuc te cho nguoi dung.
  - Cac canh bao/validate quan trong.
