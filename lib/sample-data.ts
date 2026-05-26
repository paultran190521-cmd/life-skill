import type {
  Attendance,
  ChatMessage,
  ChatThread,
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
    name: "Giáo vụ Life Skill",
    email: "admin@lifeskill.edu.vn",
    role: "admin",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80",
  },
  {
    id: "u-t1",
    name: "Cô Minh Anh",
    email: "minhanh@lifeskill.edu.vn",
    role: "teacher",
    teacherId: "t1",
    avatarUrl: "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=160&q=80",
  },
];

export const teachers: Teacher[] = [
  {
    id: "t1",
    name: "Cô Minh Anh",
    email: "minhanh@lifeskill.edu.vn",
    phone: "090 118 2233",
    avatarUrl: "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=160&q=80",
    specialty: "Kỹ năng giao tiếp",
    active: true,
  },
  {
    id: "t2",
    name: "Thầy Quốc Bảo",
    email: "quocbao@lifeskill.edu.vn",
    phone: "091 778 8899",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80",
    specialty: "Làm việc nhóm",
    active: true,
  },
  {
    id: "t3",
    name: "Cô Thanh Tâm",
    email: "thanhtam@lifeskill.edu.vn",
    phone: "093 245 6677",
    avatarUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=160&q=80",
    specialty: "Quản lý cảm xúc",
    active: true,
  },
];

export const schools: School[] = [
  { id: "s1", name: "Tiểu học Nguyễn Trãi", district: "Quận 1" },
  { id: "s2", name: "Tiểu học Lê Văn Tám", district: "Quận 3" },
];

export const classes: ClassRoom[] = [
  { id: "c1", schoolId: "s1", name: "1A", grade: "Khối 1" },
  { id: "c2", schoolId: "s1", name: "3B", grade: "Khối 3" },
  { id: "c3", schoolId: "s2", name: "2C", grade: "Khối 2" },
  { id: "c4", schoolId: "s2", name: "4A", grade: "Khối 4" },
];

export const lessons: Lesson[] = [
  {
    id: "l1",
    grade: "Khối 1",
    title: "Làm quen và tự giới thiệu",
    objective: "Học sinh biết nói lời chào, giới thiệu tên và sở thích.",
    durationMinutes: 35,
  },
  {
    id: "l2",
    grade: "Khối 2",
    title: "Lắng nghe tích cực",
    objective: "Học sinh biết nhìn người nói, không ngắt lời và hỏi lại đúng lúc.",
    durationMinutes: 35,
  },
  {
    id: "l3",
    grade: "Khối 3",
    title: "Giải quyết mâu thuẫn nhỏ",
    objective: "Học sinh biết nói cảm xúc, đề xuất cách hòa giải và tôn trọng bạn.",
    durationMinutes: 40,
  },
  {
    id: "l4",
    grade: "Khối 4",
    title: "Thuyết trình ngắn",
    objective: "Học sinh trình bày ý kiến trong 2 phút với mở đầu, nội dung, kết luận.",
    durationMinutes: 40,
  },
];

export const timeSlots: TimeSlot[] = [
  { id: "ts1", label: "Tiết 1", start: "07:30", end: "08:15" },
  { id: "ts2", label: "Tiết 2", start: "08:25", end: "09:10" },
  { id: "ts3", label: "Tiết 3", start: "09:25", end: "10:10" },
  { id: "ts4", label: "Tiết 4", start: "10:20", end: "11:05" },
  { id: "ts5", label: "Ca chuyên đề chiều", start: "13:30", end: "15:00" },
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

export const chatThreads: ChatThread[] = [
  { id: "thread-t1", type: "teacher", teacherId: "t1", title: "Trao đổi với Cô Minh Anh" },
  { id: "thread-sch1", type: "schedule", teacherId: "t1", scheduleId: "sch1", title: "Tiết 1 - Lớp 1A" },
];

export const chatMessages: ChatMessage[] = [
  {
    id: "m1",
    threadId: "thread-sch1",
    senderId: "u-admin",
    senderName: "Giáo vụ Life Skill",
    senderRole: "admin",
    body: "Cô gửi giáo án trước 17:00 hôm nay giúp em nhé.",
    createdAt: "2026-05-19T08:45:00.000Z",
  },
  {
    id: "m2",
    threadId: "thread-sch1",
    senderId: "u-t1",
    senderName: "Cô Minh Anh",
    senderRole: "teacher",
    body: "Đã nhận lịch, em sẽ tải lên trong chiều nay.",
    createdAt: "2026-05-19T09:04:00.000Z",
  },
];

export const notifications: Notification[] = [
  {
    id: "n1",
    title: "Lịch tuần đã gửi",
    body: "3 tiết dạy đã được gửi email cho giáo viên.",
    role: "admin",
    createdAt: "2026-05-19T08:50:00.000Z",
    read: false,
  },
  {
    id: "n2",
    title: "Giáo án mới",
    body: "Cô Thanh Tâm đã tải giáo án cho lớp 4A.",
    role: "admin",
    createdAt: "2026-05-19T11:11:00.000Z",
    read: false,
  },
];
