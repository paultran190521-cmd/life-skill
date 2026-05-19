export type Role = "admin" | "teacher";

export type ScheduleStatus =
  | "draft"
  | "sent"
  | "confirmed"
  | "lesson_plan_uploaded"
  | "attended"
  | "cancelled"
  | "reassigned";

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

export type Lesson = {
  id: string;
  grade: string;
  title: string;
  objective: string;
  durationMinutes: number;
};

export type TimeSlot = {
  id: string;
  label: string;
  start: string;
  end: string;
};

export type Schedule = {
  id: string;
  date: string;
  teacherId: string;
  schoolId: string;
  classId: string;
  lessonId: string;
  timeSlotId: string;
  status: ScheduleStatus;
  sentAt?: string;
  confirmedAt?: string;
  reassignedFrom?: string;
};

export type LessonPlan = {
  id: string;
  scheduleId: string;
  teacherId: string;
  fileName: string;
  driveUrl: string;
  uploadedAt: string;
};

export type Attendance = {
  id: string;
  scheduleId: string;
  teacherId: string;
  checkedInAt: string;
};

export type ChatThreadType = "teacher" | "schedule";

export type ChatThread = {
  id: string;
  type: ChatThreadType;
  teacherId: string;
  scheduleId?: string;
  title: string;
};

export type ChatMessage = {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  senderRole: Role;
  body: string;
  createdAt: string;
};

export type Notification = {
  id: string;
  title: string;
  body: string;
  role: Role | "all";
  createdAt: string;
  read: boolean;
};
