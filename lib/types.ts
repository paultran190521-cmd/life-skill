export type Role = "admin" | "teacher" | "assistant";

export type ScheduleStatus =
  | "draft"
  | "sent"
  | "confirmed"
  | "lesson_plan_uploaded"
  | "attended"
  | "cancelled"
  | "reassigned";

export type TeachingEnvironment =
  | "in_class"
  | "outdoor"
  | "gym"
  | "schoolyard_report"
  | "hall";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  teacherId?: string;
  avatarUrl?: string;
  isActive?: boolean;
};

export type Teacher = {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl: string;
  specialty: string;
  active: boolean;
};

export type School = {
  id: string;
  name: string;
  district: string;
};

export type ClassRoom = {
  id: string;
  schoolId: string;
  name: string;
  grade: string;
};

export type Topic = {
  id: string;
  grade: string;
  title: string;
  description?: string;
  active?: boolean;
};

export type Lesson = {
  id: string;
  topicId?: string;
  grade: string;
  /** Tên chuyên đề. Giữ trường title để tương thích các lịch đã tạo. */
  title: string;
  /** Mục tiêu tổng hợp của hai tiết, dùng cho các luồng cũ. */
  objective: string;
  lesson1Title?: string;
  lesson1Objective?: string;
  lesson2Title?: string;
  lesson2Objective?: string;
  objectives?: string;
  durationMinutes: number;
  sortOrder?: number;
  samplePlanUrl?: string;
  active?: boolean;
};

export type TimeSlot = {
  id: string;
  label: string;
  start: string;
  end: string;
  active?: boolean;
};

export type Schedule = {
  id: string;
  date: string;
  teacherId: string;
  schoolId: string;
  classId: string;
  lessonId: string;
  timeSlotId: string;
  teachingEnvironment?: TeachingEnvironment;
  status: ScheduleStatus;
  sentAt?: string;
  confirmedAt?: string;
  reassignedFrom?: string;
  groupId?: string;
  assistantIds?: string;
};

export type LessonPlan = {
  id: string;
  scheduleId: string;
  teacherId: string;
  fileName: string;
  driveFileId?: string;
  driveUrl: string;
  uploadedAt: string;
  source?: "upload" | "external_link";
};

export type Attendance = {
  id: string;
  scheduleId: string;
  teacherId: string;
  checkedInAt: string;
  note?: string;
};

export type Notification = {
  id: string;
  title: string;
  body: string;
  role: Role | "all";
  createdAt: string;
  read: boolean;
};

export type AppAnnouncementPriority = "important_urgent" | "important_not_urgent";

export type AppAnnouncement = {
  id: string;
  title: string;
  body: string;
  priority: AppAnnouncementPriority;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
};

export type AuditLog = {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: string;
  createdAt: string;
};

export type WeeklyUpdate = {
  id: string;
  weekNumber: number;
  updateDate: string;
  schoolId: string;
  classId: string;
  teachingHours: number;
  updatedBy: string;
  note?: string;
  createdAt: string;
};
