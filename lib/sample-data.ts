import type {
  Attendance,
  ClassRoom,
  Lesson,
  LessonPlan,
  Notification,
  Schedule,
  School,
  Teacher,
  TimeSlot,
  User,
} from "@/lib/types";

export const users: User[] = [
  {
    id: "u-admin",
    name: "Giao vu Life Skill",
    email: "admin@lifeskill.edu.vn",
    role: "admin",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80",
  },
  {
    id: "u-t1",
    name: "Co Minh Anh",
    email: "minhanh@lifeskill.edu.vn",
    role: "teacher",
    teacherId: "t1",
    avatarUrl: "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=160&q=80",
  },
];

export const teachers: Teacher[] = [
  {
    id: "t1",
    name: "Co Minh Anh",
    email: "minhanh@lifeskill.edu.vn",
    phone: "090 118 2233",
    avatarUrl: "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=160&q=80",
    specialty: "Ky nang giao tiep",
    active: true,
  },
  {
    id: "t2",
    name: "Thay Quoc Bao",
    email: "quocbao@lifeskill.edu.vn",
    phone: "091 778 8899",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80",
    specialty: "Lam viec nhom",
    active: true,
  },
  {
    id: "t3",
    name: "Co Thanh Tam",
    email: "thanhtam@lifeskill.edu.vn",
    phone: "093 245 6677",
    avatarUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=160&q=80",
    specialty: "Quan ly cam xuc",
    active: true,
  },
];

export const schools: School[] = [
  { id: "s1", name: "Tieu hoc Nguyen Trai", district: "Quan 1" },
  { id: "s2", name: "Tieu hoc Le Van Tam", district: "Quan 3" },
];

export const classes: ClassRoom[] = [
  { id: "c1", schoolId: "s1", name: "1A", grade: "Khoi 1" },
  { id: "c2", schoolId: "s1", name: "3B", grade: "Khoi 3" },
  { id: "c3", schoolId: "s2", name: "2C", grade: "Khoi 2" },
  { id: "c4", schoolId: "s2", name: "4A", grade: "Khoi 4" },
];

export const lessons: Lesson[] = [
  {
    id: "l1",
    grade: "Khoi 1",
    title: "Lam quen va tu gioi thieu",
    objective: "Hoc sinh biet noi loi chao, gioi thieu ten va so thich.",
    durationMinutes: 35,
  },
  {
    id: "l2",
    grade: "Khoi 2",
    title: "Lang nghe tich cuc",
    objective: "Hoc sinh biet nhin nguoi noi, khong ngat loi va hoi lai dung luc.",
    durationMinutes: 35,
  },
  {
    id: "l3",
    grade: "Khoi 3",
    title: "Giai quyet mau thuan nho",
    objective: "Hoc sinh biet noi cam xuc, de xuat cach hoa giai va ton trong ban.",
    durationMinutes: 40,
  },
  {
    id: "l4",
    grade: "Khoi 4",
    title: "Thuyet trinh ngan",
    objective: "Hoc sinh trinh bay y kien trong 2 phut voi mo dau, noi dung, ket luan.",
    durationMinutes: 40,
  },
];

export const timeSlots: TimeSlot[] = [
  { id: "ts1", label: "Tiet 1", start: "07:30", end: "08:15" },
  { id: "ts2", label: "Tiet 2", start: "08:25", end: "09:10" },
  { id: "ts3", label: "Tiet 3", start: "09:25", end: "10:10" },
  { id: "ts4", label: "Tiet 4", start: "10:20", end: "11:05" },
  { id: "ts5", label: "Ca chuyen de chieu", start: "13:30", end: "15:00" },
];

export const schedules: Schedule[] = [
  {
    id: "sch1",
    date: "2026-05-20",
    teacherId: "t1",
    schoolId: "s1",
    classId: "c1",
    lessonId: "l1",
    timeSlotId: "ts1",
    status: "confirmed",
    sentAt: "2026-05-19T08:30:00.000Z",
    confirmedAt: "2026-05-19T09:02:00.000Z",
  },
  {
    id: "sch2",
    date: "2026-05-21",
    teacherId: "t2",
    schoolId: "s1",
    classId: "c2",
    lessonId: "l3",
    timeSlotId: "ts2",
    status: "sent",
    sentAt: "2026-05-19T08:34:00.000Z",
  },
  {
    id: "sch3",
    date: "2026-05-22",
    teacherId: "t3",
    schoolId: "s2",
    classId: "c4",
    lessonId: "l4",
    timeSlotId: "ts5",
    status: "lesson_plan_uploaded",
    sentAt: "2026-05-19T08:42:00.000Z",
    confirmedAt: "2026-05-19T10:12:00.000Z",
  },
];

export const lessonPlans: LessonPlan[] = [
  {
    id: "lp1",
    scheduleId: "sch3",
    teacherId: "t3",
    fileName: "giao-an-thuyet-trinh-ngan.pdf",
    driveUrl: "https://drive.google.com/example/giao-an-thuyet-trinh-ngan",
    uploadedAt: "2026-05-19T11:10:00.000Z",
  },
];

export const attendance: Attendance[] = [];

export const notifications: Notification[] = [
  {
    id: "n1",
    title: "Lich tuan da gui",
    body: "3 tiet day da duoc gui email cho giao vien.",
    role: "admin",
    createdAt: "2026-05-19T08:50:00.000Z",
    read: false,
  },
  {
    id: "n2",
    title: "Giao an moi",
    body: "Co Thanh Tam da tai giao an cho lop 4A.",
    role: "admin",
    createdAt: "2026-05-19T11:11:00.000Z",
    read: false,
  },
];
