"use client";

import {
  AlertTriangle,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  FileUp,
  FileSpreadsheet,
  History,
  ListChecks,
  LayoutDashboard,
  LoaderCircle,
  Mail,
  Menu,
  Megaphone,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  RefreshCcw,
  School2,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Save,
  SlidersHorizontal,
  Trash2,
  UploadCloud,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { statusLabels, statusStyles } from "@/lib/status";
import { lessonDuplicateKey } from "@/lib/lessons";
import {
  MIN_TIME_SLOT_MINUTES,
  MAX_TIME_SLOT_MINUTES,
  TIME_SLOT_STEP_MINUTES,
  getTimeSlotDurationMinutes,
  isValidTimeSlotDuration,
  normalizeTimeSlotLabel,
  normalizeTimeValue,
  timeSlotDuplicateKey,
} from "@/lib/time-slots";
import type {
  Attendance,
  AppAnnouncement,
  AppAnnouncementPriority,
  AuditLog,
  ClassRoom,
  Lesson,
  LessonPeriod,
  LessonPlan,
  Notification,
  Role,
  Schedule,
  School,
  Teacher,
  TeachingEnvironment,
  TimeSlot,
  Topic,
  User,
  WeeklyUpdate,
} from "@/lib/types";

type TabId =
  | "dashboard"
  | "assignment"
  | "calendar"
  | "teachers"
  | "lessons"
  | "plans"
  | "attendance"
  | "weekly-updates"
  | "settings";

type DraftScheduleItem = {
  id: string;
  date: string;
  schoolId: string;
  classId: string;
  classIds: string[];
  lessonId: string;
  lessonPeriods: LessonPeriod[];
  timeSlotId: string;
  teachingEnvironment: NonNullable<Schedule["teachingEnvironment"]>;
  teacherIds: string[];
  topicId: string;
  assistantIds: string[];
};

type DraftSchedule = {
  items: DraftScheduleItem[];
};

type AppData = {
  users: User[];
  teachers: Teacher[];
  schools: School[];
  classes: ClassRoom[];
  topics: Topic[];
  lessons: Lesson[];
  timeSlots: TimeSlot[];
  schedules: Schedule[];
  lessonPlans: LessonPlan[];
  attendance: Attendance[];
  notifications: Notification[];
  appAnnouncements: AppAnnouncement[];
  auditLogs: AuditLog[];
  weeklyUpdates: WeeklyUpdate[];
};

type AuthSession = {
  user: User | null;
};

type ObservabilitySnapshot = {
  checkedAt: string;
  windowHours: number;
  summary: {
    totalEvents: number;
    decisions: {
      allow: number;
      deny: number;
      would_block: number;
    };
    apiErrors: number;
    deny1h: number;
    apiError1h: number;
  };
  topRoutes: Array<{ route: string; total: number; denied: number }>;
  topReasons: Array<{ reason: string; count: number }>;
  topCodes: Array<{ code: string; count: number }>;
  topActions: Array<{ action: string; count: number }>;
  health: {
    status: "ok" | "degraded" | "down";
  };
  alerts: Array<{ level: "warning" | "critical"; message: string }>;
};

type UserFeedbackDraft = {
  upgradeTarget: string;
  menuName: string;
  desiredFlow: string;
};

type AnnouncementDraft = {
  title: string;
  body: string;
  priority: AppAnnouncementPriority;
};

type EmailResult = {
  scheduleId?: string;
  scheduleIds?: string[];
  teacherId: string;
  sent: boolean;
  reason?: string;
  id?: string;
};

type ScheduleCreateResponse = {
  schedules: Schedule[];
  notifications?: Notification[];
  emailResults?: EmailResult[];
};

type ScheduleUpdateResponse = Partial<Schedule> & {
  id: string;
  notifications?: Notification[];
  emailResult?: EmailResult | null;
};

type AttendanceCreateResponse = {
  attendance: Attendance;
  schedule: Partial<Schedule> & { id: string };
};

type ClassCreateResponse = ClassRoom | { classes: ClassRoom[] };

type CalendarViewMode = "month" | "week" | "day";
type CalendarSortMode = "date-asc" | "date-desc" | "status";
type LessonPlanAdminFocus = "uploaded" | "submitted" | "missing" | "upcoming-missing";
type LessonPlanTeacherFocus = "uploaded" | "pending" | "submitted";
type AttendanceAdminFocus = "all-today" | "checked-today" | "missing-today" | "late-today";
type AttendanceWarningFocus = {
  teacherId: string;
  kind: "missing" | "late";
};
type TeacherOverviewFocus =
  | "taught"
  | "upcoming"
  | "late"
  | "missing-attendance"
  | "plan-submitted"
  | "plan-missing"
  | "env-in-class"
  | "env-outdoor"
  | "env-gym"
  | "env-schoolyard-report";

type CalendarFilters = {
  status: string;
  teacherId: string;
  schoolId: string;
  classId: string;
  timeSlotId: string;
  dateFrom: string;
  dateTo: string;
  sort: CalendarSortMode;
};

type OperationalAlert = {
  id: string;
  title: string;
  body: string;
  className: string;
  scheduleIds: string[];
};

type DraftScheduleConflict = {
  key: string;
  source: "existing" | "draft";
  scope: "teacher" | "class";
  date: string;
  timeSlotId: string;
  teacherId: string;
  classId: string;
};

type GasLessonPlanUploadResponse = {
  ok?: boolean;
  requestId?: string;
  lessonPlan: LessonPlan;
};

type LessonDraft = {
  grade: string;
  topicId: string;
  title: string;
  lesson1Title: string;
  lesson1Objective: string;
  lesson2Title: string;
  lesson2Objective: string;
  samplePlanUrl: string;
  durationMinutes: number | "";
};

type BulkLessonRow = LessonDraft & {
  id: string;
  topicId: string;
};

type TimeSlotDraft = {
  label: string;
  start: string;
  end: string;
  active?: boolean;
};

type TimeSlotImportDraft = TimeSlotDraft & {
  id: string;
  durationMinutes: number | "";
  active: boolean;
};

type TeacherImportDraft = {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialty: string;
  role: Role;
};

type TeacherEditDraft = {
  name: string;
  email: string;
  phone: string;
  specialty: string;
};

type ToastTone = "info" | "success" | "warning" | "error";

type ToastMessage = {
  id: string;
  title: string;
  body: string;
  tone: ToastTone;
  leaving: boolean;
};

type CenterFeedback = ToastMessage;

type AppDialogVariant = "confirm" | "prompt";

type AppDialog = {
  id: string;
  variant: AppDialogVariant;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  tone: "brand" | "danger";
  value: string;
  placeholder?: string;
  leaving: boolean;
  onResolve: (result: boolean | string | null) => void;
};

const lessonGrades = Array.from({ length: 12 }, (_, index) => `Khối ${index + 1}`);
const lessonDurations = Array.from(
  { length: Math.floor((MAX_TIME_SLOT_MINUTES - MIN_TIME_SLOT_MINUTES) / TIME_SLOT_STEP_MINUTES) + 1 },
  (_, i) => MIN_TIME_SLOT_MINUTES + i * TIME_SLOT_STEP_MINUTES,
);
const maxLessonPlanFileBytes = 10 * 1024 * 1024;
const supportedLessonPlanMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
]);
const supportedLessonPlanExtensions = [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".txt", ".csv"];
const calendarFilterStorageKey = "hoc-vien-mettasoul-calendar-filters-v1";
const defaultCalendarFilters: CalendarFilters = {
  status: "all",
  teacherId: "all",
  schoolId: "all",
  classId: "all",
  timeSlotId: "all",
  dateFrom: "",
  dateTo: "",
  sort: "date-asc",
};
const teachingEnvironmentOptions = [
  {
    value: "in_class" as const,
    label: "Trong lớp",
    chipClass: "bg-cyan-50 text-cyan-800",
  },
  {
    value: "outdoor" as const,
    label: "Ngoài sân",
    chipClass: "bg-emerald-50 text-emerald-800",
  },
  {
    value: "gym" as const,
    label: "Nhà thi đấu",
    chipClass: "bg-violet-50 text-violet-700",
  },
  {
    value: "schoolyard_report" as const,
    label: "Báo cáo sân trường",
    chipClass: "bg-amber-50 text-amber-800",
  },
  {
    value: "hall" as const,
    label: "Hội trường",
    chipClass: "bg-rose-50 text-rose-800",
  },
];
const defaultTeachingEnvironment = teachingEnvironmentOptions[0].value;
const fallbackCurrentUser: User = {
  id: "",
  name: "Chưa đăng nhập",
  email: "",
  role: "admin",
};

const adminTabs: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
  { id: "dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { id: "assignment", label: "Giao lịch", icon: Send },
  { id: "calendar", label: "Lịch tổng", icon: CalendarDays },
  { id: "teachers", label: "Giáo viên", icon: Users },
  { id: "lessons", label: "Bài học", icon: BookOpen },
  { id: "plans", label: "Giáo án", icon: FileUp },
  { id: "attendance", label: "Điểm danh", icon: CheckCircle2 },
  { id: "weekly-updates", label: "Cập nhật tuần", icon: ListChecks },
  { id: "settings", label: "Cấu hình", icon: Settings2 },
];

const teacherTabs: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
  { id: "dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { id: "calendar", label: "Lịch của tôi", icon: CalendarDays },
  { id: "plans", label: "Giáo án", icon: FileUp },
  { id: "attendance", label: "Điểm danh", icon: CheckCircle2 },
];

const assistantTabs: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
  { id: "dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { id: "calendar", label: "Lịch trợ giảng", icon: CalendarDays },
];

export function MettasoulApp() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [, startTabTransition] = useTransition();
  const [appUsers, setAppUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [sessionUserId, setSessionUserId] = useState("");
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [weeklyUpdates, setWeeklyUpdates] = useState<WeeklyUpdate[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [appAnnouncements, setAppAnnouncements] = useState<AppAnnouncement[]>([]);
  const [dataStatus, setDataStatus] = useState<"loading" | "connected" | "offline">("loading");
  const [authStatus, setAuthStatus] = useState<"checking" | "signed-in" | "signed-out">("checking");
  const [saveError, setSaveError] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => currentMonthKey());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState("");
  const [calendarViewMode, setCalendarViewMode] = useState<CalendarViewMode>("week");
  const [calendarFilters, setCalendarFilters] = useState<CalendarFilters>(() => loadCalendarFilters());
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<string[]>([]);
  const [selectedAssignmentScheduleIds, setSelectedAssignmentScheduleIds] = useState<string[]>([]);
  const [assignmentReportDateFrom, setAssignmentReportDateFrom] = useState(() => `${currentDateKey().slice(0, 7)}-01`);
  const [assignmentReportDateTo, setAssignmentReportDateTo] = useState(() => currentDateKey());
  const [assignmentReportTeacherId, setAssignmentReportTeacherId] = useState("all");
  const [selectedScheduleDetail, setSelectedScheduleDetail] = useState<Schedule | null>(null);
  const [selectedOperationalAlert, setSelectedOperationalAlert] = useState<OperationalAlert | null>(null);
  const [bulkReassignTeacherId, setBulkReassignTeacherId] = useState("");
  const [expandedHistoryScheduleId, setExpandedHistoryScheduleId] = useState("");
  const calendarDetailRef = useRef<HTMLDivElement | null>(null);
  const selectedCalendarDayRef = useRef<HTMLButtonElement | null>(null);
  const shouldScrollCalendarDetailRef = useRef(false);
  const [lessonSearchTerm, setLessonSearchTerm] = useState("");
  const [lessonGradeFilter, setLessonGradeFilter] = useState("all");
  const [lessonPlanTeacherFilter, setLessonPlanTeacherFilter] = useState("all");
  const [lessonPlanStatusFilter, setLessonPlanStatusFilter] = useState<"all" | "uploaded" | "missing">("all");
  const [lessonPlanAdminFocus, setLessonPlanAdminFocus] = useState<LessonPlanAdminFocus>("uploaded");
  const [lessonPlanTeacherFocus, setLessonPlanTeacherFocus] = useState<LessonPlanTeacherFocus>("uploaded");
  const [lessonPlanLinkDrafts, setLessonPlanLinkDrafts] = useState<Record<string, string>>({});
  const [teacherOverviewDateFrom, setTeacherOverviewDateFrom] = useState("");
  const [teacherOverviewDateTo, setTeacherOverviewDateTo] = useState("");
  const [teacherOverviewFocus, setTeacherOverviewFocus] = useState<TeacherOverviewFocus | null>(null);
  const [assignmentPreviewTeacherId, setAssignmentPreviewTeacherId] = useState("all");
  const [draftSchedule, setDraftSchedule] = useState<DraftSchedule>({
    items: [createDraftScheduleItem()],
  });
  const [teacherDraft, setTeacherDraft] = useState({
    name: "",
    email: "",
    phone: "",
    specialty: "",
    role: "teacher" as Role,
  });
  const [teacherModalOpen, setTeacherModalOpen] = useState(false);
  const [editingTeacherId, setEditingTeacherId] = useState("");
  const [teacherEditDraft, setTeacherEditDraft] = useState<TeacherEditDraft>({
    name: "",
    email: "",
    phone: "",
    specialty: "",
  });
  const [bulkLessonRows, setBulkLessonRows] = useState<BulkLessonRow[]>(() => [createBulkLessonRow()]);
  const [bulkLessonErrors, setBulkLessonErrors] = useState<Record<string, string>>({});
  const [editingLessonId, setEditingLessonId] = useState("");
  const [lessonEditDraft, setLessonEditDraft] = useState<LessonDraft>({
    grade: "Khối 1",
    topicId: "",
    title: "",
    lesson1Title: "",
    lesson1Objective: "",
    lesson2Title: "",
    lesson2Objective: "",
    samplePlanUrl: "",
    durationMinutes: 45,
  });
  const [lessonDeleteTarget, setLessonDeleteTarget] = useState<Lesson | null>(null);
  const [reassignTarget, setReassignTarget] = useState<Schedule | null>(null);
  const [reassignTeacherId, setReassignTeacherId] = useState("");
  const [slotDraft, setSlotDraft] = useState<TimeSlotDraft>({
    label: "",
    start: "07:30",
    end: "08:15",
  });
  const [editingSlotId, setEditingSlotId] = useState("");
  const [slotEditDraft, setSlotEditDraft] = useState<TimeSlotDraft>({
    label: "",
    start: "07:30",
    end: "08:15",
    active: true,
  });
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [collapsedSettingsSections, setCollapsedSettingsSections] = useState({
    announcements: false,
    schools: true,
    classes: true,
    slots: true,
  });
  const [announcementDraft, setAnnouncementDraft] = useState<AnnouncementDraft>({
    title: "",
    body: "",
    priority: "important_urgent",
  });
  const [schoolDraft, setSchoolDraft] = useState({
    name: "",
    district: "",
  });
  const [editingSchoolId, setEditingSchoolId] = useState("");
  const [schoolEditDraft, setSchoolEditDraft] = useState({
    name: "",
    district: "",
  });
  const [classDraft, setClassDraft] = useState({
    schoolId: "",
    name: "",
  });
  const [editingClassId, setEditingClassId] = useState("");
  const [classEditDraft, setClassEditDraft] = useState({
    schoolId: "",
    name: "",
    grade: "Khối 1",
  });
  const [attendanceAdminFocus, setAttendanceAdminFocus] = useState<AttendanceAdminFocus | null>(null);
  const [attendanceWarningFocus, setAttendanceWarningFocus] = useState<AttendanceWarningFocus | null>(null);
  const [feedbackDraft, setFeedbackDraft] = useState<UserFeedbackDraft>({
    upgradeTarget: "",
    menuName: "",
    desiredFlow: "",
  });
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [weeklyUpdateDraft, setWeeklyUpdateDraft] = useState({
    weekNumber: "",
    updateDate: currentDateKey(),
    schoolId: "",
    classId: "",
    teachingHours: "",
    note: "",
  });
  const [editingWeeklyUpdateId, setEditingWeeklyUpdateId] = useState("");
  const [weeklyUpdateEditDraft, setWeeklyUpdateEditDraft] = useState({
    weekNumber: "",
    updateDate: "",
    schoolId: "",
    classId: "",
    teachingHours: "",
    note: "",
  });
  const [weeklyUpdateDeleteTarget, setWeeklyUpdateDeleteTarget] = useState<WeeklyUpdate | null>(null);
  const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);
  const [centerFeedback, setCenterFeedback] = useState<CenterFeedback | null>(null);
  const [appDialog, setAppDialog] = useState<AppDialog | null>(null);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [observability, setObservability] = useState<ObservabilitySnapshot | null>(null);
  const [observabilityLoading, setObservabilityLoading] = useState(false);
  const [observabilityError, setObservabilityError] = useState("");
  const notificationPanelRef = useRef<HTMLDivElement | null>(null);
  const mobileCalendarInitRef = useRef(false);

  const activeUsers = useMemo(() => appUsers.filter((user) => user.isActive !== false), [appUsers]);
  const sessionUser = appUsers.find((user) => user.id === sessionUserId) ?? null;
  const currentUser =
    activeUsers.find((user) => user.id === currentUserId) ??
    activeUsers.find((user) => user.role === "admin") ??
    activeUsers[0] ??
    fallbackCurrentUser;
  const role = currentUser.role;
  const isTeachingStaff = role === "teacher" || role === "assistant";
  const hasAdminAccess = sessionUser?.role === "admin";
  const currentTeacherId = currentUser.teacherId ?? "";
  const navigationTabs = role === "admin" ? adminTabs : role === "assistant" ? assistantTabs : teacherTabs;
  const activeTabMeta = navigationTabs.find((item) => item.id === activeTab) ?? navigationTabs[0];
  const activeTeachers = useMemo(() => teachers.filter((teacher) => teacher.active !== false), [teachers]);
  const activeAssistants = useMemo(() => {
    const assistantTeacherIds = new Set(
      activeUsers
        .filter((user) => user.role === "assistant")
        .map((user) => user.teacherId)
        .filter((teacherId): teacherId is string => Boolean(teacherId)),
    );
    return activeTeachers.filter((teacher) => assistantTeacherIds.has(teacher.id));
  }, [activeTeachers, activeUsers]);
  const activeLessons = useMemo(() => lessons.filter((lesson) => lesson.active !== false), [lessons]);
  const activeTimeSlots = useMemo(() => timeSlots.filter((slot) => slot.active !== false), [timeSlots]);
  const hasBlockingModal = Boolean(
    feedbackModalOpen ||
      teacherModalOpen ||
      lessonDeleteTarget ||
      reassignTarget ||
      selectedOperationalAlert ||
      selectedScheduleDetail ||
      teacherOverviewFocus ||
      attendanceAdminFocus ||
      attendanceWarningFocus ||
      appDialog,
  );
  const filteredTeachers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return teachers;
    }

    return teachers.filter((teacher) =>
      [teacher.name, teacher.email, teacher.phone, teacher.specialty]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [searchTerm, teachers]);
  const filteredLessons = useMemo(() => {
    const term = lessonSearchTerm.trim().toLowerCase();
    return activeLessons.filter((lesson) => {
      const matchesGrade = lessonGradeFilter === "all" || lesson.grade === lessonGradeFilter;
      const matchesTerm =
        !term ||
        [
          lesson.title,
          lesson.objective,
          lesson.lesson1Title,
          lesson.lesson1Objective,
          lesson.lesson2Title,
          lesson.lesson2Objective,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term);
      return matchesGrade && matchesTerm;
    });
  }, [activeLessons, lessonGradeFilter, lessonSearchTerm]);
  const isBusy = Boolean(pendingAction);

  function selectCalendarDate(dateKey: string, { scrollDetail = true }: { scrollDetail?: boolean } = {}) {
    shouldScrollCalendarDetailRef.current = scrollDetail;
    setSelectedCalendarDate(dateKey);
  }

  useEffect(() => {
    const slotIds = new Set(timeSlots.map((slot) => slot.id));
    setSelectedSlotIds((items) => {
      const nextItems = items.filter((id) => slotIds.has(id));
      return nextItems.length === items.length ? items : nextItems;
    });
  }, [timeSlots]);

  useEffect(() => {
    if (activeTab === "settings") {
      setCollapsedSettingsSections({ announcements: false, schools: true, classes: true, slots: true });
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "settings" || authStatus !== "signed-in" || !hasAdminAccess) {
      return;
    }
    void loadObservability();
  }, [activeTab, authStatus, hasAdminAccess]);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const session = await apiRequest<AuthSession>("/api/auth/session");
        if (cancelled) {
          return;
        }

        const sessionUser = session.user;
        if (sessionUser) {
          setAppUsers((items) =>
            items.some((item) => item.id === sessionUser.id)
              ? items.map((item) => (item.id === sessionUser.id ? { ...item, ...sessionUser } : item))
              : [sessionUser, ...items],
          );
          setSessionUserId(sessionUser.id);
          setCurrentUserId(sessionUser.id);
          setAuthStatus("signed-in");
          return sessionUser;
        } else {
          setSessionUserId("");
          setAuthStatus("signed-out");
          return null;
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setSessionUserId("");
          setAuthStatus("signed-out");
        }
        return null;
      }
    }

    async function loadAppData() {
      try {
        const data = await apiRequest<AppData>("/api/app-data", { cache: "no-store" });
        if (cancelled) {
          return;
        }

        setAppUsers(data.users);
        setTeachers(data.teachers);
        setSchools(data.schools);
        setClasses(data.classes);
        setTopics(data.topics ?? []);
        setLessons(data.lessons);
        setTimeSlots(data.timeSlots);
        setSchedules(data.schedules);
        setLessonPlans(data.lessonPlans);
        setAttendance(data.attendance);
        setAuditLogs(data.auditLogs ?? []);
        setNotifications(data.notifications);
        setAppAnnouncements(data.appAnnouncements ?? []);
        setWeeklyUpdates(data.weeklyUpdates ?? []);
        setDataStatus("connected");
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setDataStatus("offline");
        }
      }
    }

    async function bootstrap() {
      setDataStatus("loading");
      const sessionUser = await loadSession();
      if (cancelled) {
        return;
      }

      if (!sessionUser) {
        setDataStatus("connected");
        return;
      }

      await loadAppData();
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authStatus !== "signed-in" || dataStatus !== "connected" || typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);
    const confirmedAll = url.searchParams.get("confirmedAll");
    if (confirmedAll === null) {
      return;
    }
    const confirmedCount = Number(confirmedAll);
    if (!Number.isFinite(confirmedCount) || confirmedCount < 0) {
      return;
    }

    pushToast(
      "Đã nhận lịch",
      confirmedCount > 0 ? `Đã xác nhận ${confirmedCount} lịch dạy của bạn.` : "Các lịch chờ xác nhận của bạn đã được kiểm tra.",
      "success",
    );
    url.searchParams.delete("confirmedAll");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [authStatus, dataStatus]);

  useEffect(() => {
    const updateViewport = () => {
      setIsMobileViewport(window.innerWidth < 768);
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => {
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  useEffect(() => {
    const rootStyle = document.documentElement.style;
    const updateModalViewport = () => {
      const viewport = window.visualViewport;
      rootStyle.setProperty("--app-visual-viewport-top", `${viewport?.offsetTop ?? 0}px`);
      rootStyle.setProperty("--app-visual-viewport-height", `${viewport?.height ?? window.innerHeight}px`);
    };

    updateModalViewport();
    window.visualViewport?.addEventListener("resize", updateModalViewport);
    window.visualViewport?.addEventListener("scroll", updateModalViewport);
    window.addEventListener("resize", updateModalViewport);

    return () => {
      window.visualViewport?.removeEventListener("resize", updateModalViewport);
      window.visualViewport?.removeEventListener("scroll", updateModalViewport);
      window.removeEventListener("resize", updateModalViewport);
      rootStyle.removeProperty("--app-visual-viewport-top");
      rootStyle.removeProperty("--app-visual-viewport-height");
    };
  }, []);

  useEffect(() => {
    if (!activeUsers.some((user) => user.id === currentUserId)) {
      setCurrentUserId(activeUsers[0]?.id ?? "");
    }
  }, [activeUsers, currentUserId]);

  useEffect(() => {
    const allowedTabs = role === "admin" ? adminTabs : role === "assistant" ? assistantTabs : teacherTabs;
    if (!allowedTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(isTeachingStaff ? "calendar" : "dashboard");
    }
  }, [activeTab, role]);

  useEffect(() => {
    if (!isMobileViewport || mobileCalendarInitRef.current) {
      return;
    }
    setActiveTab("calendar");
    mobileCalendarInitRef.current = true;
  }, [isMobileViewport]);

  useEffect(() => {
    if (activeTab === "calendar") {
      setCalendarViewMode("week");
    }
  }, [activeTab]);

  useEffect(() => {
    if (!hasBlockingModal) {
      return;
    }

    const htmlStyle = document.documentElement.style;
    const bodyStyle = document.body.style;
    const previous = {
      htmlOverflow: htmlStyle.overflow,
      bodyOverflow: bodyStyle.overflow,
      htmlOverscrollBehavior: htmlStyle.overscrollBehavior,
      bodyOverscrollBehavior: bodyStyle.overscrollBehavior,
    };
    const preventBackgroundScroll = (event: Event) => {
      const target = event.target as Element | null;
      if (target?.closest("[data-modal-scroll='true']")) {
        return;
      }
      event.preventDefault();
    };

    htmlStyle.overflow = "hidden";
    bodyStyle.overflow = "hidden";
    htmlStyle.overscrollBehavior = "none";
    bodyStyle.overscrollBehavior = "none";
    document.addEventListener("touchmove", preventBackgroundScroll, { passive: false });
    document.addEventListener("wheel", preventBackgroundScroll, { passive: false });

    return () => {
      htmlStyle.overflow = previous.htmlOverflow;
      bodyStyle.overflow = previous.bodyOverflow;
      htmlStyle.overscrollBehavior = previous.htmlOverscrollBehavior;
      bodyStyle.overscrollBehavior = previous.bodyOverscrollBehavior;
      document.removeEventListener("touchmove", preventBackgroundScroll);
      document.removeEventListener("wheel", preventBackgroundScroll);
    };
  }, [hasBlockingModal]);

  useEffect(() => {
    if (!isTeachingStaff || activeTab !== "calendar" || !currentTeacherId) {
      return;
    }
    const today = currentDateKey();
    setCalendarMonth(currentMonthKey());
    selectCalendarDate(today, { scrollDetail: false });
  }, [activeTab, currentTeacherId, role]);

  useEffect(() => {
    setDraftSchedule((current) => {
      if (current.items.length === 0) {
        const defaultSchoolId = schools[0]?.id ?? "";
        const defaultGrade = pickDefaultGradeForSchool(defaultSchoolId, current.items[0]?.classId ?? "", classes);
        const defaultClassId = pickClassIdForSchoolGrade(
          defaultSchoolId,
          defaultGrade,
          current.items[0]?.classId ?? "",
          classes,
        );
        return {
          ...current,
          items: [
            createDraftScheduleItem({
              date: current.items[0]?.date ?? currentDateKey(),
              schoolId: defaultSchoolId,
              classId: defaultClassId,
              classIds: defaultClassId ? [defaultClassId] : [],
              lessonId: pickLessonIdForGrade(defaultGrade, current.items[0]?.lessonId ?? "", activeLessons),
              timeSlotId: activeTimeSlots[0]?.id ?? "",
              teachingEnvironment: current.items[0]?.teachingEnvironment ?? defaultTeachingEnvironment,
            }),
          ],
        };
      }

      const nextItems = current.items.map((item) =>
        normalizeDraftScheduleItem(item, { schools, classes, activeLessons, activeTimeSlots }),
      );
      const changed = nextItems.some((item, index) => {
        const currentItem = current.items[index];
        return (
          item.schoolId !== currentItem.schoolId ||
          item.classId !== currentItem.classId ||
          item.classIds.join(",") !== currentItem.classIds.join(",") ||
          item.lessonId !== currentItem.lessonId ||
          item.lessonPeriods.join(",") !== currentItem.lessonPeriods.join(",") ||
          item.timeSlotId !== currentItem.timeSlotId ||
          item.teachingEnvironment !== currentItem.teachingEnvironment
        );
      });
      if (!changed) {
        return current;
      }
      return { ...current, items: nextItems };
    });
  }, [schools, classes, activeLessons, activeTimeSlots]);

  useEffect(() => {
    if (activeTeachers.length === 0) {
      return;
    }
    const activeTeacherIds = new Set(activeTeachers.map((teacher) => teacher.id));
    const activeAssistantIds = new Set(activeAssistants.map((teacher) => teacher.id));
    setDraftSchedule((current) => ({
      ...current,
      items: current.items.map((item) => {
        const nextTeacherIds = item.teacherIds.filter((id) => activeTeacherIds.has(id));
        const nextAssistantIds = item.assistantIds.filter((id) => activeAssistantIds.has(id));
        return nextTeacherIds.length === item.teacherIds.length && nextAssistantIds.length === item.assistantIds.length
          ? item
          : { ...item, teacherIds: nextTeacherIds, assistantIds: nextAssistantIds };
      }),
    }));
  }, [activeAssistants, activeTeachers]);

  useEffect(() => {
    if (schools.length === 0) {
      return;
    }
    if (!schools.some((school) => school.id === classDraft.schoolId)) {
      setClassDraft((current) => ({ ...current, schoolId: schools[0].id }));
    }
  }, [schools, classDraft.schoolId]);

  useEffect(() => {
    saveCalendarFilters(calendarFilters);
  }, [calendarFilters]);

  useEffect(() => {
    if (!isTeachingStaff || !currentTeacherId) {
      return;
    }
    if (calendarFilters.teacherId !== currentTeacherId) {
      setCalendarFilters((current) => ({ ...current, teacherId: currentTeacherId }));
    }
  }, [calendarFilters.teacherId, currentTeacherId, role]);

  const visibleSchedules = useMemo(() => {
    const scoped =
      role === "admin"
        ? schedules
        : schedules.filter(
            (schedule) =>
              schedule.teacherId === currentTeacherId ||
              (role === "assistant" && splitAssistantIds(schedule.assistantIds).includes(currentTeacherId)),
          );

    const term = searchTerm.trim().toLowerCase();
    return sortSchedules(
      scoped.filter((schedule) => {
        if (!matchesCalendarFilters(schedule, calendarFilters)) {
          return false;
        }
        if (!term) {
          return true;
        }

        const teacher = teachers.find((item) => item.id === schedule.teacherId);
        const school = schools.find((item) => item.id === schedule.schoolId);
        const classRoom = classes.find((item) => item.id === schedule.classId);
        const lesson = lessons.find((item) => item.id === schedule.lessonId);
        return [teacher?.name, school?.name, classRoom?.name, lesson?.title, schedule.date]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term);
      }),
      calendarFilters.sort,
    );
  }, [calendarFilters, classes, currentTeacherId, lessons, role, schedules, schools, searchTerm, teachers]);
  const calendarDays = useMemo(
    () => buildCalendarDays(calendarMonth, selectedCalendarDate, calendarViewMode, visibleSchedules),
    [calendarMonth, calendarViewMode, selectedCalendarDate, visibleSchedules],
  );
  const selectedDaySchedules = useMemo(
    () => visibleSchedules.filter((schedule) => schedule.date === selectedCalendarDate),
    [selectedCalendarDate, visibleSchedules],
  );
  const calendarStats = useMemo(() => buildCalendarStats(visibleSchedules), [visibleSchedules]);
  const scheduleCountByDate = useMemo(() => {
    const countByDate = new Map<string, number>();
    for (const schedule of visibleSchedules) {
      countByDate.set(schedule.date, (countByDate.get(schedule.date) ?? 0) + 1);
    }
    return countByDate;
  }, [visibleSchedules]);
  const quickScheduleDates = useMemo(() => {
    const uniqueDates = Array.from(new Set(visibleSchedules.map((schedule) => schedule.date))).sort((a, b) => a.localeCompare(b));
    const monthDates = uniqueDates.filter((date) => date.startsWith(calendarMonth));
    const sourceDates = monthDates.length > 0 ? monthDates : uniqueDates;
    const today = currentDateKey();
    const futureDates = sourceDates.filter((date) => date >= today);
    const pastDates = sourceDates.filter((date) => date < today);
    const prioritized = [...futureDates, ...pastDates.slice(-3)];
    return prioritized.slice(0, 10).map((dateKey) => ({
      dateKey,
      count: scheduleCountByDate.get(dateKey) ?? 0,
      isToday: dateKey === today,
    }));
  }, [calendarMonth, scheduleCountByDate, visibleSchedules]);
  const operationalAlerts = useMemo(
    () => buildOperationalAlerts(visibleSchedules, attendance, teachers),
    [attendance, teachers, visibleSchedules],
  );
  const selectedOperationalAlertSchedules = useMemo(() => {
    if (!selectedOperationalAlert) {
      return [];
    }
    const scheduleIds = new Set(selectedOperationalAlert.scheduleIds);
    return visibleSchedules.filter((schedule) => scheduleIds.has(schedule.id));
  }, [selectedOperationalAlert, visibleSchedules]);
  const selectedDayScheduleIds = useMemo(
    () => new Set(selectedDaySchedules.map((schedule) => schedule.id)),
    [selectedDaySchedules],
  );

  useEffect(() => {
    setSelectedScheduleIds((ids) => ids.filter((id) => selectedDayScheduleIds.has(id)));
  }, [selectedDayScheduleIds]);

  const allDraftTeacherIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of draftSchedule.items) {
      for (const tid of item.teacherIds) ids.add(tid);
    }
    return Array.from(ids);
  }, [draftSchedule.items]);

  useEffect(() => {
    if (assignmentPreviewTeacherId === "all") {
      return;
    }
    if (!allDraftTeacherIds.includes(assignmentPreviewTeacherId)) {
      setAssignmentPreviewTeacherId("all");
    }
  }, [assignmentPreviewTeacherId, allDraftTeacherIds]);

  useEffect(() => {
    if (!selectedCalendarDate) {
      return;
    }
    window.requestAnimationFrame(() => {
      selectedCalendarDayRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      if (!shouldScrollCalendarDetailRef.current) {
        return;
      }
      shouldScrollCalendarDetailRef.current = false;
      calendarDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [selectedCalendarDate]);

  const draftSchedulePreview = useMemo<Schedule[]>(
    () =>
      draftSchedule.items.flatMap((item) =>
        item.teacherIds.map((teacherId) => ({
            id: `preview-${teacherId}-${item.id}`,
            date: item.date,
            teacherId,
            schoolId: item.schoolId,
            classId: item.classIds[0] ?? item.classId,
            participantClassIds: item.classIds.join(","),
            lessonId: item.lessonId,
            lessonPeriods: item.lessonPeriods.join(","),
            timeSlotId: item.timeSlotId,
            teachingEnvironment: item.teachingEnvironment,
            groupId: item.teachingEnvironment === "in_class" ? undefined : `preview-group-${item.id}`,
            status: "sent" as const,
            assistantIds: item.assistantIds.join(","),
          })),
      ),
    [draftSchedule],
  );
  const draftPreviewTeacherOptions = useMemo(
    () =>
      allDraftTeacherIds
        .map((teacherId) => teachers.find((teacher) => teacher.id === teacherId))
        .filter((teacher): teacher is Teacher => Boolean(teacher)),
    [allDraftTeacherIds, teachers],
  );
  const draftPreviewScheduleCountByTeacher = useMemo(() => {
    const countByTeacher = new Map<string, number>();
    for (const schedule of draftSchedulePreview) {
      countByTeacher.set(schedule.teacherId, (countByTeacher.get(schedule.teacherId) || 0) + 1);
    }
    return countByTeacher;
  }, [draftSchedulePreview]);
  const filteredDraftSchedulePreview =
    assignmentPreviewTeacherId === "all"
      ? draftSchedulePreview
      : draftSchedulePreview.filter((schedule) => schedule.teacherId === assignmentPreviewTeacherId);
  const draftScheduleConflicts = useMemo<DraftScheduleConflict[]>(() => {
    const conflicts: DraftScheduleConflict[] = [];
    const dedupe = new Set<string>();
    const activeSchedules = schedules.filter((schedule) => schedule.status !== "cancelled");

    // Build lookup: teacher-slot-key → list of {schoolId, env}
    type SlotInfo = { schoolId: string; env: TeachingEnvironment };
    const existingTeacherSlots = new Map<string, SlotInfo[]>();
    for (const s of activeSchedules) {
      const key = buildTeacherSlotKey(s);
      const list = existingTeacherSlots.get(key) ?? [];
      list.push({ schoolId: s.schoolId, env: s.teachingEnvironment ?? "in_class" });
      existingTeacherSlots.set(key, list);
    }
    const existingClassSlots = new Map<string, SlotInfo[]>();
    for (const schedule of activeSchedules) {
      for (const classId of scheduleParticipantClassIds(schedule)) {
        const key = buildClassSlotKey({ ...schedule, classId });
        const list = existingClassSlots.get(key) ?? [];
        list.push({ schoolId: schedule.schoolId, env: schedule.teachingEnvironment ?? "in_class" });
        existingClassSlots.set(key, list);
      }
    }

    // Assistants bypass teacher conflicts
    const assistantTeacherIds = new Set(
      teachers.filter((t) => {
        const user = appUsers.find((u) => u.teacherId === t.id);
        return user?.role === "assistant";
      }).map((t) => t.id),
    );

    // Draft tracking
    const draftTeacherSlots = new Map<string, SlotInfo[]>();
    const draftClassSlots = new Map<string, SlotInfo[]>();

    for (const schedule of draftSchedulePreview) {
      // Rule 4: assistants bypass teacher conflicts
      const isAssistant = assistantTeacherIds.has(schedule.teacherId);

      if (!isAssistant) {
        const teacherKey = buildTeacherSlotKey(schedule);
        const draftEnv: TeachingEnvironment = (schedule.teachingEnvironment as TeachingEnvironment) ?? "in_class";
        const draftSchoolId = schedule.schoolId;

        // Check against existing schedules
        const existingSlots = existingTeacherSlots.get(teacherKey) ?? [];
        for (const ex of existingSlots) {
          const sameSchool = ex.schoolId === draftSchoolId;
          if (!sameSchool) {
            // Rule 1: different school same slot = ALWAYS conflict
            pushDraftConflict(conflicts, dedupe, {
              source: "existing",
              scope: "teacher",
              date: schedule.date,
              timeSlotId: schedule.timeSlotId,
              teacherId: schedule.teacherId,
              classId: schedule.classId,
            });
          } else {
            // Same school rules
            const bothOutdoor = ex.env !== "in_class" && draftEnv !== "in_class";
            if (!bothOutdoor) {
              // Rule 2: same school, at least one in_class = conflict
              pushDraftConflict(conflicts, dedupe, {
                source: "existing",
                scope: "teacher",
                date: schedule.date,
                timeSlotId: schedule.timeSlotId,
                teacherId: schedule.teacherId,
                classId: schedule.classId,
              });
            }
            // Rule 3: same school, all outdoor = allowed (no conflict)
          }
        }

        // Check against draft schedules
        const draftSlots = draftTeacherSlots.get(teacherKey) ?? [];
        for (const dr of draftSlots) {
          const sameSchool = dr.schoolId === draftSchoolId;
          if (!sameSchool) {
            pushDraftConflict(conflicts, dedupe, {
              source: "draft",
              scope: "teacher",
              date: schedule.date,
              timeSlotId: schedule.timeSlotId,
              teacherId: schedule.teacherId,
              classId: schedule.classId,
            });
          } else {
            const bothOutdoor = dr.env !== "in_class" && draftEnv !== "in_class";
            if (!bothOutdoor) {
              pushDraftConflict(conflicts, dedupe, {
                source: "draft",
                scope: "teacher",
                date: schedule.date,
                timeSlotId: schedule.timeSlotId,
                teacherId: schedule.teacherId,
                classId: schedule.classId,
              });
            }
          }
        }

        const draftList = draftTeacherSlots.get(teacherKey) ?? [];
        draftList.push({ schoolId: draftSchoolId, env: draftEnv });
        draftTeacherSlots.set(teacherKey, draftList);
      }

      // A class may join another same-school group activity in the same slot.
      // In-class teaching always remains exclusive.
      const classEnvironment = schedule.teachingEnvironment ?? "in_class";
      for (const classId of scheduleParticipantClassIds(schedule)) {
        const classKey = buildClassSlotKey({ ...schedule, classId });
        const conflictsExistingClass = (existingClassSlots.get(classKey) ?? []).some(
          (entry) => !canShareGroupActivitySlot(entry, { schoolId: schedule.schoolId, env: classEnvironment }),
        );
        if (conflictsExistingClass) {
          pushDraftConflict(conflicts, dedupe, {
            source: "existing",
            scope: "class",
            date: schedule.date,
            timeSlotId: schedule.timeSlotId,
            teacherId: schedule.teacherId,
            classId,
          });
        }
        const conflictsDraftClass = (draftClassSlots.get(classKey) ?? []).some(
          (entry) => !canShareGroupActivitySlot(entry, { schoolId: schedule.schoolId, env: classEnvironment }),
        );
        if (conflictsDraftClass) {
          pushDraftConflict(conflicts, dedupe, {
            source: "draft",
            scope: "class",
            date: schedule.date,
            timeSlotId: schedule.timeSlotId,
            teacherId: schedule.teacherId,
            classId,
          });
        }
        const classDraftList = draftClassSlots.get(classKey) ?? [];
        classDraftList.push({ schoolId: schedule.schoolId, env: classEnvironment });
        draftClassSlots.set(classKey, classDraftList);
      }
    }

    return conflicts;
  }, [draftSchedulePreview, schedules, teachers, appUsers]);

  const roleNotifications = useMemo(
    () =>
      notifications
        .filter((item) => item.role === role || item.role === "all")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [notifications, role],
  );
  const activeAppAnnouncements = useMemo(
    () =>
      appAnnouncements
        .filter((item) => item.active)
        .sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt)),
    [appAnnouncements],
  );
  const feedbackNotifications = useMemo(
    () =>
      notifications
        .filter((item) => item.title.startsWith("Feedback | "))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [notifications],
  );
  const feedbackMenuSuggestions = useMemo(
    () =>
      role === "admin"
        ? ["Tổng quan", "Giao lịch", "Lịch tổng", "Giáo viên", "Bài học", "Giáo án", "Điểm danh", "Cập nhật tuần", "Cấu hình"]
        : ["Tổng quan", "Lịch của tôi", "Giáo án", "Điểm danh"],
    [role],
  );
  const feedbackFlowExamples = [
    "Bấm Lịch của tôi -> chọn ngày -> bấm Nhận lịch -> hiển thị trạng thái Đã nhận.",
    "Bấm Giáo án -> chọn tiết dạy -> tải file -> hiển thị Đã gửi giáo án.",
    "Bấm Điểm danh -> chọn tiết -> bấm Điểm danh -> chuyển trạng thái Đã điểm danh.",
  ];
  const unreadNotifications = roleNotifications.filter((item) => !item.read).length;
  const searchPlaceholder =
    activeTab === "teachers" ? "Tìm nhanh giáo viên theo tên, SĐT, email..." : "Tìm lịch, giáo viên, lớp...";

  useEffect(() => {
    if (!notificationPanelOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!notificationPanelRef.current?.contains(event.target as Node)) {
        setNotificationPanelOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setNotificationPanelOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [notificationPanelOpen]);

  function lookupSchedule(schedule: Schedule) {
    const coTeacherCandidates =
      schedule.teachingEnvironment !== "in_class" && schedule.groupId
        ? schedules
            .filter((item) => item.groupId === schedule.groupId && item.teacherId !== schedule.teacherId)
            .map((item) => teachers.find((teacher) => teacher.id === item.teacherId))
            .filter((teacher): teacher is Teacher => Boolean(teacher))
        : [];
    const coTeachers = Array.from(new Map(coTeacherCandidates.map((teacher) => [teacher.id, teacher])).values());
    return {
      teacher: teachers.find((item) => item.id === schedule.teacherId),
      school: schools.find((item) => item.id === schedule.schoolId),
      classRoom: classes.find((item) => item.id === schedule.classId),
      participantClasses: scheduleParticipantClassIds(schedule)
        .map((classId) => classes.find((item) => item.id === classId))
        .filter((classRoom): classRoom is ClassRoom => Boolean(classRoom)),
      assistants: splitAssistantIds(schedule.assistantIds)
        .map((assistantId) => teachers.find((item) => item.id === assistantId))
        .filter((assistant): assistant is Teacher => Boolean(assistant)),
      coTeachers,
      lesson: lessons.find((item) => item.id === schedule.lessonId),
      slot: timeSlots.find((item) => item.id === schedule.timeSlotId),
      plans: lessonPlans
        .filter((item) => item.scheduleId === schedule.id)
        .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)),
      checkIn: attendance.find((item) => item.scheduleId === schedule.id),
    };
  }

  function canManageLessonPlan(plan: LessonPlan) {
    return role === "admin" || plan.teacherId === currentTeacherId;
  }

  function formatScheduleDateTime(schedule: Schedule) {
    const slot = timeSlots.find((item) => item.id === schedule.timeSlotId);
    const timeText = slot ? `${slot.label} ${slot.start}-${slot.end}` : "Chưa có khung giờ";
    return `${formatDate(schedule.date)} • ${timeText}`;
  }

  function dismissToast(id: string) {
    setToastMessages((items) => items.map((item) => (item.id === id ? { ...item, leaving: true } : item)));
    setTimeout(() => {
      setToastMessages((items) => items.filter((item) => item.id !== id));
    }, 220);
  }

  function pushToast(title: string, body: string, tone: ToastTone = "info") {
    const id = createId("toast");
    const toast = { id, title, body, tone, leaving: false };
    setToastMessages((items) => [toast, ...items].slice(0, 4));
    setCenterFeedback(toast);
    setTimeout(() => {
      setCenterFeedback((current) => (current?.id === id ? { ...current, leaving: true } : current));
    }, 1600);
    setTimeout(() => {
      setCenterFeedback((current) => (current?.id === id ? null : current));
    }, 2050);
    setTimeout(() => dismissToast(id), 4200);
  }

  function closeDialog() {
    setAppDialog((current) => (current ? { ...current, leaving: true } : current));
    setTimeout(() => {
      setAppDialog(null);
    }, 220);
  }

  function resolveDialog(result: boolean | string | null) {
    if (!appDialog) {
      return;
    }
    appDialog.onResolve(result);
    closeDialog();
  }

  function openConfirmDialog(options: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    tone?: "brand" | "danger";
  }) {
    return new Promise<boolean>((resolve) => {
      setAppDialog({
        id: createId("dialog"),
        variant: "confirm",
        title: options.title,
        message: options.message,
        confirmText: options.confirmText ?? "Xác nhận",
        cancelText: options.cancelText ?? "Hủy",
        tone: options.tone ?? "brand",
        value: "",
        leaving: false,
        onResolve: (result) => resolve(result === true),
      });
    });
  }

  function openPromptDialog(options: {
    title: string;
    message: string;
    defaultValue?: string;
    placeholder?: string;
    confirmText?: string;
    cancelText?: string;
  }) {
    return new Promise<string | null>((resolve) => {
      setAppDialog({
        id: createId("dialog"),
        variant: "prompt",
        title: options.title,
        message: options.message,
        confirmText: options.confirmText ?? "Lưu",
        cancelText: options.cancelText ?? "Hủy",
        tone: "brand",
        value: options.defaultValue ?? "",
        placeholder: options.placeholder,
        leaving: false,
        onResolve: (result) => resolve(typeof result === "string" ? result : null),
      });
    });
  }

  function addNotification(
    title: string,
    body: string,
    targetRole: Role | "all" = "admin",
    options?: { tone?: ToastTone; showToast?: boolean },
  ) {
    setNotifications((items) => [
      {
        id: createId("n"),
        title,
        body,
        role: targetRole,
        createdAt: new Date().toISOString(),
        read: false,
      },
      ...items,
    ]);
    const shouldShowToast = options?.showToast ?? true;
    if (shouldShowToast && (targetRole === "all" || targetRole === role)) {
      pushToast(title, body, options?.tone ?? "info");
    }
  }

  function handleSaveError(error: unknown) {
    const message = error instanceof Error ? error.message : "Không thể ghi dữ liệu vào Google Sheet.";
    console.error(error);
    setDataStatus("offline");
    setSaveError(message);
    addNotification("Không lưu được dữ liệu", message, "admin", { showToast: false });
    pushToast("Không lưu được dữ liệu", message, "error");
  }

  async function saveRequest<T>(label: string, url: string, init?: RequestInit) {
    setPendingAction(label);
    try {
      const headers = new Headers(init?.headers);
      headers.set("x-app-user-id", currentUser.id);
      headers.set("x-app-user-email", currentUser.email);
      headers.set("x-app-user-role", currentUser.role);
      if (currentTeacherId) {
        headers.set("x-app-teacher-id", currentTeacherId);
      }
      return await apiRequest<T>(url, { ...init, headers });
    } finally {
      setPendingAction("");
    }
  }

  async function createSchedules() {
    const rowsMissingLessons = draftSchedule.items
      .map((item, index) => {
        const classRoom = classes.find((entry) => entry.id === item.classId);
        if (!classRoom) {
          return null;
        }
        return lessonsForGrade(activeLessons, classRoom.grade).length === 0 ? index + 1 : null;
      })
      .filter((row): row is number => row !== null);
    if (rowsMissingLessons.length > 0) {
      pushToast(
        "Thiếu bài học theo khối",
        `Dòng ${rowsMissingLessons.join(", ")} chưa có bài học hoạt động đúng khối. Vui lòng cập nhật ở mục Bài học.`,
        "warning",
      );
      return;
    }

    const validItems = draftSchedule.items.filter(
      (item) => item.date && item.schoolId && item.classIds.length > 0 && item.lessonId && item.lessonPeriods.length > 0 && item.timeSlotId,
    );

    if (validItems.length === 0) {
      pushToast("Thiếu lịch dạy", "Hãy thêm ít nhất một dòng lịch dạy hợp lệ trước khi gửi.", "warning");
      return;
    }

    if (activeTeachers.length === 0) {
      pushToast("Thiếu giáo viên", "Chưa có giáo viên hoạt động. Vào mục Giáo viên để kích hoạt hoặc thêm mới.", "warning");
      return;
    }

    const activeTeacherIds = new Set(activeTeachers.map((teacher) => teacher.id));
    const rowsMissingTeachers = validItems
      .map((item, index) => (item.teacherIds.length === 0 ? index + 1 : null))
      .filter((row): row is number => row !== null);
    if (rowsMissingTeachers.length > 0) {
      pushToast(
        "Chưa chọn giáo viên",
        `Dòng ${rowsMissingTeachers.join(", ")} chưa chọn giáo viên. Hãy chọn ít nhất một giáo viên cho mỗi dòng.`,
        "warning",
      );
      return;
    }

    const hasInvalidTeacher = validItems.some((item) =>
      item.teacherIds.some((tid) => !activeTeacherIds.has(tid)),
    );
    if (hasInvalidTeacher) {
      pushToast(
        "Giáo viên không hợp lệ",
        "Danh sách giáo viên đã thay đổi. Hệ thống đã làm mới, vui lòng chọn lại giáo viên rồi gửi lịch.",
        "warning",
      );
      setDraftSchedule((current) => ({
        ...current,
        items: current.items.map((item) => ({
          ...item,
          teacherIds: item.teacherIds.filter((tid) => activeTeacherIds.has(tid)),
        })),
      }));
      return;
    }

    if (activeTimeSlots.length === 0) {
      pushToast("Thiếu khung giờ", "Chưa có khung giờ hoạt động. Vào Cấu hình để tạo hoặc bật lại.", "warning");
      return;
    }

    if (!validItems.every((item) => activeTimeSlots.some((slot) => slot.id === item.timeSlotId))) {
      setDraftSchedule((current) => ({
        ...current,
        items: current.items.map((item) =>
          activeTimeSlots.some((slot) => slot.id === item.timeSlotId)
            ? item
            : { ...item, timeSlotId: activeTimeSlots[0]?.id ?? item.timeSlotId },
        ),
      }));
      pushToast("Khung giờ không hợp lệ", "Khung giờ đã chọn không còn hoạt động. Hệ thống đã tự chọn lại khung giờ hợp lệ.", "warning");
      return;
    }

    if (draftScheduleConflicts.length > 0) {
      const preview = formatDraftConflictLine(draftScheduleConflicts[0], teachers, classes, timeSlots);
      pushToast(
        "Phát hiện xung đột lịch",
        `Có ${draftScheduleConflicts.length} xung đột. Ví dụ: ${preview}. Vui lòng xử lý ở phần Xem trước trước khi gửi.`,
        "warning",
      );
      return;
    }

    let created: Schedule[];
    let emailResults: EmailResult[] = [];
    try {
      const allTeacherIds = [...new Set(validItems.flatMap((item) => item.teacherIds))];
      const response = await saveRequest<ScheduleCreateResponse>("Đang tạo lịch dạy...", "/api/schedules", {
        method: "POST",
        body: JSON.stringify({
          teacherIds: allTeacherIds,
          items: validItems.map((item) => ({
            date: item.date,
            schoolId: item.schoolId,
            classId: item.classId,
            classIds: item.classIds,
            lessonId: item.lessonId,
            lessonPeriods: item.lessonPeriods,
            timeSlotId: item.timeSlotId,
            teachingEnvironment: item.teachingEnvironment,
            teacherIds: item.teacherIds,
            assistantIds: item.assistantIds.length > 0 ? item.assistantIds.join(",") : undefined,
          })),
          createdBy: currentUser.id,
        }),
      });
      created = response.schedules;
      emailResults = response.emailResults ?? [];
      if (response.notifications?.length) {
        setNotifications((items) => [...response.notifications!, ...items]);
      }
      setDataStatus("connected");
      setSaveError("");
    } catch (error) {
      handleSaveError(error);
      return;
    }

    setSchedules((items) => [...created, ...items]);
    const sentEmails = emailResults.filter((item) => item.sent).length;
    const failedEmails = emailResults.length - sentEmails;
    if (emailResults.length > 0) {
      pushToast(
        "Đã gửi lịch dạy",
        `Tạo ${created.length} lịch, email thành công ${sentEmails}, thất bại ${failedEmails}.`,
        failedEmails > 0 ? "warning" : "success",
      );
      return;
    }
    pushToast("Đã gửi lịch dạy", `Đã tạo ${created.length} lịch thành công.`, "success");
  }

  async function confirmSchedule(scheduleId: string) {
    let response: ScheduleUpdateResponse;
    try {
      response = await saveRequest<ScheduleUpdateResponse>(`Đang xác nhận lịch...`, `/api/schedules/${scheduleId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "confirmed" }),
      });
      if (response.notifications?.length) {
        setNotifications((items) => [...response.notifications!, ...items]);
      }
      setDataStatus("connected");
      setSaveError("");
    } catch (error) {
      handleSaveError(error);
      return;
    }

    setSchedules((items) =>
      items.map((item) =>
        item.id === scheduleId
          ? { ...item, status: "confirmed", confirmedAt: new Date().toISOString() }
          : item,
      ),
    );
    addLocalAudit("schedule.confirm", scheduleId, { status: "confirmed" });
    pushToast("Đã xác nhận lịch", "Lịch dạy đã được xác nhận thành công.", "success");
  }

  async function uploadLessonPlans(schedule: Schedule, selectedFiles: FileList | null) {
    if (!selectedFiles || selectedFiles.length === 0) {
      return;
    }

    const files = Array.from(selectedFiles);
    const invalidTypeFile = files.find((file) => !isSupportedLessonPlanFile(file));
    if (invalidTypeFile) {
      handleSaveError(
        new Error(`File ${invalidTypeFile.name} không đúng định dạng. Chỉ hỗ trợ PDF, DOC/DOCX, PPT/PPTX, XLS/XLSX, TXT, CSV.`),
      );
      return;
    }

    const tooLargeFile = files.find((file) => file.size > maxLessonPlanFileBytes);
    if (tooLargeFile) {
      handleSaveError(
        new Error(
          `File ${tooLargeFile.name} vượt quá 10 MB. Với file PPT/PPTX nặng, hãy upload lên Google Drive của bạn, mở quyền xem cho admin rồi dán link vào ô Link PPT/Drive trong card lịch.`,
        ),
      );
      return;
    }

    let successCount = 0;
    const failures: Array<{ fileName: string; error: Error }> = [];

    for (const file of files) {
      const result = await uploadSingleLessonPlan(schedule, file);
      if (result.ok) {
        successCount += 1;
      } else {
        failures.push({ fileName: file.name, error: result.error });
      }
    }

    if (successCount > 0) {
      const message =
        files.length === 1
          ? `${teacherName(schedule.teacherId)} đã tải lên ${files[0].name}.`
          : `${teacherName(schedule.teacherId)} đã tải lên ${successCount}/${files.length} file giáo án.`;
      addNotification("Giáo án mới", message, "admin", { tone: "success" });
    }

    if (failures.length > 0) {
      const firstError = failures[0]?.error?.message || "Không thể tải một số file giáo án.";
      handleSaveError(new Error(`${firstError} (${failures.length}/${files.length} file thất bại)`));
    }
  }

  async function attachLessonPlanLink(schedule: Schedule) {
    const rawLink = String(lessonPlanLinkDrafts[schedule.id] || "").trim();
    if (!rawLink) {
      pushToast("Thiếu link giáo án", "Dán link Google Drive/PPT trước khi lưu.", "warning");
      return;
    }

    let url: URL;
    try {
      url = new URL(rawLink);
    } catch {
      pushToast("Link không hợp lệ", "Link giáo án phải là đường dẫn http hoặc https.", "warning");
      return;
    }

    if (!["http:", "https:"].includes(url.protocol)) {
      pushToast("Link không hợp lệ", "Link giáo án phải bắt đầu bằng http hoặc https.", "warning");
      return;
    }

    try {
      const response = await saveRequest<LessonPlan>("Đang lưu link giáo án...", "/api/lesson-plans", {
        method: "POST",
        body: JSON.stringify({
          scheduleId: schedule.id,
          teacherId: schedule.teacherId,
          fileName: inferLessonPlanLinkName(url.toString()),
          driveUrl: url.toString(),
          source: "external_link",
        }),
      });
      setLessonPlans((items) => [response, ...items]);
      setSchedules((items) =>
        items.map((item) =>
          item.id === schedule.id && item.status !== "attended"
            ? { ...item, status: "lesson_plan_uploaded" }
            : item,
        ),
      );
      setLessonPlanLinkDrafts((items) => ({ ...items, [schedule.id]: "" }));
      setDataStatus("connected");
      setSaveError("");
      addNotification("Giáo án mới", `${teacherName(schedule.teacherId)} đã gửi link giáo án.`, "admin", {
        tone: "success",
      });
      pushToast("Đã lưu link giáo án", "Link đã hiện ngay trong card chuyên đề.", "success");
    } catch (error) {
      handleSaveError(error);
    }
  }

  async function uploadSingleLessonPlan(
    schedule: Schedule,
    file: File,
  ): Promise<{ ok: true } | { ok: false; error: Error }> {
    try {
      const fileData = await fileToBase64(file);
      const response = await saveRequest<GasLessonPlanUploadResponse>("Đang tải giáo án qua GAS...", "/api/lesson-plans/upload", {
        method: "POST",
        body: JSON.stringify({
          scheduleId: schedule.id,
          teacherId: schedule.teacherId,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          fileSize: file.size,
          fileData,
        }),
      });
      const plan = response.lessonPlan;
      setDataStatus("connected");
      setSaveError("");
      setLessonPlans((items) => [plan, ...items]);
      setSchedules((items) =>
        items.map((item) =>
          item.id === schedule.id && item.status !== "attended"
            ? { ...item, status: "lesson_plan_uploaded" }
            : item,
        ),
      );
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error("Không thể tải file giáo án."),
      };
    }
  }

  async function editLessonPlan(plan: LessonPlan) {
    if (!canManageLessonPlan(plan)) {
      handleSaveError(new Error("Bạn không có quyền sửa giáo án này."));
      return;
    }

    const nextFileName = (
      await openPromptDialog({
        title: "Đổi tên giáo án",
        message: "Nhập tên mới cho giáo án. Tên sẽ được cập nhật trên Google Sheet.",
        defaultValue: plan.fileName,
        placeholder: "Tên giáo án",
        confirmText: "Lưu tên mới",
      })
    )?.trim();
    if (!nextFileName || nextFileName === plan.fileName) {
      return;
    }

    try {
      await saveRequest("Đang cập nhật tên giáo án...", `/api/lesson-plans/${plan.id}`, {
        method: "PATCH",
        body: JSON.stringify({ fileName: nextFileName }),
      });
      setDataStatus("connected");
      setSaveError("");
      setLessonPlans((items) =>
        items.map((item) => (item.id === plan.id ? { ...item, fileName: nextFileName } : item)),
      );
      addNotification("Cập nhật giáo án", `${teacherName(plan.teacherId)} đã đổi tên giáo án.`, "admin", {
        tone: "success",
      });
    } catch (error) {
      handleSaveError(error);
    }
  }

  async function deleteLessonPlan(plan: LessonPlan) {
    if (!canManageLessonPlan(plan)) {
      handleSaveError(new Error("Bạn không có quyền xóa giáo án này."));
      return;
    }

    const confirmed = await openConfirmDialog({
      title: "Xóa giáo án",
      message: `Bạn chắc chắn muốn xóa giáo án "${plan.fileName}" khỏi hệ thống?`,
      confirmText: "Xóa giáo án",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }

    try {
      await saveRequest("Đang xóa giáo án...", `/api/lesson-plans/${plan.id}`, {
        method: "DELETE",
      });
      setDataStatus("connected");
      setSaveError("");
      setLessonPlans((items) => items.filter((item) => item.id !== plan.id));
      addNotification("Xóa giáo án", `${teacherName(plan.teacherId)} đã xóa ${plan.fileName}.`, "admin", {
        tone: "warning",
      });
    } catch (error) {
      handleSaveError(error);
    }
  }

  async function checkIn(schedule: Schedule) {
    if (attendance.some((item) => item.scheduleId === schedule.id)) {
      return;
    }

    const record: Attendance = {
      id: createId("att"),
      scheduleId: schedule.id,
      teacherId: schedule.teacherId,
      checkedInAt: new Date().toISOString(),
    };

    let response: AttendanceCreateResponse;
    try {
      response = await saveRequest<AttendanceCreateResponse>("Đang điểm danh...", "/api/attendance", {
        method: "POST",
        body: JSON.stringify(record),
      });
      setDataStatus("connected");
      setSaveError("");
    } catch (error) {
      handleSaveError(error);
      return;
    }

    setAttendance((items) => [
      response.attendance,
      ...items,
    ]);
    setSchedules((items) =>
      items.map((item) => (item.id === schedule.id ? { ...item, ...response.schedule } : item)),
    );
    addNotification("Đã điểm danh", `${teacherName(schedule.teacherId)} đã điểm danh tiết dạy.`, "admin", {
      tone: "success",
    });
  }

  async function cancelSchedule(schedule: Schedule) {
    let response: ScheduleUpdateResponse;
    try {
      response = await saveRequest<ScheduleUpdateResponse>("Đang hủy lịch...", `/api/schedules/${schedule.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (response.notifications?.length) {
        setNotifications((items) => [...response.notifications!, ...items]);
      }
      setDataStatus("connected");
      setSaveError("");
    } catch (error) {
      handleSaveError(error);
      return;
    }

    setSchedules((items) =>
      items.map((item) => (item.id === schedule.id ? { ...item, status: "cancelled" } : item)),
    );
    addLocalAudit("schedule.cancel", schedule.id, { status: "cancelled", teacherId: schedule.teacherId });
    pushToast("Đã hủy lịch", "Lịch dạy đã được hủy và đồng bộ lên Google Sheet.", "warning");
  }

  async function deleteSchedule(schedule: Schedule) {
    const confirmed = await openConfirmDialog({
      title: "Xóa lịch đã giao",
      message: "Lịch này sẽ bị xóa khỏi hệ thống. Thao tác này không thể hoàn tác.",
      confirmText: "Xóa lịch",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      await saveRequest<{ id: string; deleted: boolean }>("Đang xóa lịch...", `/api/schedules/${schedule.id}`, {
        method: "DELETE",
      });
      setSchedules((items) => items.filter((item) => item.id !== schedule.id));
      setSelectedAssignmentScheduleIds((ids) => ids.filter((id) => id !== schedule.id));
      setSelectedScheduleIds((ids) => ids.filter((id) => id !== schedule.id));
      setSelectedScheduleDetail((current) => (current?.id === schedule.id ? null : current));
      addLocalAudit("schedule.delete", schedule.id, { teacherId: schedule.teacherId });
      setDataStatus("connected");
      setSaveError("");
      pushToast("Đã xóa lịch", "Lịch đã được xóa khỏi Google Sheet.", "success");
    } catch (error) {
      handleSaveError(error);
    }
  }

  async function bulkDeleteAssignmentSchedules(scheduleIds = selectedAssignmentScheduleIds) {
    const targets = schedules.filter((schedule) => scheduleIds.includes(schedule.id));
    if (targets.length === 0) return;

    const confirmed = await openConfirmDialog({
      title: "Xóa nhiều lịch",
      message: `Bạn chắc chắn muốn xóa vĩnh viễn ${targets.length} lịch đã chọn?`,
      confirmText: "Xóa lịch",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      await Promise.all(
        targets.map((schedule) =>
          saveRequest<{ id: string; deleted: boolean }>("Đang xóa lịch hàng loạt...", `/api/schedules/${schedule.id}`, {
            method: "DELETE",
          }),
        ),
      );
      const deletedIds = new Set(targets.map((schedule) => schedule.id));
      setSchedules((items) => items.filter((item) => !deletedIds.has(item.id)));
      setSelectedAssignmentScheduleIds([]);
      setSelectedScheduleIds((ids) => ids.filter((id) => !deletedIds.has(id)));
      setSelectedScheduleDetail((current) => (current && deletedIds.has(current.id) ? null : current));
      setAuditLogs((items) => [
        ...targets.map((schedule) => createLocalAuditLog("schedule.delete", schedule.id, { teacherId: schedule.teacherId })),
        ...items,
      ]);
      setDataStatus("connected");
      setSaveError("");
      pushToast("Đã xóa lịch", `Đã xóa ${targets.length} lịch khỏi hệ thống.`, "success");
    } catch (error) {
      handleSaveError(error);
    }
  }

  function reassignSchedule(schedule: Schedule) {
    const replacement = activeTeachers.find((teacher) => teacher.id !== schedule.teacherId);
    setReassignTarget(schedule);
    setReassignTeacherId(replacement?.id ?? "");
  }

  async function submitReassignSchedule() {
    if (!reassignTarget || !reassignTeacherId) {
      return;
    }

    const replacement = teachers.find((teacher) => teacher.id === reassignTeacherId);
    if (!replacement) {
      handleSaveError(new Error("Không tìm thấy giáo viên thay thế."));
      return;
    }

    let response: ScheduleUpdateResponse;
    try {
      response = await saveRequest<ScheduleUpdateResponse>("Đang chuyển lịch...", `/api/schedules/${reassignTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "reassigned",
          teacherId: replacement.id,
          reassignedFrom: reassignTarget.teacherId,
        }),
      });
      if (response.notifications?.length) {
        setNotifications((items) => [...response.notifications!, ...items]);
      }
      setDataStatus("connected");
      setSaveError("");
    } catch (error) {
      handleSaveError(error);
      return;
    }

    setSchedules((items) =>
      items.map((item) =>
        item.id === reassignTarget.id
          ? {
              ...item,
              teacherId: replacement.id,
              status: "reassigned",
              reassignedFrom: reassignTarget.teacherId,
              sentAt: new Date().toISOString(),
            }
          : item,
      ),
    );
    addLocalAudit("schedule.reassign", reassignTarget.id, {
      status: "reassigned",
      teacherId: replacement.id,
      reassignedFrom: reassignTarget.teacherId,
    });
    pushToast("Đã chuyển lịch", `Lịch đã chuyển sang giáo viên ${replacement.name}.`, "success");
    setReassignTarget(null);
    setReassignTeacherId("");
  }

  function toggleScheduleSelection(scheduleId: string) {
    setSelectedScheduleIds((ids) =>
      ids.includes(scheduleId) ? ids.filter((id) => id !== scheduleId) : [...ids, scheduleId],
    );
  }

  function toggleSelectAllSelectedDay() {
    const ids = selectedDaySchedules.map((schedule) => schedule.id);
    setSelectedScheduleIds((current) => (current.length === ids.length ? [] : ids));
  }

  async function bulkCancelSchedules() {
    const targets = selectedDaySchedules.filter((schedule) => selectedScheduleIds.includes(schedule.id));
    if (targets.length === 0) {
      return;
    }

    const confirmed = await openConfirmDialog({
      title: "Hủy nhiều lịch",
      message: `Bạn chắc chắn muốn hủy ${targets.length} lịch đã chọn?`,
      confirmText: "Hủy lịch",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }

    try {
      const responses = await Promise.all(
        targets.map((schedule) =>
          saveRequest<ScheduleUpdateResponse>("Đang hủy lịch hàng loạt...", `/api/schedules/${schedule.id}`, {
            method: "PATCH",
            body: JSON.stringify({ status: "cancelled" }),
          }),
        ),
      );
      const newNotifications = responses.flatMap((response) => response.notifications ?? []);
      if (newNotifications.length > 0) {
        setNotifications((items) => [...newNotifications, ...items]);
      }
      setSchedules((items) =>
        items.map((item) => (selectedScheduleIds.includes(item.id) ? { ...item, status: "cancelled" } : item)),
      );
      setAuditLogs((items) => [
        ...targets.map((schedule) =>
          createLocalAuditLog("schedule.cancel", schedule.id, { status: "cancelled", teacherId: schedule.teacherId }),
        ),
        ...items,
      ]);
      setSelectedScheduleIds([]);
      setDataStatus("connected");
      setSaveError("");
      pushToast("Đã hủy lịch", `Đã hủy ${targets.length} lịch đã chọn.`, "warning");
    } catch (error) {
      handleSaveError(error);
    }
  }

  async function bulkReassignSchedules() {
    const targets = selectedDaySchedules.filter((schedule) => selectedScheduleIds.includes(schedule.id));
    const replacement = teachers.find((teacher) => teacher.id === bulkReassignTeacherId);
    if (targets.length === 0 || !replacement) {
      return;
    }

    try {
      const responses = await Promise.all(
        targets.map((schedule) =>
          saveRequest<ScheduleUpdateResponse>("Đang chuyển lịch hàng loạt...", `/api/schedules/${schedule.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              status: "reassigned",
              teacherId: replacement.id,
              reassignedFrom: schedule.teacherId,
            }),
          }),
        ),
      );
      const newNotifications = responses.flatMap((response) => response.notifications ?? []);
      if (newNotifications.length > 0) {
        setNotifications((items) => [...newNotifications, ...items]);
      }
      setSchedules((items) =>
        items.map((item) =>
          selectedScheduleIds.includes(item.id)
            ? {
                ...item,
                teacherId: replacement.id,
                status: "reassigned",
                reassignedFrom: item.teacherId,
                sentAt: new Date().toISOString(),
              }
            : item,
        ),
      );
      setAuditLogs((items) => [
        ...targets.map((schedule) =>
          createLocalAuditLog("schedule.reassign", schedule.id, {
            status: "reassigned",
            teacherId: replacement.id,
            reassignedFrom: schedule.teacherId,
          }),
        ),
        ...items,
      ]);
      setSelectedScheduleIds([]);
      setBulkReassignTeacherId("");
      setDataStatus("connected");
      setSaveError("");
      pushToast("Đã chuyển lịch", `Đã chuyển ${targets.length} lịch sang ${replacement.name}.`, "success");
    } catch (error) {
      handleSaveError(error);
    }
  }

  async function sendScheduleReminders() {
    const targets = selectedDaySchedules.filter(
      (schedule) => selectedScheduleIds.includes(schedule.id) && ["sent", "reassigned"].includes(schedule.status),
    );
    if (targets.length === 0) {
      pushToast("Không có lịch cần nhắc", "Chọn các lịch đang chờ xác nhận để gửi nhắc.", "warning");
      return;
    }

    const reminders = targets.map((schedule) => ({
      id: createId("n"),
      title: "Nhắc xác nhận lịch dạy",
      body: `Bạn có lịch ${formatScheduleDateTime(schedule)} chưa xác nhận. Vui lòng kiểm tra Lịch của tôi.`,
      role: "teacher" as const,
      createdAt: new Date().toISOString(),
      read: false,
    }));

    try {
      const response = await saveRequest<{ notifications: Notification[] }>("Đang gửi nhắc xác nhận...", "/api/notifications", {
        method: "POST",
        body: JSON.stringify({ notifications: reminders }),
      });
      setNotifications((items) => [...response.notifications, ...items]);
      setSelectedScheduleIds([]);
      setDataStatus("connected");
      setSaveError("");
      pushToast("Đã gửi nhắc", `Đã gửi ${response.notifications.length} thông báo nhắc xác nhận.`, "success");
    } catch (error) {
      handleSaveError(error);
    }
  }

  async function loadObservability(windowHours = 48) {
    if (!hasAdminAccess) {
      return;
    }

    try {
      setObservabilityLoading(true);
      setObservabilityError("");
      const snapshot = await apiRequest<ObservabilitySnapshot>(`/api/admin/observability?windowHours=${windowHours}`);
      setObservability(snapshot);
    } catch (error) {
      console.error(error);
      setObservabilityError(error instanceof Error ? error.message : "Không tải được dashboard observability.");
    } finally {
      setObservabilityLoading(false);
    }
  }

  async function submitFeedback() {
    const upgradeTarget = feedbackDraft.upgradeTarget.trim();
    const menuName = feedbackDraft.menuName.trim();
    const desiredFlow = feedbackDraft.desiredFlow.trim();
    if (!upgradeTarget || !menuName || !desiredFlow) {
      pushToast("Thiếu nội dung", "Vui lòng điền đủ 3 trường feedback trước khi gửi.", "warning");
      return;
    }

    const now = new Date().toISOString();
    const payload = {
      id: createId("n"),
      title: `Feedback | ${menuName}`,
      body: `Cần cập nhật/nâng cấp: ${upgradeTarget}\nMenu: ${menuName}\nQuy trình mong muốn: ${desiredFlow}`,
      role: "admin" as const,
      createdAt: now,
      read: false,
    };

    try {
      const response = await saveRequest<{ notifications: Notification[] }>("Đang lưu feedback...", "/api/notifications", {
        method: "POST",
        body: JSON.stringify({ notifications: [payload] }),
      });
      setNotifications((items) => [...response.notifications, ...items]);
      setFeedbackDraft({ upgradeTarget: "", menuName: "", desiredFlow: "" });
      setFeedbackModalOpen(false);
      setDataStatus("connected");
      setSaveError("");
      pushToast("Đã nhận feedback", "Feedback đã được lưu vào hệ thống để theo dõi nâng cấp.", "success");
    } catch (error) {
      handleSaveError(error);
    }
  }

  async function createAppAnnouncement() {
    const title = announcementDraft.title.trim();
    const body = announcementDraft.body.trim();
    if (!title || !body) {
      pushToast("Thiếu nội dung thông báo", "Nhập tiêu đề và nội dung trước khi đẩy thông báo.", "warning");
      return;
    }

    try {
      const savedAnnouncement = await saveRequest<AppAnnouncement>("Đang đẩy thông báo...", "/api/announcements", {
        method: "POST",
        body: JSON.stringify({
          title,
          body,
          priority: announcementDraft.priority,
          active: true,
          createdBy: currentUser.id,
        }),
      });
      setAppAnnouncements((items) => [savedAnnouncement, ...items]);
      setAnnouncementDraft({ title: "", body: "", priority: "important_urgent" });
      setDataStatus("connected");
      setSaveError("");
      pushToast("Đã đẩy thông báo", "Thông báo đang chạy ở đầu ứng dụng cho giáo viên.", "success");
    } catch (error) {
      handleSaveError(error);
    }
  }

  async function toggleAppAnnouncement(announcement: AppAnnouncement) {
    const nextActive = !announcement.active;
    try {
      const savedAnnouncement = await saveRequest<Partial<AppAnnouncement> & { id: string }>(
        nextActive ? "Đang bật thông báo..." : "Đang tắt thông báo...",
        `/api/announcements/${announcement.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ active: nextActive }),
        },
      );
      setAppAnnouncements((items) =>
        items.map((item) => (item.id === announcement.id ? { ...item, ...savedAnnouncement, active: nextActive } : item)),
      );
      setDataStatus("connected");
      setSaveError("");
      pushToast(nextActive ? "Đã bật thông báo" : "Đã tắt thông báo", announcement.title, nextActive ? "success" : "warning");
    } catch (error) {
      handleSaveError(error);
    }
  }

  async function deleteAppAnnouncement(announcement: AppAnnouncement) {
    const confirmed = await openConfirmDialog({
      title: "Xóa thông báo?",
      message: `Thông báo "${announcement.title}" sẽ bị xóa khỏi hệ thống.`,
      confirmText: "Xóa",
      cancelText: "Hủy",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }

    try {
      await saveRequest<{ id: string; deleted: boolean }>("Đang xóa thông báo...", `/api/announcements/${announcement.id}`, {
        method: "DELETE",
      });
      setAppAnnouncements((items) => items.filter((item) => item.id !== announcement.id));
      setDataStatus("connected");
      setSaveError("");
      pushToast("Đã xóa thông báo", announcement.title, "success");
    } catch (error) {
      handleSaveError(error);
    }
  }

  function addLocalAudit(action: string, entityId: string, metadata: Record<string, unknown>) {
    setAuditLogs((items) => [createLocalAuditLog(action, entityId, metadata), ...items]);
  }

  function createLocalAuditLog(action: string, entityId: string, metadata: Record<string, unknown>): AuditLog {
    return {
      id: createId("audit-local"),
      actorId: currentUser.id,
      actorEmail: currentUser.email,
      action,
      entityType: "Schedule",
      entityId,
      metadata: JSON.stringify(metadata),
      createdAt: new Date().toISOString(),
    };
  }

  async function addTeacher() {
    if (!teacherDraft.name || !teacherDraft.email) {
      pushToast("Thiếu thông tin", "Vui lòng nhập Họ tên và Email Google trước khi thêm.", "warning");
      return;
    }

    try {
      const { savedTeachers, savedUsers } = await createTeachersWithAccounts([teacherDraft], "Đang thêm giáo viên...");
      setTeachers((items) => [...savedTeachers, ...items]);
      setAppUsers((items) => [...savedUsers, ...items.filter((item) => !savedUsers.some((saved) => saved.id === item.id))]);
      setDataStatus("connected");
      setSaveError("");
      pushToast("Đã thêm giáo viên", `Đã tạo ${savedTeachers.length} giáo viên và tài khoản liên kết.`, "success");
    } catch (error) {
      handleSaveError(error);
      return;
    }

    setTeacherDraft({ name: "", email: "", phone: "", specialty: "", role: "teacher" });
    setTeacherModalOpen(false);
  }

  async function downloadTeacherSpreadsheetTemplate() {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["Họ tên", "Email Google", "Số điện thoại", "Chuyên môn", "Quyền"],
      ["Nguyễn Văn Admin", "admin@example.com", "0900000001", "Điều phối giáo vụ", "admin"],
      ["Trần Thị Giáo Viên", "giaovien@example.com", "0900000002", "Kỹ năng sống", "giáo viên"],
      ["Lê Thị Trợ Giảng", "trogiang@example.com", "0900000003", "Hỗ trợ lớp học", "trợ giảng"],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Giao vien");
    const fileData = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    const blob = new Blob([fileData], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mau-giao-vien-hoc-vien-mettasoul.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function importTeachersFromSpreadsheet(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) {
      return;
    }

    let rows: TeacherImportDraft[];
    try {
      rows = file.name.toLowerCase().endsWith(".xlsx")
        ? await parseTeacherWorkbook(file)
        : parseTeacherSpreadsheet(await file.text());
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Không đọc được file giáo viên.");
      pushToast("Không đọc được file", "File import giáo viên không đúng định dạng.", "error");
      return;
    }

    if (rows.length === 0) {
      pushToast("Không có dữ liệu", "File import chưa có dòng giáo viên hợp lệ.", "warning");
      return;
    }

    const rowErrors = rows
      .map((row, index) => validateTeacherImportDraft(row, `Dòng ${index + 2}`))
      .filter(Boolean);
    if (rowErrors.length > 0) {
      const preview = rowErrors.slice(0, 3).join(" | ");
      setSaveError(preview);
      pushToast("File còn lỗi dữ liệu", `Có ${rowErrors.length} dòng lỗi. Kiểm tra cột bắt buộc trong file mẫu.`, "warning");
      return;
    }

    const duplicateFileEmails = findDuplicateEmails(rows.map((row) => row.email));
    if (duplicateFileEmails.length > 0) {
      pushToast("Email trùng trong file", `Email trùng: ${duplicateFileEmails.join(", ")}.`, "warning");
      return;
    }

    const existingEmails = new Set([
      ...teachers.map((teacher) => teacher.email.toLowerCase()),
      ...appUsers.map((user) => user.email.toLowerCase()),
    ]);
    const duplicateExisting = rows.filter((row) => existingEmails.has(row.email.toLowerCase()));
    if (duplicateExisting.length > 0) {
      pushToast(
        "Email đã tồn tại",
        `Bỏ trùng giúp bạn: ${duplicateExisting.length} dòng có email đã có trong hệ thống.`,
        "warning",
      );
      rows = rows.filter((row) => !existingEmails.has(row.email.toLowerCase()));
    }

    if (rows.length === 0) {
      return;
    }

    try {
      const { savedTeachers, savedUsers } = await createTeachersWithAccounts(rows, "Đang import giáo viên...");
      setTeachers((items) => [...savedTeachers, ...items]);
      setAppUsers((items) => [...savedUsers, ...items.filter((item) => !savedUsers.some((saved) => saved.id === item.id))]);
      setDataStatus("connected");
      setSaveError("");
      pushToast("Import thành công", `Đã thêm ${savedTeachers.length} giáo viên từ file.`, "success");
      setTeacherModalOpen(false);
    } catch (error) {
      handleSaveError(error);
    }
  }

  async function createTeachersWithAccounts(
    drafts: Array<Pick<TeacherImportDraft, "name" | "email" | "phone" | "specialty" | "role">>,
    progressLabel: string,
  ) {
    const normalized = drafts.map((draft) => ({
      name: draft.name.trim(),
      email: draft.email.trim().toLowerCase(),
      phone: draft.phone.trim(),
      specialty: draft.specialty.trim(),
      role: draft.role,
    }));

    const teacherPayload = normalized.map((draft) => ({
      id: createId("t"),
      name: draft.name,
      email: draft.email,
      phone: draft.phone || "Chưa cập nhật",
      specialty: draft.specialty || "Kỹ năng sống",
      active: true,
    }));

    const teacherResult = await saveRequest<{ teachers: Teacher[] } | Teacher>(progressLabel, "/api/teachers", {
      method: "POST",
      body: JSON.stringify({ teachers: teacherPayload }),
    });
    const savedTeachers = Array.isArray((teacherResult as { teachers?: Teacher[] }).teachers)
      ? ((teacherResult as { teachers: Teacher[] }).teachers ?? [])
      : [teacherResult as Teacher];

    const roleByEmail = new Map(normalized.map((draft) => [draft.email, draft.role] as const));
    const usersPayload = savedTeachers.map((teacher) => ({
      id: `u-${teacher.id}`,
      name: teacher.name,
      email: teacher.email,
      role: roleByEmail.get(teacher.email.toLowerCase()) ?? "teacher",
      teacherId: teacher.id,
      avatarUrl: teacher.avatarUrl,
      isActive: true,
    }));

    const userResult = await saveRequest<{ users: User[] } | User>("Đang tạo tài khoản giáo viên...", "/api/users", {
      method: "POST",
      body: JSON.stringify({ users: usersPayload }),
    });
    const savedUsers = Array.isArray((userResult as { users?: User[] }).users)
      ? ((userResult as { users: User[] }).users ?? [])
      : [userResult as User];

    return { savedTeachers, savedUsers };
  }

  async function updateTeacherRole(teacher: Teacher, nextRole: Role) {
    const linkedUser = userForTeacher(teacher.id);

    try {
      const savedUser = linkedUser
        ? await saveRequest<User>("Đang cập nhật phân quyền...", `/api/users/${linkedUser.id}`, {
            method: "PATCH",
            body: JSON.stringify({ role: nextRole }),
          })
        : await saveRequest<User>("Đang tạo tài khoản...", "/api/users", {
            method: "POST",
            body: JSON.stringify({
              id: `u-${teacher.id}`,
              name: teacher.name,
              email: teacher.email,
              role: nextRole,
              teacherId: teacher.id,
              avatarUrl: teacher.avatarUrl,
              isActive: true,
            }),
          });
      setAppUsers((items) =>
        linkedUser
          ? items.map((item) => (item.id === linkedUser.id ? { ...item, ...savedUser } : item))
          : [savedUser, ...items],
      );
      setDataStatus("connected");
      setSaveError("");
    } catch (error) {
      handleSaveError(error);
    }
  }

  function startEditTeacher(teacher: Teacher) {
    setEditingTeacherId(teacher.id);
    setTeacherEditDraft({
      name: teacher.name,
      email: teacher.email,
      phone: teacher.phone,
      specialty: teacher.specialty,
    });
  }

  function cancelEditTeacher() {
    setEditingTeacherId("");
    setTeacherEditDraft({
      name: "",
      email: "",
      phone: "",
      specialty: "",
    });
  }

  async function saveTeacherEdit(teacherId: string) {
    const name = teacherEditDraft.name.trim();
    const email = teacherEditDraft.email.trim().toLowerCase();
    const phone = teacherEditDraft.phone.trim();
    const specialty = teacherEditDraft.specialty.trim();

    if (!name || !email) {
      handleSaveError(new Error("Họ tên và Email là bắt buộc."));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      handleSaveError(new Error("Email giáo viên không hợp lệ."));
      return;
    }

    try {
      const savedTeacher = await saveRequest<Teacher>("Đang cập nhật giáo viên...", `/api/teachers/${teacherId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          email,
          phone,
          specialty,
        }),
      });
      setTeachers((items) => items.map((item) => (item.id === teacherId ? { ...item, ...savedTeacher } : item)));
      setAppUsers((items) =>
        items.map((item) =>
          item.teacherId === teacherId
            ? {
                ...item,
                name: savedTeacher.name,
                email: savedTeacher.email,
                avatarUrl: savedTeacher.avatarUrl,
                isActive: savedTeacher.active,
              }
            : item,
        ),
      );
      setDataStatus("connected");
      setSaveError("");
      cancelEditTeacher();
      pushToast("Đã cập nhật giáo viên", `Đã lưu thông tin mới cho ${savedTeacher.name}.`, "success");
    } catch (error) {
      handleSaveError(error);
    }
  }

  async function toggleTeacherActive(teacher: Teacher) {
    const linkedUser = userForTeacher(teacher.id);
    const nextActive = !teacher.active;
    const activeAdminCount = appUsers.filter((item) => item.role === "admin" && item.isActive !== false).length;

    if (!nextActive && linkedUser?.role === "admin" && linkedUser.isActive !== false && activeAdminCount <= 1) {
      handleSaveError(new Error("Không thể tắt quản trị viên cuối cùng."));
      return;
    }

    try {
      const savedTeacher = await saveRequest<Teacher>(
        nextActive ? "Đang bật giáo viên..." : "Đang tắt giáo viên...",
        `/api/teachers/${teacher.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ active: nextActive }),
        },
      );
      setTeachers((items) => items.map((item) => (item.id === teacher.id ? { ...item, ...savedTeacher } : item)));
      setAppUsers((items) =>
        items.map((item) =>
          item.teacherId === teacher.id
            ? {
                ...item,
                isActive: savedTeacher.active,
                name: savedTeacher.name,
                email: savedTeacher.email,
                avatarUrl: savedTeacher.avatarUrl,
              }
            : item,
        ),
      );
      setDataStatus("connected");
      setSaveError("");
      pushToast(
        nextActive ? "Đã bật giáo viên" : "Đã tắt giáo viên",
        `${savedTeacher.name} đã được ${nextActive ? "kích hoạt" : "tạm dừng"}.`,
        nextActive ? "success" : "warning",
      );
    } catch (error) {
      handleSaveError(error);
    }
  }

  async function deleteTeacher(teacher: Teacher) {
    const linkedUser = userForTeacher(teacher.id);
    const activeAdminCount = appUsers.filter((item) => item.role === "admin" && item.isActive !== false).length;
    if (linkedUser?.role === "admin" && linkedUser.isActive !== false && activeAdminCount <= 1) {
      handleSaveError(new Error("Không thể xóa quản trị viên cuối cùng."));
      return;
    }

    const confirmed = await openConfirmDialog({
      title: "Xóa giáo viên",
      message: `Bạn chắc chắn muốn xóa giáo viên "${teacher.name}"?`,
      confirmText: "Xóa giáo viên",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }

    try {
      const response = await saveRequest<{ id: string; deleted: boolean; deletedUsers?: string[] }>(
        "Đang xóa giáo viên...",
        `/api/teachers/${teacher.id}`,
        { method: "DELETE" },
      );
      const deletedUserIds = new Set(response.deletedUsers ?? []);
      setTeachers((items) => items.filter((item) => item.id !== teacher.id));
      setAppUsers((items) =>
        items.filter((item) => item.teacherId !== teacher.id && !deletedUserIds.has(item.id) && item.id !== `u-${teacher.id}`),
      );
      if (editingTeacherId === teacher.id) {
        cancelEditTeacher();
      }
      setDataStatus("connected");
      setSaveError("");
      pushToast("Đã xóa giáo viên", `${teacher.name} đã được xóa khỏi hệ thống.`, "warning");
    } catch (error) {
      handleSaveError(error);
    }
  }

  function userForTeacher(teacherId: string) {
    return appUsers.find((user) => user.teacherId === teacherId);
  }

  async function logout() {
    try {
      await saveRequest("Đang đăng xuất...", "/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error(error);
    }
    setAuthStatus("signed-out");
    setSessionUserId("");
    setCurrentUserId(activeUsers.find((user) => user.role === "admin")?.id ?? activeUsers[0]?.id ?? "");
  }

  function markNotificationAsRead(notificationId: string) {
    setNotifications((items) =>
      items.map((item) => (item.id === notificationId ? { ...item, read: true } : item)),
    );
  }

  function markAllRoleNotificationsAsRead() {
    const readableIds = new Set(roleNotifications.filter((item) => !item.read).map((item) => item.id));
    if (readableIds.size === 0) {
      return;
    }

    setNotifications((items) =>
      items.map((item) => (readableIds.has(item.id) ? { ...item, read: true } : item)),
    );
  }

  function updateBulkLessonRow(id: string, patch: Partial<LessonDraft>) {
    setBulkLessonRows((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    setBulkLessonErrors((items) => {
      const next = { ...items };
      delete next[id];
      return next;
    });
  }

  function addBulkLessonRow() {
    setBulkLessonRows((items) => [...items, createBulkLessonRow()]);
  }

  async function downloadLessonSpreadsheetTemplate() {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["Khối", "Tên chuyên đề", "Tên tiết 1", "Mục tiêu tiết 1", "Tên tiết 2", "Mục tiêu tiết 2", "Giáo án mẫu", "Số phút"],
      [
        "Khối 1",
        "Làm quen với cảm xúc",
        "Nhận biết cảm xúc",
        "Nhận biết và gọi tên các cảm xúc cơ bản: vui, buồn, tức giận, sợ hãi.",
        "Chia sẻ cảm xúc",
        "Biết cách chia sẻ cảm xúc của mình với cha mẹ hoặc thầy cô.",
        "https://drive.google.com/",
        "45",
      ],
    ]);
    worksheet["!cols"] = [
      { wch: 12 }, { wch: 30 }, { wch: 30 }, { wch: 58 },
      { wch: 30 }, { wch: 58 }, { wch: 34 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, "Bai hoc");
    const fileData = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    const blob = new Blob([fileData], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mau-bai-hoc-hoc-vien-mettasoul.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function importLessonsFromSpreadsheet(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) {
      return;
    }

    try {
      const rows = file.name.toLowerCase().endsWith(".xlsx")
        ? await parseLessonWorkbook(file)
        : parseLessonSpreadsheet(await file.text());
      const errors = collectBulkLessonErrors(rows, lessons, 2);

      setBulkLessonRows(rows.length > 0 ? rows : [createBulkLessonRow()]);
      setBulkLessonErrors(errors);
      if (Object.keys(errors).length > 0) {
        setSaveError("File spreadsheet còn dòng thiếu dữ liệu. Vui lòng sửa các dòng lỗi trước khi lưu.");
      } else {
        setSaveError("");
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Không đọc được file spreadsheet.");
    }
  }

  function removeBulkLessonRow(id: string) {
    setBulkLessonRows((items) => (items.length === 1 ? [createBulkLessonRow()] : items.filter((item) => item.id !== id)));
    setBulkLessonErrors((items) => {
      const next = { ...items };
      delete next[id];
      return next;
    });
  }

  function pasteBulkLessons(
    rowId: string,
    event: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const rows = parseLessonClipboard(event.clipboardData.getData("text"));
    if (rows.length === 0) {
      return;
    }

    event.preventDefault();
    setBulkLessonRows((items) => {
      const targetIndex = Math.max(0, items.findIndex((item) => item.id === rowId));
      return [
        ...items.slice(0, targetIndex),
        ...rows,
        ...items.slice(targetIndex + 1),
      ];
    });
    setBulkLessonErrors({});
  }

  async function saveBulkLessons() {
    const rowsToSave = bulkLessonRows.filter(hasLessonContent);
    if (rowsToSave.length === 0) {
      setBulkLessonErrors({ [bulkLessonRows[0].id]: "Cần nhập ít nhất một bài học." });
      return;
    }

    const errors = collectBulkLessonErrors(rowsToSave, lessons, 1);

    setBulkLessonErrors(errors);
    if (Object.keys(errors).length > 0) {
      setSaveError("Vui lòng sửa các dòng lỗi trước khi lưu hàng loạt.");
      return;
    }

    try {
      const response = await saveRequest<{ lessons: Lesson[] }>("Đang lưu bài học hàng loạt...", "/api/lessons", {
        method: "POST",
        body: JSON.stringify({ lessons: rowsToSave.map(stripBulkLessonId) }),
      });
      setLessons((items) => [...response.lessons, ...items]);
      setBulkLessonRows([createBulkLessonRow()]);
      setBulkLessonErrors({});
      setDataStatus("connected");
      setSaveError("");
    } catch (error) {
      handleSaveError(error);
    }
  }

  function startEditLesson(lesson: Lesson) {
    setEditingLessonId(lesson.id);
    setLessonEditDraft({
      grade: lesson.grade,
      topicId: lesson.topicId ?? "",
      title: lesson.title,
      lesson1Title: lesson.lesson1Title ?? "Tiết 1",
      lesson1Objective: lesson.lesson1Objective ?? lesson.objective,
      lesson2Title: lesson.lesson2Title ?? "Tiết 2",
      lesson2Objective: lesson.lesson2Objective ?? "",
      samplePlanUrl: lesson.samplePlanUrl ?? "",
      durationMinutes: lesson.durationMinutes,
    });
  }

  async function saveLessonEdit(lessonId: string) {
    const error = validateLessonDraft(lessonEditDraft);
    if (error) {
      setSaveError(error);
      return;
    }

    try {
      const savedLesson = await saveRequest<Lesson>("Đang lưu bài học...", `/api/lessons/${lessonId}`, {
        method: "PATCH",
        body: JSON.stringify(lessonEditDraft),
      });
      setLessons((items) => items.map((item) => (item.id === lessonId ? { ...item, ...savedLesson } : item)));
      setEditingLessonId("");
      setDataStatus("connected");
      setSaveError("");
    } catch (error) {
      handleSaveError(error);
    }
  }

  async function deleteLesson(lessonId: string) {
    try {
      const savedLesson = await saveRequest<Lesson>("Đang xóa bài học...", `/api/lessons/${lessonId}`, {
        method: "PATCH",
        body: JSON.stringify({ active: false }),
      });
      setLessons((items) => items.map((item) => (item.id === lessonId ? { ...item, ...savedLesson, active: false } : item)));
      if (editingLessonId === lessonId) {
        setEditingLessonId("");
      }
      setLessonDeleteTarget(null);
      setDataStatus("connected");
      setSaveError("");
    } catch (error) {
      handleSaveError(error);
    }
  }

  async function addSlot() {
    const error = validateTimeSlotDraft(slotDraft, timeSlots);
    if (error) {
      handleSaveError(new Error(error));
      return;
    }

    const timeSlot = normalizeTimeSlotDraft({ id: createId("ts"), ...slotDraft });

    try {
      const savedTimeSlot = await saveRequest<TimeSlot>("Đang lưu khung giờ...", "/api/time-slots", {
        method: "POST",
        body: JSON.stringify(timeSlot),
      });
      setTimeSlots((items) => [savedTimeSlot, ...items]);
      setDataStatus("connected");
      setSaveError("");
      pushToast("Đã thêm khung giờ", `${savedTimeSlot.label} đã sẵn sàng để giao lịch.`, "success");
    } catch (error) {
      handleSaveError(error);
      return;
    }

    setSlotDraft({ label: "", start: "07:30", end: "08:15" });
  }

  function startEditSlot(slot: TimeSlot) {
    setEditingSlotId(slot.id);
    setSlotEditDraft({
      label: slot.label,
      start: normalizeTimeValue(slot.start) || slot.start,
      end: normalizeTimeValue(slot.end) || slot.end,
      active: slot.active !== false,
    });
  }

  function cancelEditSlot() {
    setEditingSlotId("");
    setSlotEditDraft({ label: "", start: "07:30", end: "08:15", active: true });
  }

  async function saveSlotEdit(slotId: string) {
    const error = validateTimeSlotDraft(slotEditDraft, timeSlots, "Khung giờ", slotId);
    if (error) {
      handleSaveError(new Error(error));
      return;
    }

    try {
      const savedSlot = await saveRequest<TimeSlot>("Đang cập nhật khung giờ...", `/api/time-slots/${slotId}`, {
        method: "PATCH",
        body: JSON.stringify(normalizeTimeSlotDraft(slotEditDraft)),
      });
      setTimeSlots((items) => items.map((item) => (item.id === slotId ? { ...item, ...savedSlot } : item)));
      cancelEditSlot();
      setDataStatus("connected");
      setSaveError("");
      pushToast("Đã cập nhật khung giờ", `${savedSlot.label} đã được lưu.`, "success");
    } catch (error) {
      handleSaveError(error);
    }
  }

  async function toggleSlotActive(slot: TimeSlot) {
    const nextActive = slot.active === false;
    try {
      const savedSlot = await saveRequest<TimeSlot>(
        nextActive ? "Đang bật khung giờ..." : "Đang tắt khung giờ...",
        `/api/time-slots/${slot.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ active: nextActive }),
        },
      );
      setTimeSlots((items) => items.map((item) => (item.id === slot.id ? { ...item, ...savedSlot } : item)));
      setDataStatus("connected");
      setSaveError("");
      pushToast(
        nextActive ? "Đã bật khung giờ" : "Đã tắt khung giờ",
        `${slot.label} ${nextActive ? "có thể chọn khi giao lịch." : "sẽ không còn hiện khi giao lịch mới."}`,
        nextActive ? "success" : "warning",
      );
    } catch (error) {
      handleSaveError(error);
    }
  }

  function toggleSlotSelection(slotId: string, selected: boolean) {
    setSelectedSlotIds((items) =>
      selected ? Array.from(new Set([...items, slotId])) : items.filter((id) => id !== slotId),
    );
  }

  function toggleAllVisibleSlots(slots: TimeSlot[], selected: boolean) {
    const visibleIds = slots.map((slot) => slot.id);
    setSelectedSlotIds((items) => {
      if (selected) {
        return Array.from(new Set([...items, ...visibleIds]));
      }
      const visibleIdSet = new Set(visibleIds);
      return items.filter((id) => !visibleIdSet.has(id));
    });
  }

  function toggleSettingsSection(section: keyof typeof collapsedSettingsSections) {
    setCollapsedSettingsSections((current) => ({ ...current, [section]: !current[section] }));
  }

  async function updateSelectedSlotsActive(nextActive: boolean) {
    const selectedIdSet = new Set(selectedSlotIds);
    const slotsToUpdate = timeSlots.filter((slot) => selectedIdSet.has(slot.id) && (slot.active !== false) !== nextActive);
    if (selectedSlotIds.length === 0) {
      pushToast("Chưa chọn khung giờ", "Chọn ít nhất một khung giờ trước khi bật/tắt hàng loạt.", "warning");
      return;
    }
    if (slotsToUpdate.length === 0) {
      pushToast(
        "Không có thay đổi",
        `Các khung giờ đã chọn đều đang ở trạng thái ${nextActive ? "bật" : "tắt"}.`,
        "info",
      );
      return;
    }

    try {
      const savedSlots: TimeSlot[] = [];
      for (const slot of slotsToUpdate) {
        const savedSlot = await saveRequest<TimeSlot>(
          nextActive ? "Đang bật khung giờ đã chọn..." : "Đang tắt khung giờ đã chọn...",
          `/api/time-slots/${slot.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({ active: nextActive }),
          },
        );
        savedSlots.push(savedSlot);
      }

      const savedById = new Map(savedSlots.map((slot) => [slot.id, slot]));
      setTimeSlots((items) =>
        items.map((item) => {
          const savedSlot = savedById.get(item.id);
          return savedSlot ? { ...item, ...savedSlot } : item;
        }),
      );
      setSelectedSlotIds([]);
      setDataStatus("connected");
      setSaveError("");
      pushToast(
        nextActive ? "Đã bật hàng loạt" : "Đã tắt hàng loạt",
        `Đã cập nhật ${savedSlots.length} khung giờ.`,
        nextActive ? "success" : "warning",
      );
    } catch (error) {
      handleSaveError(error);
    }
  }

  async function deleteSlot(slot: TimeSlot) {
    const linkedSchedules = schedules.filter((schedule) => schedule.timeSlotId === slot.id).length;
    const confirmed = await openConfirmDialog({
      title: "Xóa khung giờ",
      message:
        linkedSchedules > 0
          ? `"${slot.label}" đang có ${linkedSchedules} lịch liên quan. Hệ thống sẽ tắt khung giờ này để giữ lịch sử.`
          : `Bạn chắc chắn muốn xóa mềm khung giờ "${slot.label}"?`,
      confirmText: "Xóa mềm",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }

    try {
      const savedSlot = await saveRequest<TimeSlot>("Đang xóa mềm khung giờ...", `/api/time-slots/${slot.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: false }),
      });
      setTimeSlots((items) => items.map((item) => (item.id === slot.id ? { ...item, ...savedSlot, active: false } : item)));
      if (editingSlotId === slot.id) {
        cancelEditSlot();
      }
      setDataStatus("connected");
      setSaveError("");
      pushToast("Đã xóa mềm khung giờ", `${slot.label} đã được tắt khỏi danh sách giao lịch mới.`, "warning");
    } catch (error) {
      handleSaveError(error);
    }
  }

  async function downloadTimeSlotSpreadsheetTemplate() {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["Tên khung giờ", "Giờ bắt đầu", "Giờ kết thúc", "Số phút", "Trạng thái"],
      ["Tiết 1", "07:30", "08:15", 45, "Bật"],
      ["Ca chuyên đề", "13:30", "15:00", 90, "Bật"],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Khung gio");
    const fileData = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    const blob = new Blob([fileData], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mau-khung-gio-hoc-vien-mettasoul.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function importTimeSlotsFromSpreadsheet(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) {
      return;
    }

    let rows: TimeSlotImportDraft[];
    try {
      rows = file.name.toLowerCase().endsWith(".xlsx")
        ? await parseTimeSlotWorkbook(file)
        : parseTimeSlotSpreadsheet(await file.text());
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Không đọc được file khung giờ.");
      pushToast("Không đọc được file", "File import khung giờ không đúng định dạng.", "error");
      return;
    }

    if (rows.length === 0) {
      pushToast("Không có dữ liệu", "File import chưa có dòng khung giờ hợp lệ.", "warning");
      return;
    }

    const errors = rows
      .map((row, index) => validateTimeSlotDraft(row, timeSlots, `Dòng ${index + 2}`, undefined, row.durationMinutes))
      .filter(Boolean);
    if (errors.length > 0) {
      setSaveError(errors.slice(0, 3).join(" | "));
      pushToast("File còn lỗi dữ liệu", `Có ${errors.length} dòng lỗi. Kiểm tra lại file mẫu khung giờ.`, "warning");
      return;
    }

    const duplicateLabels = findDuplicateValues(rows.map((row) => normalizeTimeSlotLabel(row.label)));
    const duplicateTimes = findDuplicateValues(rows.map((row) => timeSlotDuplicateKey(normalizeTimeSlotDraft(row))));
    if (duplicateLabels.length > 0 || duplicateTimes.length > 0) {
      pushToast("Dữ liệu bị trùng", "File có khung giờ trùng tên hoặc trùng giờ bắt đầu/kết thúc.", "warning");
      return;
    }

    try {
      const response = await saveRequest<{ timeSlots: TimeSlot[] } | TimeSlot>("Đang import khung giờ...", "/api/time-slots", {
        method: "POST",
        body: JSON.stringify({ timeSlots: rows.map((row) => normalizeTimeSlotDraft({ ...row, id: createId("ts") })) }),
      });
      const savedSlots = Array.isArray((response as { timeSlots?: TimeSlot[] }).timeSlots)
        ? ((response as { timeSlots: TimeSlot[] }).timeSlots ?? [])
        : [response as TimeSlot];
      setTimeSlots((items) => [...savedSlots, ...items]);
      setDataStatus("connected");
      setSaveError("");
      pushToast("Import thành công", `Đã thêm ${savedSlots.length} khung giờ từ file.`, "success");
    } catch (error) {
      handleSaveError(error);
    }
  }

  async function addSchool() {
    if (!schoolDraft.name.trim()) {
      handleSaveError(new Error("Tên trường là bắt buộc."));
      return;
    }

    try {
      const savedSchool = await saveRequest<School>("Đang lưu trường...", "/api/schools", {
        method: "POST",
        body: JSON.stringify({
          name: schoolDraft.name.trim(),
          district: schoolDraft.district.trim(),
        }),
      });
      setSchools((items) => [savedSchool, ...items.filter((item) => item.id !== savedSchool.id)]);
      setClassDraft((current) => ({ ...current, schoolId: savedSchool.id }));
      setDraftSchedule((current) => ({ ...current, schoolId: savedSchool.id }));
      setDataStatus("connected");
      setSaveError("");
    } catch (error) {
      handleSaveError(error);
      return;
    }

    setSchoolDraft({ name: "", district: "" });
  }

  async function addClassRoom() {
    if (!classDraft.schoolId || !classDraft.name.trim()) {
      handleSaveError(new Error("Thiếu thông tin lớp cần tạo."));
      return;
    }

    try {
      const response = await saveRequest<ClassCreateResponse>("Đang lưu lớp...", "/api/classes", {
        method: "POST",
        body: JSON.stringify({
          schoolId: classDraft.schoolId,
          names: classDraft.name.trim(),
        }),
      });
      const savedClasses = Array.isArray((response as { classes?: ClassRoom[] }).classes)
        ? (response as { classes: ClassRoom[] }).classes
        : [response as ClassRoom];
      setClasses((items) => [
        ...savedClasses,
        ...items.filter((item) => !savedClasses.some((savedClass) => savedClass.id === item.id)),
      ]);
      const firstSavedClass = savedClasses[0];
      if (firstSavedClass) {
        setDraftSchedule((current) => ({
          ...current,
          schoolId: firstSavedClass.schoolId,
          classId: firstSavedClass.id,
        }));
      }
      setDataStatus("connected");
      setSaveError("");
    } catch (error) {
      handleSaveError(error);
      return;
    }

    setClassDraft((current) => ({ ...current, name: "" }));
  }

  function startEditSchool(school: School) {
    setEditingSchoolId(school.id);
    setSchoolEditDraft({
      name: school.name,
      district: school.district,
    });
  }

  function cancelEditSchool() {
    setEditingSchoolId("");
    setSchoolEditDraft({ name: "", district: "" });
  }

  async function saveSchoolEdit(schoolId: string) {
    if (!schoolEditDraft.name.trim()) {
      handleSaveError(new Error("Tên trường là bắt buộc."));
      return;
    }

    try {
      const updated = await saveRequest<School>("Đang cập nhật trường...", `/api/schools/${schoolId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: schoolEditDraft.name.trim(),
          district: schoolEditDraft.district.trim(),
        }),
      });
      setSchools((items) => items.map((item) => (item.id === schoolId ? { ...item, ...updated } : item)));
      setDataStatus("connected");
      setSaveError("");
      cancelEditSchool();
    } catch (error) {
      handleSaveError(error);
    }
  }

  async function deleteSchool(schoolId: string) {
    const confirmed = await openConfirmDialog({
      title: "Xóa trường",
      message: "Bạn chắc chắn muốn xóa trường này? Tất cả lớp thuộc trường cũng sẽ bị xóa.",
      confirmText: "Xóa trường",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }

    try {
      await saveRequest("Đang xóa trường...", `/api/schools/${schoolId}`, {
        method: "DELETE",
      });
      setSchools((items) => items.filter((item) => item.id !== schoolId));
      setClasses((items) => items.filter((item) => item.schoolId !== schoolId));
      setDataStatus("connected");
      setSaveError("");
      if (editingSchoolId === schoolId) {
        cancelEditSchool();
      }
      pushToast("Đã xóa trường", "Trường và các lớp liên quan đã được xóa.", "warning");
    } catch (error) {
      handleSaveError(error);
    }
  }

  function startEditClassRoom(classRoom: ClassRoom) {
    setEditingClassId(classRoom.id);
    setClassEditDraft({
      schoolId: classRoom.schoolId,
      name: classRoom.name,
      grade: classRoom.grade,
    });
  }

  function cancelEditClassRoom() {
    setEditingClassId("");
    setClassEditDraft({ schoolId: "", name: "", grade: "Khối 1" });
  }

  async function saveClassRoomEdit(classId: string) {
    if (!classEditDraft.schoolId || !classEditDraft.name.trim() || !classEditDraft.grade.trim()) {
      handleSaveError(new Error("Thiếu thông tin bắt buộc của lớp."));
      return;
    }

    try {
      const updated = await saveRequest<ClassRoom>("Đang cập nhật lớp...", `/api/classes/${classId}`, {
        method: "PATCH",
        body: JSON.stringify({
          schoolId: classEditDraft.schoolId,
          name: classEditDraft.name.trim(),
          grade: classEditDraft.grade.trim(),
        }),
      });
      setClasses((items) => items.map((item) => (item.id === classId ? { ...item, ...updated } : item)));
      setDataStatus("connected");
      setSaveError("");
      cancelEditClassRoom();
    } catch (error) {
      handleSaveError(error);
    }
  }

  async function deleteClassRoom(classId: string) {
    const confirmed = await openConfirmDialog({
      title: "Xóa lớp",
      message: "Bạn chắc chắn muốn xóa lớp này khỏi hệ thống?",
      confirmText: "Xóa lớp",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }

    try {
      await saveRequest("Đang xóa lớp...", `/api/classes/${classId}`, {
        method: "DELETE",
      });
      setClasses((items) => items.filter((item) => item.id !== classId));
      setDataStatus("connected");
      setSaveError("");
      if (editingClassId === classId) {
        cancelEditClassRoom();
      }
      pushToast("Đã xóa lớp", "Lớp đã được xóa khỏi hệ thống.", "warning");
    } catch (error) {
      handleSaveError(error);
    }
  }

  function teacherName(teacherId: string) {
    return teachers.find((teacher) => teacher.id === teacherId)?.name ?? "Giáo viên";
  }

  function renderMain() {
    if (activeTab === "dashboard") {
      return Dashboard();
    }
    if (activeTab === "assignment") {
      return AssignmentPanel();
    }
    if (activeTab === "calendar") {
      return CalendarPanel();
    }
    if (activeTab === "teachers") {
      return TeachersPanel();
    }
    if (activeTab === "lessons") {
      return LessonsPanel();
    }
    if (activeTab === "plans") {
      return LessonPlansPanel();
    }
    if (activeTab === "attendance") {
      return AttendancePanel();
    }
    if (activeTab === "weekly-updates") {
      return WeeklyUpdatesPanel();
    }
    return SettingsPanel();
  }

  function changeTab(tabId: TabId) {
    startTabTransition(() => {
      setActiveTab(tabId);
    });
    setMobileSidebarOpen(false);
  }

  function resetCalendarFilters() {
    setCalendarFilters({
      ...defaultCalendarFilters,
      teacherId: isTeachingStaff && currentTeacherId ? currentTeacherId : "all",
    });
  }

  return (
    <main className="ui-polish min-h-screen overflow-x-hidden bg-[var(--canvas)]">
      <div className="ui-enter grid min-h-screen lg:grid-cols-[280px_1fr]">
        {mobileSidebarOpen ? (
          <button
            type="button"
            aria-label="Đóng menu"
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-sm lg:hidden"
          />
        ) : null}
        <aside
          className={`ui-shell-sidebar fixed inset-y-0 left-0 z-50 w-[min(86vw,320px)] overflow-y-auto border-r border-white/70 px-4 py-5 shadow-[16px_0_44px_rgba(18,46,68,0.16)] transition-transform duration-300 lg:static lg:z-auto lg:w-auto lg:translate-x-0 lg:overflow-visible ${
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center gap-3 px-2">
            <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm">
              <img src="/mettasoul-logo.png" alt="METTASOUL" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-extrabold tracking-tight text-[var(--brand-dark)]">METTASOUL</p>
              <p className="text-xs font-semibold text-[var(--muted)]">Education with love</p>
            </div>
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              aria-label="Đóng menu"
              className="ml-auto grid h-10 w-10 place-items-center rounded-xl bg-cyan-50 text-[var(--brand-dark)] lg:hidden"
            >
              <X size={18} />
            </button>
          </div>

          <div className="ui-surface-lift mt-6 rounded-2xl border p-3">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase text-[var(--brand-dark)]">Tài khoản</span>
              {hasAdminAccess ? (
                <select
                  value={currentUser.id}
                  onChange={(event) => setCurrentUserId(event.target.value)}
                  className="w-full rounded-xl border border-cyan-100 bg-white px-3 py-2 text-sm font-bold text-[var(--brand-dark)] outline-none"
                >
                  {activeUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} - {roleLabel(user.role)}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="w-full rounded-xl border border-cyan-100 bg-slate-50 px-3 py-2 text-sm font-bold text-[var(--brand-dark)]">
                  {currentUser.name} - {roleLabel(currentUser.role)}
                </div>
              )}
            </label>
            <div className="mt-3 rounded-xl bg-gradient-to-r from-emerald-50 to-cyan-50 px-3 py-2 text-xs font-black text-[var(--brand-dark)]">
              Quyền {roleLabel(role).toLowerCase()}
            </div>
            <div className="mt-3">
              {authStatus === "signed-in" ? (
                <button
                  onClick={logout}
                  className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-white/80 bg-white/85 px-3 text-xs font-black text-[var(--brand-dark)] shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50"
                >
                  Đăng xuất
                </button>
              ) : (
                <a
                  href="/api/auth/google"
                  className="ui-primary-gradient inline-flex h-10 w-full items-center justify-center rounded-xl px-3 text-xs font-black text-white transition"
                >
                  Google Login
                </a>
              )}
            </div>
          </div>

          <nav className="mt-5 space-y-1">
            {navigationTabs.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-bold transition ${
                    activeTab === item.id
                      ? "bg-gradient-to-r from-[var(--brand)] via-[var(--mint)] to-[var(--sky)] text-white shadow-lg shadow-cyan-800/20"
                      : "text-[var(--brand-dark)] hover:bg-white hover:text-[var(--brand-dark)] hover:shadow-md hover:shadow-cyan-900/5"
                  }`}
                  onClick={() => changeTab(item.id)}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                  {activeTab === item.id ? <ChevronRight className="ml-auto" size={16} /> : null}
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0">
          <header className="ui-glass-header sticky top-0 z-20 border-b border-white/70 px-4 py-4 backdrop-blur-xl md:px-7">
            <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(true)}
                  aria-label="Mở menu"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-cyan-100 bg-white text-[var(--brand-dark)] shadow-sm lg:hidden"
                >
                  <Menu size={20} />
                </button>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[var(--brand-dark)]">
                    {role === "admin" ? "Bàn điều phối giáo vụ" : role === "assistant" ? "Lịch trợ giảng" : "Công việc của giáo viên"}
                  </p>
                  <h1 className="mt-1 truncate text-xl font-black tracking-tight md:text-3xl">
                    <span className="sm:hidden">{activeTabMeta?.label ?? "Mettasoul"}</span>
                    <span className="hidden sm:inline">Quản lý lịch dạy, giáo án và điểm danh</span>
                  </h1>
                </div>
              </div>

              <div className="grid gap-3 sm:flex sm:flex-row sm:items-center">
                <label className="hidden min-w-0 items-center gap-2 rounded-2xl border border-sky-200 bg-white/85 px-3 py-2 shadow-sm transition focus-within:border-violet-300 focus-within:shadow-lg focus-within:shadow-cyan-900/10 sm:flex">
                  <Search size={17} className="text-[var(--muted)]" />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder={searchPlaceholder}
                    className="min-w-0 bg-transparent text-sm text-[var(--brand-dark)] outline-none placeholder:text-slate-400"
                  />
                </label>
                {isTeachingStaff ? (
                  <button
                    type="button"
                    title="Góp ý nâng cấp"
                    onClick={() => setFeedbackModalOpen(true)}
                    className="inline-flex h-11 items-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-3 text-xs font-black text-violet-800 transition hover:bg-violet-100"
                  >
                    <MessageSquare size={16} />
                    Góp ý
                  </button>
                ) : null}
                <div className="ui-surface-lift hidden items-center gap-2 rounded-2xl border px-3 py-2 sm:flex">
                  <img
                    alt={currentUser.name}
                    src={currentUser.avatarUrl}
                    className="h-9 w-9 rounded-full object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-[var(--brand-dark)]">{currentUser.name}</p>
                    <p className="truncate text-xs text-[var(--muted)]">{currentUser.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:hidden">
                  <div className="ui-surface-lift flex min-w-0 flex-1 items-center gap-2 rounded-2xl border px-3 py-2">
                    <img alt={currentUser.name} src={currentUser.avatarUrl} className="h-9 w-9 rounded-full object-cover" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-[var(--brand-dark)]">{currentUser.name}</p>
                      <p className="truncate text-xs text-[var(--muted)]">{currentUser.email}</p>
                    </div>
                  </div>
                </div>
                <div ref={notificationPanelRef} className="absolute right-0 top-0 z-30 sm:static">
                  <button
                    type="button"
                    title="Thông báo"
                    aria-label="Mở danh sách thông báo"
                    aria-expanded={notificationPanelOpen}
                    onClick={() => setNotificationPanelOpen((open) => !open)}
                    className="relative grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-white shadow-lg shadow-orange-500/25"
                  >
                    <Bell size={18} />
                    {unreadNotifications > 0 ? (
                      <span className="ui-notification-dot absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[11px] font-black">
                        {unreadNotifications}
                      </span>
                    ) : null}
                  </button>
                  {notificationPanelOpen ? (
                    <div className="absolute right-0 top-14 z-40 w-[min(92vw,420px)] rounded-2xl border border-cyan-100 bg-white/95 p-3 shadow-2xl shadow-cyan-900/15 backdrop-blur">
                      <div className="mb-2 flex items-center justify-between gap-2 px-1">
                        <div>
                          <p className="text-sm font-black text-[var(--brand-dark)]">Thông báo</p>
                          <p className="text-xs font-semibold text-[var(--muted)]">
                            {unreadNotifications} chưa đọc / {roleNotifications.length} tổng
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={markAllRoleNotificationsAsRead}
                          className="rounded-lg bg-cyan-50 px-2 py-1 text-[11px] font-black text-cyan-800 transition hover:bg-cyan-100"
                        >
                          Đánh dấu đã đọc
                        </button>
                      </div>
                      <div className="app-scrollbar max-h-96 space-y-2 overflow-y-auto pr-1">
                        {roleNotifications.length === 0 ? (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm font-semibold text-slate-600">
                            Chưa có thông báo nào.
                          </div>
                        ) : (
                          roleNotifications.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => markNotificationAsRead(item.id)}
                              className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                                item.read
                                  ? "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                                  : "border-cyan-200 bg-cyan-50/80 text-[var(--brand-dark)] hover:bg-cyan-100/80"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-sm font-extrabold">{item.title}</p>
                                {!item.read ? <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-rose-500" /> : null}
                              </div>
                              <p className="mt-1 text-xs font-semibold text-[var(--muted)]">{item.body}</p>
                              <p className="mt-2 text-[11px] font-bold text-slate-500">{formatDateTime(item.createdAt)}</p>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </header>

          <AnnouncementTicker announcements={activeAppAnnouncements} />
          <div className="px-3 pb-28 pt-4 sm:px-4 md:p-7">{renderMain()}</div>
          <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-cyan-100 bg-white/95 px-2 py-2 shadow-[0_-18px_42px_rgba(18,46,68,0.12)] backdrop-blur-xl lg:hidden">
            <div className="app-scrollbar flex gap-2 overflow-x-auto pb-[env(safe-area-inset-bottom)]">
              {navigationTabs.map((item) => {
                const Icon = item.icon;
                const selected = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => changeTab(item.id)}
                    className={`flex min-w-[78px] flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-[11px] font-black transition ${
                      selected
                        ? "bg-[var(--brand)] text-white shadow-lg shadow-cyan-900/20"
                        : "bg-cyan-50 text-[var(--brand-dark)]"
                    }`}
                  >
                    <Icon size={17} />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
          <SystemFeedbackLayer
            pendingAction={pendingAction}
            toastMessages={toastMessages}
            centerFeedback={centerFeedback}
            onDismissToast={dismissToast}
          />
          {feedbackModalOpen ? (
            <div className="app-modal-overlay z-[70] grid place-items-center overflow-hidden bg-slate-950/35 p-4 backdrop-blur-sm">
              <div className="app-modal-panel w-full max-w-2xl rounded-3xl border border-violet-200 bg-white p-5 shadow-2xl">
                <div className="flex shrink-0 items-start justify-between gap-3">
                  <div>
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-100 text-violet-700">
                      <MessageSquare size={22} />
                    </div>
                    <h2 className="mt-4 text-xl font-black text-[var(--brand-dark)]">Góp ý nâng cấp tính năng</h2>
                    <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
                      Mô tả rõ nhu cầu và luồng thao tác mong muốn để đội vận hành cập nhật nhanh hơn.
                    </p>
                  </div>
                  <button
                    type="button"
                    title="Đóng"
                    onClick={() => setFeedbackModalOpen(false)}
                    className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--line)] bg-white text-[var(--brand-dark)] transition hover:bg-violet-50"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div data-modal-scroll="true" className="app-scrollbar app-modal-scroll mt-5 -mx-1 px-1">
                  <div className="grid gap-3">
                    <input
                      value={feedbackDraft.upgradeTarget}
                      onChange={(event) => setFeedbackDraft((current) => ({ ...current, upgradeTarget: event.target.value }))}
                      placeholder="Cập nhật/nâng cấp tính năng nào?"
                      className={inputClass}
                    />
                    <div className="grid gap-2">
                      <select
                        value={feedbackDraft.menuName}
                        onChange={(event) => setFeedbackDraft((current) => ({ ...current, menuName: event.target.value }))}
                        className={inputClass}
                      >
                        <option value="">Chọn menu/phân hệ</option>
                        {feedbackMenuSuggestions.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs font-bold text-[var(--muted)]">Bạn cũng có thể chọn menu gần nhất với nghiệp vụ cần nâng cấp.</p>
                    </div>
                    <textarea
                      value={feedbackDraft.desiredFlow}
                      onChange={(event) => setFeedbackDraft((current) => ({ ...current, desiredFlow: event.target.value }))}
                      placeholder="Quy trình mong muốn (ví dụ: bấm A ra B, bấm B ra C)."
                      rows={5}
                      className={`${inputClass} resize-y`}
                    />
                  </div>

                  <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50/65 p-3">
                    <p className="text-xs font-black uppercase text-violet-800">Gợi ý điền nhanh</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {feedbackFlowExamples.map((example) => (
                        <button
                          key={example}
                          type="button"
                          onClick={() => setFeedbackDraft((current) => ({ ...current, desiredFlow: example }))}
                          className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-left text-xs font-bold text-violet-800 transition hover:bg-violet-100"
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex shrink-0 justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setFeedbackModalOpen(false)}
                    className="inline-flex items-center rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-black text-[var(--brand-dark)] transition hover:bg-violet-50"
                  >
                    Hủy
                  </button>
                  <button type="button" onClick={submitFeedback} disabled={isBusy} className={primaryButtonClass}>
                    <Send size={16} />
                    Gửi feedback
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {teacherModalOpen ? (
            <div className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-slate-950/35 p-4 backdrop-blur-sm">
              <div
                data-modal-scroll="true"
                className="app-scrollbar max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-3xl border border-cyan-100 bg-white p-5 shadow-2xl"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-50 text-[var(--brand-dark)]">
                      <UserPlus size={22} />
                    </div>
                    <h2 className="mt-4 text-xl font-black text-[var(--brand-dark)]">Thêm giáo viên</h2>
                    <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
                      Nhập thủ công một giáo viên hoặc import hàng loạt bằng file mẫu.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTeacherModalOpen(false)}
                    className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--line)] bg-white text-[var(--brand-dark)] transition hover:bg-cyan-50"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-5 grid gap-3">
                  <input
                    value={teacherDraft.name}
                    onChange={(event) => setTeacherDraft({ ...teacherDraft, name: event.target.value })}
                    placeholder="Họ tên"
                    className={inputClass}
                  />
                  <input
                    value={teacherDraft.email}
                    onChange={(event) => setTeacherDraft({ ...teacherDraft, email: event.target.value })}
                    placeholder="Email Google"
                    className={inputClass}
                  />
                  <input
                    value={teacherDraft.phone}
                    onChange={(event) => setTeacherDraft({ ...teacherDraft, phone: event.target.value })}
                    placeholder="Số điện thoại"
                    className={inputClass}
                  />
                  <input
                    value={teacherDraft.specialty}
                    onChange={(event) => setTeacherDraft({ ...teacherDraft, specialty: event.target.value })}
                    placeholder="Chuyên môn"
                    className={inputClass}
                  />
                  <select
                    value={teacherDraft.role}
                    onChange={(event) => setTeacherDraft({ ...teacherDraft, role: event.target.value as Role })}
                    className={inputClass}
                  >
                    <option value="teacher">Quyền giáo viên</option>
                    <option value="assistant">Quyền trợ giảng</option>
                    <option value="admin">Quyền quản trị</option>
                  </select>
                </div>

                <div className="mt-5 rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4">
                  <p className="text-xs font-black uppercase text-[var(--brand-dark)]">Import Excel nhanh</p>
                  <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
                    File mẫu có sẵn 2 dòng ví dụ cho quyền admin và giáo viên.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={downloadTeacherSpreadsheetTemplate} className={ghostButtonClass}>
                      <Download size={15} />
                      Tải mẫu Excel
                    </button>
                    <label className={`${ghostButtonClass} cursor-pointer`}>
                      <FileSpreadsheet size={15} />
                      Import file
                      <input
                        type="file"
                        accept=".xlsx,.csv,.tsv,text/csv,text/tab-separated-values,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        className="hidden"
                        onChange={importTeachersFromSpreadsheet}
                      />
                    </label>
                  </div>
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setTeacherModalOpen(false)}
                    disabled={isBusy}
                    className="inline-flex h-11 items-center rounded-xl border border-[var(--line)] bg-white px-4 text-sm font-black text-[var(--brand-dark)] transition hover:bg-cyan-50 disabled:opacity-60"
                  >
                    Hủy
                  </button>
                  <button type="button" onClick={addTeacher} disabled={isBusy} className={primaryButtonClass}>
                    {isBusy ? <LoaderCircle className="animate-spin" size={17} /> : <UserPlus size={17} />}
                    Lưu giáo viên
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {lessonDeleteTarget ? (
            <div className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-slate-950/35 p-4 backdrop-blur-sm">
              <div
                data-modal-scroll="true"
                className="app-scrollbar max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-3xl border border-rose-100 bg-white p-5 shadow-2xl"
              >
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-rose-700">
                  <Trash2 size={22} />
                </div>
                <h2 className="mt-4 text-xl font-black text-[var(--brand-dark)]">Xác nhận xóa bài học</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Bài “{lessonDeleteTarget.title}” sẽ bị ẩn khỏi thư viện và không còn hiện khi giao lịch mới.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    onClick={() => setLessonDeleteTarget(null)}
                    disabled={isBusy}
                    className="inline-flex h-11 items-center rounded-xl border border-[var(--line)] bg-white px-4 text-sm font-black text-[var(--brand-dark)] transition hover:bg-cyan-50 disabled:opacity-60"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={() => deleteLesson(lessonDeleteTarget.id)}
                    disabled={isBusy}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-black text-white shadow-lg shadow-rose-700/20 transition hover:bg-rose-700 disabled:opacity-60"
                  >
                    {isBusy ? <LoaderCircle className="animate-spin" size={17} /> : <Trash2 size={17} />}
                    Xóa bài học
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {reassignTarget ? (
            <div className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-slate-950/35 p-4 backdrop-blur-sm">
              <div
                data-modal-scroll="true"
                className="app-scrollbar max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-3xl border border-cyan-100 bg-white p-5 shadow-2xl"
              >
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-50 text-[var(--brand-dark)]">
                  <RefreshCcw size={22} />
                </div>
                <h2 className="mt-4 text-xl font-black text-[var(--brand-dark)]">Chuyển lịch dạy</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Chọn giáo viên mới cho lịch {formatScheduleDateTime(reassignTarget)}. Hệ thống sẽ cập nhật Google Sheet
                  và gửi email xác nhận cho giáo viên mới.
                </p>
                <div className="mt-5 grid gap-2">
                  <span className="text-xs font-black uppercase text-[var(--brand-dark)]">Giáo viên thay thế</span>
                  <select
                    value={reassignTeacherId}
                    onChange={(event) => setReassignTeacherId(event.target.value)}
                    className={inputClass}
                  >
                    {activeTeachers
                      .filter((teacher) => teacher.id !== reassignTarget.teacherId)
                      .map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacher.name} - {teacher.specialty}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setReassignTarget(null);
                      setReassignTeacherId("");
                    }}
                    disabled={isBusy}
                    className="inline-flex h-11 items-center rounded-xl border border-[var(--line)] bg-white px-4 text-sm font-black text-[var(--brand-dark)] transition hover:bg-cyan-50 disabled:opacity-60"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={submitReassignSchedule}
                    disabled={isBusy || !reassignTeacherId}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--brand)] px-4 text-sm font-black text-white shadow-lg shadow-cyan-700/20 transition hover:bg-[var(--brand-dark)] disabled:opacity-60"
                  >
                    {isBusy ? <LoaderCircle className="animate-spin" size={17} /> : <RefreshCcw size={17} />}
                    Chuyển lịch
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {selectedOperationalAlert ? (
            <div className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-slate-950/35 p-4 backdrop-blur-sm">
              <div
                data-modal-scroll="true"
                className="app-scrollbar max-h-[calc(100dvh-2rem)] w-full max-w-5xl overflow-y-auto overscroll-contain rounded-3xl border border-orange-100 bg-white p-5 shadow-2xl ring-1 ring-cyan-100"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-50 text-[var(--accent)]">
                      <Bell size={22} />
                    </div>
                    <h2 className="mt-4 text-xl font-black text-[var(--brand-dark)]">{selectedOperationalAlert.title}</h2>
                    <p className="mt-1 text-sm font-bold text-[var(--muted)]">{selectedOperationalAlert.body}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedOperationalAlert(null)}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--line)] bg-white text-[var(--brand-dark)] transition hover:bg-orange-50"
                    aria-label="Đóng chi tiết cảnh báo"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-5 grid gap-2">
                  <div className="hidden rounded-2xl border border-cyan-100 bg-cyan-50/70 px-4 py-3 text-[11px] font-black uppercase text-[var(--brand-dark)] md:grid md:grid-cols-[170px_150px_110px_1fr_1.4fr] md:gap-3">
                    <span>Ngày/giờ dạy</span>
                    <span>Giáo viên</span>
                    <span>Lớp</span>
                    <span>Trường</span>
                    <span>Tên chuyên đề</span>
                  </div>
                  {selectedOperationalAlertSchedules.length > 0 ? (
                    selectedOperationalAlertSchedules.map((schedule) => {
                      const meta = lookupSchedule(schedule);

                      return (
                        <button
                          key={schedule.id}
                          type="button"
                          onClick={() => {
                            setSelectedOperationalAlert(null);
                            setSelectedScheduleDetail(schedule);
                          }}
                          className="grid gap-2 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-left shadow-sm transition hover:border-orange-200 hover:bg-orange-50/30 hover:shadow-md md:grid-cols-[170px_150px_110px_1fr_1.4fr] md:gap-3"
                        >
                          <span className="text-sm font-black text-[var(--accent)]">{formatScheduleDateTime(schedule)}</span>
                          <span className="text-sm font-black text-[var(--brand-dark)]">{meta.teacher?.name || "Chưa rõ"}</span>
                          <span className="inline-flex w-fit rounded-full bg-orange-50 px-2 py-1 text-xs font-black text-orange-800">
                            {meta.classRoom?.name || "Chưa rõ"}
                          </span>
                          <span className="text-sm font-bold text-cyan-800">{meta.school?.name || "Chưa rõ"}</span>
                          <span className="text-sm font-black leading-5 text-[var(--brand-dark)]">
                            {meta.lesson?.title || "Chưa rõ chuyên đề"}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm font-bold text-slate-600">
                      Không còn lịch phù hợp với cảnh báo trong bộ lọc hiện tại.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
          {selectedScheduleDetail && typeof document !== "undefined" ? createPortal(
            <div className="app-modal-overlay z-50 grid place-items-center overflow-hidden bg-slate-950/35 p-4 backdrop-blur-sm">
              <div className="app-modal-panel w-full max-w-3xl rounded-3xl border border-cyan-100 bg-white p-5 shadow-2xl ring-1 ring-orange-100">
                {(() => {
                  const meta = lookupSchedule(selectedScheduleDetail);
                  const detailCards = [
                    {
                      label: "Trạng thái",
                      value: statusLabels[selectedScheduleDetail.status],
                      tone: scheduleStatusTone(selectedScheduleDetail.status),
                    },
                    {
                      label: "Điểm danh",
                      value: meta.checkIn ? `Đã điểm danh ${formatDateTime(meta.checkIn.checkedInAt)}` : "Chưa điểm danh",
                      tone: meta.checkIn ? "emerald" : "amber",
                    },
                    {
                      label: "Khung giờ",
                      value: `${meta.slot?.label || ""} ${meta.slot?.start || ""}-${meta.slot?.end || ""}`,
                      tone: "indigo",
                    },
                    {
                      label: "Lớp",
                      value: formatScheduleParticipantClassNames(meta.participantClasses, meta.classRoom),
                      tone: "orange",
                    },
                    {
                      label: "Trường",
                      value: meta.school?.name || "Chưa rõ",
                      tone: "cyan",
                    },
                    {
                      label: "Giáo viên",
                      value: `${meta.teacher?.name || "Chưa rõ"} - ${meta.teacher?.phone || "Chưa cập nhật"}`,
                      tone: "slate",
                    },
                    ...(meta.coTeachers.length > 0
                      ? [{
                          label: "Giáo viên đồng giảng",
                          value: meta.coTeachers.map((teacher) => teacher.name).join(", "),
                          tone: "violet" as const,
                        }]
                      : []),
                  ] as const;
                  return (
                    <>
                      <div className="flex shrink-0 items-start justify-between gap-4">
                        <div>
                          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-50 text-[var(--accent)]">
                            <CalendarDays size={22} />
                          </div>
                          <h2 className="mt-4 text-xl font-black text-[var(--brand-dark)]">{meta.lesson?.title || "Chi tiết lịch dạy"}</h2>
                          <p className="mt-1 text-sm font-bold text-[var(--muted)]">
                            {formatScheduleDateTime(selectedScheduleDetail)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedScheduleDetail(null)}
                          className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--line)] bg-white text-[var(--brand-dark)] transition hover:bg-cyan-50"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      <div data-modal-scroll="true" className="app-scrollbar app-modal-scroll mt-5 -mx-1 px-1">
                        <div className="grid gap-3 md:grid-cols-2">
                          {detailCards.map((card) => (
                            <InfoBlock key={card.label} label={card.label} value={card.value} tone={card.tone} />
                          ))}
                        </div>

                        <div className="mt-5 rounded-2xl border border-cyan-100 bg-cyan-50/50 p-4">
                          <p className="text-xs font-black uppercase text-[var(--brand-dark)]">Mục tiêu bài học</p>
                          <div className="mt-3 space-y-2">
                            {splitObjectiveLines(meta.lesson?.objective || "").map((line, index) => (
                              <div
                                key={`${line}-${index}`}
                                className={`rounded-xl border border-orange-100 bg-white px-3 py-2 text-sm font-bold leading-6 shadow-sm ${/^Tiết\s*[12]\s*[-:]/i.test(line) ? "text-orange-600" : "text-[var(--brand-dark)]"}`}
                              >
                                {line}
                              </div>
                            ))}
                          </div>
                        </div>

                        {meta.plans.length > 0 ? (
                          <div className="mt-5 rounded-2xl border border-[var(--line)] bg-white p-4">
                            <p className="text-xs font-black uppercase text-[var(--brand-dark)]">Giáo án đã tải</p>
                            <div className="mt-3 grid gap-2">
                              {meta.plans.map((plan) => (
                                <a
                                  key={plan.id}
                                  href={plan.driveUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-xl bg-cyan-50 px-3 py-2 text-sm font-black text-[var(--brand-dark)]"
                                >
                                  {plan.fileName}
                                </a>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>,
            document.body,
          ) : null}
          {appDialog && typeof document !== "undefined"
            ? createPortal(
            <div
              className={`app-modal-overlay fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-slate-950/45 p-4 backdrop-blur-sm transition-opacity duration-200 ${
                appDialog.leaving ? "opacity-0" : "opacity-100"
              }`}
            >
              <div
                data-modal-scroll="true"
                role="dialog"
                aria-modal="true"
                aria-labelledby={`app-dialog-title-${appDialog.id}`}
                aria-describedby={`app-dialog-message-${appDialog.id}`}
                className={`app-modal-panel app-scrollbar max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-3xl border bg-white p-5 shadow-2xl transition duration-200 ${
                  appDialog.leaving ? "translate-y-2 scale-[0.98] opacity-0" : "translate-y-0 scale-100 opacity-100"
                } ${appDialog.tone === "danger" ? "border-rose-100" : "border-cyan-100"}`}
              >
                <div
                  className={`grid h-12 w-12 place-items-center rounded-2xl ${
                    appDialog.tone === "danger" ? "bg-rose-50 text-rose-700" : "bg-cyan-50 text-[var(--brand-dark)]"
                  }`}
                >
                  {appDialog.tone === "danger" ? <Trash2 size={20} /> : <Pencil size={20} />}
                </div>
                <h2 id={`app-dialog-title-${appDialog.id}`} className="mt-4 text-xl font-black text-[var(--brand-dark)]">{appDialog.title}</h2>
                <p id={`app-dialog-message-${appDialog.id}`} className="mt-2 text-sm leading-6 text-[var(--muted)]">{appDialog.message}</p>
                {appDialog.variant === "prompt" ? (
                  <input
                    autoFocus
                    value={appDialog.value}
                    onChange={(event) =>
                      setAppDialog((current) => (current ? { ...current, value: event.target.value } : current))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && appDialog.value.trim()) {
                        resolveDialog(appDialog.value.trim());
                      }
                      if (event.key === "Escape") {
                        resolveDialog(null);
                      }
                    }}
                    placeholder={appDialog.placeholder}
                    className="mt-4 w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--brand-dark)] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-cyan-100"
                  />
                ) : null}
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    onClick={() => resolveDialog(appDialog.variant === "prompt" ? null : false)}
                    className="inline-flex h-11 items-center rounded-xl border border-[var(--line)] bg-white px-4 text-sm font-black text-[var(--brand-dark)] transition hover:bg-cyan-50"
                  >
                    {appDialog.cancelText}
                  </button>
                  <button
                    onClick={() =>
                      resolveDialog(appDialog.variant === "prompt" ? appDialog.value.trim() : true)
                    }
                    disabled={appDialog.variant === "prompt" && !appDialog.value.trim()}
                    className={`inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-black text-white shadow-lg transition disabled:opacity-60 ${
                      appDialog.tone === "danger"
                        ? "bg-rose-600 shadow-rose-700/20 hover:bg-rose-700"
                        : "bg-[var(--brand)] shadow-cyan-700/20 hover:bg-[var(--brand-dark)]"
                    }`}
                  >
                    {appDialog.confirmText}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
            : null}
        </section>
      </div>
    </main>
  );

  function Dashboard() {
    if (isTeachingStaff) {
      return TeacherOverviewPanel();
    }

    const confirmed = schedules.filter((item) => item.status === "confirmed").length;
    const uploaded = lessonPlans.length;
    const attended = attendance.length;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Stat icon={CalendarDays} label="Lịch trong hệ thống" value={schedules.length} tone="cyan" />
          <Stat icon={CheckCircle2} label="Đã nhận lịch" value={confirmed} tone="emerald" />
          <Stat icon={UploadCloud} label="Giáo án đã nộp" value={uploaded} tone="blue" />
          <Stat icon={ShieldCheck} label="Đã điểm danh" value={attended} tone="orange" />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.5fr_0.85fr]">
          <Panel title="Lịch dạy gần nhất" action="Xem theo tuần">
            <ScheduleList items={visibleSchedules.slice(0, 5)} compact />
          </Panel>
          <Panel title="Thông báo vận hành" action={`${unreadNotifications} mới`}>
            <div className="space-y-3">
              {roleNotifications.slice(0, 5).map((item) => (
                  <div key={item.id} className="rounded-2xl border border-[var(--line)] bg-slate-50 p-4">
                    <p className="text-sm font-extrabold text-[var(--brand-dark)]">{item.title}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{item.body}</p>
                  </div>
                ))}
            </div>
          </Panel>
        </div>
      </div>
    );
  }

  function AssignmentPanel() {
    const activeTopics = topics.filter((t) => t.active !== false);
    const reportSchedules = schedules
      .filter((schedule) => schedule.status !== "cancelled")
      .filter((schedule) => !assignmentReportDateFrom || schedule.date >= assignmentReportDateFrom)
      .filter((schedule) => !assignmentReportDateTo || schedule.date <= assignmentReportDateTo)
      .filter((schedule) => assignmentReportTeacherId === "all" || schedule.teacherId === assignmentReportTeacherId);
    const selectedAssignmentReportIds = selectedAssignmentScheduleIds.filter((id) => reportSchedules.some((schedule) => schedule.id === id));
    const periodCount = (schedule: Schedule) => Math.max(1, String(schedule.lessonPeriods || "lesson1").split(",").filter(Boolean).length);
    const totalReportedPeriods = reportSchedules.reduce((total, schedule) => total + periodCount(schedule), 0);
    const buildPeriodTotals = (labelFor: (schedule: Schedule) => string) => {
      const totals = new Map<string, number>();
      reportSchedules.forEach((schedule) => {
        const label = labelFor(schedule);
        totals.set(label, (totals.get(label) || 0) + periodCount(schedule));
      });
      return Array.from(totals, ([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
    };
    const periodsByEnvironment = buildPeriodTotals((schedule) => teachingEnvironmentLabel(schedule.teachingEnvironment));
    const periodsByTeacher = buildPeriodTotals((schedule) => teacherName(schedule.teacherId));
    const periodsBySchool = buildPeriodTotals((schedule) => schools.find((school) => school.id === schedule.schoolId)?.name || "Chưa rõ trường");
    const reportDates = Array.from(new Set(reportSchedules.map((schedule) => schedule.date))).sort();
    const schoolTrendSeries = Array.from(new Set(reportSchedules.map((schedule) => schedule.schoolId))).map((schoolId) => ({
      label: schools.find((school) => school.id === schoolId)?.name || "Chưa rõ trường",
      values: reportDates.map((date) => reportSchedules
        .filter((schedule) => schedule.schoolId === schoolId && schedule.date === date)
        .reduce((total, schedule) => total + periodCount(schedule), 0)),
    }));

    async function exportAssignmentReport() {
      setPendingAction("Đang xuất Excel đối soát...");
      try {
        const XLSX = await import("xlsx");
        const rows = reportSchedules.map((schedule) => {
          const lesson = lessons.find((item) => item.id === schedule.lessonId);
          const slot = timeSlots.find((item) => item.id === schedule.timeSlotId);
          const participantClasses = scheduleParticipantClassIds(schedule)
            .map((classId) => classes.find((item) => item.id === classId)?.name)
            .filter(Boolean)
            .join(", ");
          const selectedPeriods = String(schedule.lessonPeriods || "lesson1").split(",").filter(Boolean);
          const periodRows = selectedPeriods.map((period) => {
            const isLesson2 = period === "lesson2";
            return {
              "Ngày": formatDate(schedule.date),
              "Khung giờ": slot ? `${slot.label} (${slot.start}-${slot.end})` : "Chưa cập nhật",
              "Giáo viên": teacherName(schedule.teacherId),
              "Trợ giảng": String(schedule.assistantIds || "").split(",").map((id) => teacherName(id.trim())).filter(Boolean).join(", ") || "Không có",
              "Môi trường dạy": teachingEnvironmentLabel(schedule.teachingEnvironment),
              "Trường": schools.find((school) => school.id === schedule.schoolId)?.name || "Chưa cập nhật",
              "Lớp / phạm vi": participantClasses || classes.find((item) => item.id === schedule.classId)?.name || "Chưa cập nhật",
              "Khối": lesson?.grade || classes.find((item) => item.id === schedule.classId)?.grade || "",
              "Tên bài": lesson?.title || "Chưa cập nhật",
              "Tên tiết": isLesson2 ? `Tiết 2: ${lesson?.lesson2Title || ""}` : `Tiết 1: ${lesson?.lesson1Title || lesson?.title || ""}`,
              "Mục tiêu tiết": isLesson2 ? lesson?.lesson2Objective || "" : lesson?.lesson1Objective || lesson?.objective || "",
              "Trạng thái": statusLabels[schedule.status] || schedule.status,
              "Gửi lúc": schedule.sentAt ? formatDateTime(schedule.sentAt) : "",
              "Xác nhận lúc": schedule.confirmedAt ? formatDateTime(schedule.confirmedAt) : "",
            };
          });
          return periodRows;
        }).flat();
        const worksheet = XLSX.utils.json_to_sheet(rows);
        worksheet["!cols"] = [12, 18, 20, 20, 20, 30, 28, 12, 34, 40, 60, 16, 22, 22].map((wch) => ({ wch }));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Đối soát tiết dạy");
        XLSX.writeFile(workbook, `doi-soat-tiet-day-${assignmentReportDateFrom || "tat-ca"}-${assignmentReportDateTo || "tat-ca"}.xlsx`);
        pushToast("Đã xuất Excel", `Đã xuất ${rows.length} tiết theo bộ lọc hiện tại.`, "success");
      } catch (error) {
        pushToast("Không thể xuất Excel", String(error), "error");
      } finally {
        setPendingAction("");
      }
    }

    function ReportLineChart({ title, rows }: { title: string; rows: Array<{ label: string; value: number }> }) {
      const width = 520;
      const height = 220;
      const padding = { top: 22, right: 18, bottom: 52, left: 34 };
      const maxValue = Math.max(1, ...rows.map((row) => row.value));
      const chartWidth = width - padding.left - padding.right;
      const chartHeight = height - padding.top - padding.bottom;
      const points = rows.map((row, index) => {
        const x = padding.left + (rows.length <= 1 ? chartWidth / 2 : (index / (rows.length - 1)) * chartWidth);
        const y = padding.top + chartHeight - (row.value / maxValue) * chartHeight;
        return { ...row, x, y };
      });
      return (
        <div className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
          <p className="text-sm font-black text-[var(--brand-dark)]">{title}</p>
          <div className="mt-3 overflow-x-auto">
            {rows.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs font-bold text-[var(--muted)]">Chưa có dữ liệu theo bộ lọc.</p>
            ) : (
              <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[420px] w-full" role="img" aria-label={title}>
                {[0, 0.5, 1].map((step) => {
                  const y = padding.top + chartHeight - step * chartHeight;
                  return <line key={step} x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#d9f2f7" strokeWidth="1" />;
                })}
                <text x="4" y={padding.top + 4} fill="#5f7485" fontSize="10">{maxValue}</text>
                <text x="10" y={padding.top + chartHeight + 4} fill="#5f7485" fontSize="10">0</text>
                <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#0ea5b7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                {points.map((point) => (
                  <g key={point.label}>
                    <circle cx={point.x} cy={point.y} r="5" fill="#f59e0b" stroke="white" strokeWidth="3" />
                    <text x={point.x} y={point.y - 11} textAnchor="middle" fill="#0b5062" fontSize="11" fontWeight="700">{point.value}</text>
                    <text x={point.x} y={height - 18} textAnchor="middle" fill="#526b7b" fontSize="10">
                      {point.label.length > 20 ? `${point.label.slice(0, 18)}…` : point.label}
                    </text>
                  </g>
                ))}
              </svg>
            )}
          </div>
        </div>
      );
    }

    function SchoolTrendLineChart() {
      const width = 520;
      const height = 220;
      const padding = { top: 22, right: 18, bottom: 52, left: 34 };
      const chartWidth = width - padding.left - padding.right;
      const chartHeight = height - padding.top - padding.bottom;
      const maxValue = Math.max(1, ...schoolTrendSeries.flatMap((series) => series.values));
      const colors = ["#0ea5b7", "#f59e0b", "#7c3aed", "#10b981", "#f43f5e", "#2563eb"];
      return (
        <div className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
          <p className="text-sm font-black text-[var(--brand-dark)]">So sánh số tiết giữa các trường theo ngày</p>
          {reportDates.length === 0 ? (
            <p className="mt-3 rounded-xl bg-slate-50 px-3 py-4 text-center text-xs font-bold text-[var(--muted)]">Chưa có dữ liệu theo bộ lọc.</p>
          ) : (
            <>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-bold text-[var(--muted)]">
                {schoolTrendSeries.map((series, index) => <span key={series.label} className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />{series.label}</span>)}
              </div>
              <div className="mt-3 overflow-x-auto">
                <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[420px] w-full" role="img" aria-label="So sánh số tiết giữa các trường theo ngày">
                  {[0, 0.5, 1].map((step) => {
                    const y = padding.top + chartHeight - step * chartHeight;
                    return <line key={step} x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#d9f2f7" strokeWidth="1" />;
                  })}
                  <text x="4" y={padding.top + 4} fill="#5f7485" fontSize="10">{maxValue}</text>
                  {schoolTrendSeries.map((series, seriesIndex) => {
                    const color = colors[seriesIndex % colors.length];
                    const points = series.values.map((value, index) => {
                      const x = padding.left + (reportDates.length <= 1 ? chartWidth / 2 : (index / (reportDates.length - 1)) * chartWidth);
                      const y = padding.top + chartHeight - (value / maxValue) * chartHeight;
                      return { x, y, value };
                    });
                    return <g key={series.label}><polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="3.5" fill={color} stroke="white" strokeWidth="2" />)}</g>;
                  })}
                  {reportDates.map((date, index) => {
                    const x = padding.left + (reportDates.length <= 1 ? chartWidth / 2 : (index / (reportDates.length - 1)) * chartWidth);
                    return <text key={date} x={x} y={height - 18} textAnchor="middle" fill="#526b7b" fontSize="10">{formatDate(date)}</text>;
                  })}
                </svg>
              </div>
            </>
          )}
        </div>
      );
    }

    function updateDraftItem(itemId: string, patch: Partial<DraftScheduleItem>) {
      setDraftSchedule((current) => ({
        ...current,
        items: current.items.map((ci) => (ci.id === itemId ? { ...ci, ...patch } : ci)),
      }));
    }

    function toggleDraftItemTeacher(itemId: string, teacherId: string, checked: boolean) {
      setDraftSchedule((current) => ({
        ...current,
        items: current.items.map((ci) => {
          if (ci.id !== itemId) return ci;
          const next = checked ? [...ci.teacherIds, teacherId] : ci.teacherIds.filter((id) => id !== teacherId);
          return { ...ci, teacherIds: next };
        }),
      }));
    }

    function toggleDraftItemAssistant(itemId: string, teacherId: string, checked: boolean) {
      setDraftSchedule((current) => ({
        ...current,
        items: current.items.map((ci) => {
          if (ci.id !== itemId) return ci;
          const next = checked ? [...ci.assistantIds, teacherId] : ci.assistantIds.filter((id) => id !== teacherId);
          return { ...ci, assistantIds: next };
        }),
      }));
    }

    return (
      <div className="space-y-5">
        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.35fr]">
          <Panel title="Tạo lịch dạy mới" action="Email xác nhận">
            <div className="grid gap-4">
              <div className="rounded-2xl border border-cyan-100 bg-cyan-50/55 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-extrabold text-[var(--brand-dark)]">Danh sách tiết dạy cần giao</p>
                  <button
                    type="button"
                    onClick={() =>
                      setDraftSchedule((current) => {
                        const prev = current.items[0];
                        const schoolId = prev?.schoolId ?? schools[0]?.id ?? "";
                        const grade = pickDefaultGradeForSchool(schoolId, prev?.classId ?? "", classes);
                        const classId = pickClassIdForSchoolGrade(schoolId, grade, prev?.classId ?? "", classes);
                        return {
                          ...current,
                          items: [
                            ...current.items,
                            createDraftScheduleItem({
                              date: prev?.date ?? currentDateKey(),
                              schoolId,
                              classId,
                              classIds: prev?.classIds ?? (classId ? [classId] : []),
                              lessonId: pickLessonIdForGrade(grade, prev?.lessonId ?? "", activeLessons),
                              timeSlotId: prev?.timeSlotId ?? activeTimeSlots[0]?.id ?? "",
                              teachingEnvironment: prev?.teachingEnvironment ?? defaultTeachingEnvironment,
                              teacherIds: prev?.teacherIds ?? [],
                            }),
                          ],
                        };
                      })
                    }
                    className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--brand)] px-3 text-xs font-black text-white"
                  >
                    <Plus size={14} />
                    Thêm dòng
                  </button>
                </div>
                <div className="mt-3 grid gap-3">
                  {draftSchedule.items.map((item, index) => {
                    const rowClasses = classesForSchool(classes, item.schoolId);
                    const rowSelectedGrade = pickDefaultGradeForSchool(item.schoolId, item.classId, classes);
                    const rowGradeClasses = classesForSchoolGrade(classes, item.schoolId, rowSelectedGrade);
                    const rowSelectedClassIds = item.classIds.length > 0 ? item.classIds : item.classId ? [item.classId] : [];
                    const allowsGroupClasses = item.teachingEnvironment !== "in_class";
                    const rowTopics = allowsGroupClasses
                      ? activeTopics
                      : activeTopics.filter((t) => normalizeComparableText(t.grade) === normalizeComparableText(rowSelectedGrade));
                    const rowLessonsAll = allowsGroupClasses ? activeLessons : lessonsForGrade(activeLessons, rowSelectedGrade);
                    const rowLessons = item.topicId
                      ? rowLessonsAll.filter((l) => l.topicId === item.topicId)
                      : rowLessonsAll;
                    const rowGrades = gradesForClasses(rowClasses);
                    const groupGradeScopes = Array.from({ length: 12 }, (_, index) => {
                      const number = index + 1;
                      const grade = rowGrades.find((value) => gradeNumber(value) === number);
                      return { number, grade, classIds: grade ? classesForSchoolGrade(classes, item.schoolId, grade).map((classRoom) => classRoom.id) : [] };
                    });
                    const groupScopeValue =
                      rowClasses.length > 0 && rowSelectedClassIds.length === rowClasses.length && rowClasses.every((classRoom) => rowSelectedClassIds.includes(classRoom.id))
                        ? "__all_school__"
                        : `grade:${gradeNumber(rowSelectedGrade)}`;
                    return (
                      <div key={item.id} className="rounded-2xl border border-cyan-100 bg-white p-3 shadow-sm">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-black uppercase text-[var(--brand-dark)]">Lịch #{index + 1}</p>
                          <button
                            type="button"
                            onClick={() =>
                              setDraftSchedule((current) => ({
                                ...current,
                                items:
                                  current.items.length <= 1
                                    ? current.items
                                    : current.items.filter((ci) => ci.id !== item.id),
                              }))
                            }
                            disabled={draftSchedule.items.length <= 1}
                            className="grid h-8 w-8 place-items-center rounded-lg bg-rose-50 text-rose-700 disabled:opacity-50"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <select
                            value={item.teachingEnvironment}
                            onChange={(e) => {
                              const teachingEnvironment = normalizeTeachingEnvironmentValue(e.target.value);
                              updateDraftItem(item.id, {
                                teachingEnvironment,
                                classIds: teachingEnvironment === "in_class" ? (item.classId ? [item.classId] : []) : rowSelectedClassIds,
                              });
                            }}
                            className={inputClass}
                          >
                            {teachingEnvironmentOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                Môi trường: {option.label}
                              </option>
                            ))}
                          </select>
                          <input
                            type="date"
                            value={item.date}
                            onChange={(e) => updateDraftItem(item.id, { date: e.target.value })}
                            className={inputClass}
                          />
                          <select
                            value={item.schoolId}
                            onChange={(e) => {
                              const schoolId = e.target.value;
                              const grade = pickDefaultGradeForSchool(schoolId, item.classId, classes);
                              const classId = pickClassIdForSchoolGrade(schoolId, grade, item.classId, classes);
                              updateDraftItem(item.id, {
                                schoolId,
                                classId,
                                classIds: classId ? [classId] : [],
                                lessonId: pickLessonIdForGrade(grade, item.lessonId, activeLessons),
                                topicId: "",
                              });
                            }}
                            className={inputClass}
                          >
                            {schools.map((school) => (
                              <option key={school.id} value={school.id}>
                                {school.name}
                              </option>
                            ))}
                          </select>
                          {allowsGroupClasses ? (
                            <select
                              value={groupScopeValue}
                              onChange={(e) => {
                                const scope = e.target.value;
                                const classIds = scope === "__all_school__"
                                  ? rowClasses.map((classRoom) => classRoom.id)
                                  : groupGradeScopes.find((option) => `grade:${option.number}` === scope)?.classIds ?? [];
                                const selectedGrade = scope === "__all_school__"
                                  ? rowSelectedGrade
                                  : groupGradeScopes.find((option) => `grade:${option.number}` === scope)?.grade ?? rowSelectedGrade;
                                updateDraftItem(item.id, {
                                  classIds,
                                  classId: classIds[0] ?? "",
                                  lessonId: scope === "__all_school__"
                                    ? (activeLessons.some((lesson) => lesson.id === item.lessonId) ? item.lessonId : activeLessons[0]?.id ?? "")
                                    : pickLessonIdForGrade(selectedGrade, item.lessonId, activeLessons),
                                  topicId: "",
                                });
                              }}
                              className={inputClass}
                            >
                              <option value="__all_school__">Toàn trường</option>
                              {groupGradeScopes.map((option) => (
                                <option key={option.number} value={`grade:${option.number}`} disabled={option.classIds.length === 0}>
                                  Toàn khối {option.number}{option.classIds.length === 0 ? " (chưa có lớp)" : ""}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <select
                              value={rowSelectedGrade}
                              onChange={(e) => {
                                const grade = e.target.value;
                                const classId = pickClassIdForSchoolGrade(item.schoolId, grade, item.classId, classes);
                                updateDraftItem(item.id, {
                                  classId,
                                  classIds: classId ? [classId] : [],
                                  lessonId: pickLessonIdForGrade(grade, item.lessonId, activeLessons),
                                  topicId: "",
                                });
                              }}
                              className={inputClass}
                            >
                              {rowGrades.length === 0 ? (
                                <option value="">Chưa có khối trong trường</option>
                              ) : (
                                rowGrades.map((grade) => (
                                  <option key={grade} value={grade}>
                                    {grade}
                                  </option>
                                ))
                              )}
                            </select>
                          )}
                          {!allowsGroupClasses ? (
                            <select
                              value={item.classId}
                              onChange={(e) => {
                                const classId = e.target.value;
                                updateDraftItem(item.id, {
                                  classId,
                                  classIds: classId ? [classId] : [],
                                  lessonId: pickLessonIdForClass(classId, item.lessonId, classes, activeLessons),
                                });
                              }}
                              className={inputClass}
                            >
                              {rowGradeClasses.length === 0 ? (
                                <option value="">Chưa có lớp trong khối</option>
                              ) : (
                                rowGradeClasses.map((cr) => (
                                  <option key={cr.id} value={cr.id}>
                                    {cr.name}
                                  </option>
                                ))
                              )}
                            </select>
                          ) : (
                            <div className="rounded-2xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-800">
                              Chọn một hoặc nhiều lớp ở phần hoạt động chung bên dưới
                            </div>
                          )}
                          <select
                            value={item.timeSlotId}
                            onChange={(e) => updateDraftItem(item.id, { timeSlotId: e.target.value })}
                            className={inputClass}
                          >
                            {activeTimeSlots.map((slot) => (
                              <option key={slot.id} value={slot.id}>
                                {slot.label} ({slot.start}-{slot.end})
                              </option>
                            ))}
                          </select>
                          {rowTopics.length > 0 ? (
                            <select
                              value={item.topicId}
                              onChange={(e) => {
                                const topicId = e.target.value;
                                const filtered = topicId
                                  ? rowLessonsAll.filter((l) => l.topicId === topicId)
                                  : rowLessonsAll;
                                const lessonId =
                                  filtered.some((l) => l.id === item.lessonId) ? item.lessonId : filtered[0]?.id ?? "";
                                updateDraftItem(item.id, { topicId, lessonId });
                              }}
                              className={inputClass}
                            >
                              <option value="">Tất cả chủ đề</option>
                              {rowTopics.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.title}
                                </option>
                              ))}
                            </select>
                          ) : null}
                          <select
                            value={item.lessonId}
                            onChange={(e) => {
                              const lessonId = e.target.value;
                              const lesson = activeLessons.find((entry) => entry.id === lessonId);
                              updateDraftItem(item.id, { lessonId, lessonPeriods: defaultLessonPeriods(lesson) });
                            }}
                            className={inputClass}
                          >
                            {rowLessons.length === 0 ? (
                              <option value="">Chưa có bài học phù hợp</option>
                            ) : (
                              rowLessons.map((lesson) => (
                                <option key={lesson.id} value={lesson.id}>
                                  {lesson.title}
                                </option>
                              ))
                            )}
                          </select>
                          {(() => {
                            const selectedLesson = activeLessons.find((lesson) => lesson.id === item.lessonId);
                            const periodOptions = lessonPeriodOptions(selectedLesson);
                            return (
                              <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-3 md:col-span-2">
                                <p className="text-xs font-black uppercase text-[var(--brand-dark)]">Chọn tiết cần giao</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {periodOptions.map((period) => (
                                    <label key={period.value} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-bold text-[var(--brand-dark)] shadow-sm">
                                      <input
                                        type="checkbox"
                                        checked={item.lessonPeriods.includes(period.value)}
                                        onChange={(event) => {
                                          const lessonPeriods = event.target.checked
                                            ? Array.from(new Set([...item.lessonPeriods, period.value]))
                                            : item.lessonPeriods.filter((value) => value !== period.value);
                                          updateDraftItem(item.id, { lessonPeriods });
                                        }}
                                      />
                                      {period.label}
                                    </label>
                                  ))}
                                </div>
                                <p className="mt-2 text-xs font-semibold text-cyan-800">Có thể chọn Tiết 1, Tiết 2 hoặc cả hai tiết cho cùng lịch dạy.</p>
                              </div>
                            );
                          })()}
                          {rowSelectedGrade && rowLessons.length === 0 ? (
                            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 md:col-span-2">
                              Chưa có bài học đang hoạt động cho {rowSelectedGrade}. Vui lòng vào mục Bài học để thêm hoặc bật bài phù hợp.
                            </p>
                          ) : null}
                        </div>
                        {allowsGroupClasses ? (
                          <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50/70 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-black uppercase text-violet-800">Lớp tham gia hoạt động chung</p>
                              <label className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-xs font-black text-violet-800 shadow-sm">
                                <input
                                  type="checkbox"
                                  checked={rowGradeClasses.length > 0 && rowGradeClasses.every((classRoom) => rowSelectedClassIds.includes(classRoom.id))}
                                  onChange={(event) => {
                                    const classIds = event.target.checked ? rowGradeClasses.map((classRoom) => classRoom.id) : [];
                                    updateDraftItem(item.id, { classIds, classId: classIds[0] ?? "" });
                                  }}
                                />
                                Chọn toàn bộ {rowSelectedGrade}
                              </label>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {rowGradeClasses.map((classRoom) => (
                                <label key={classRoom.id} className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-xs font-semibold text-violet-900 shadow-sm">
                                  <input
                                    type="checkbox"
                                    checked={rowSelectedClassIds.includes(classRoom.id)}
                                    onChange={(event) => {
                                      const classIds = event.target.checked
                                        ? Array.from(new Set([...rowSelectedClassIds, classRoom.id]))
                                        : rowSelectedClassIds.filter((id) => id !== classRoom.id);
                                      updateDraftItem(item.id, { classIds, classId: classIds[0] ?? "" });
                                    }}
                                  />
                                  {classRoom.name}
                                </label>
                              ))}
                            </div>
                            <p className="mt-2 text-xs font-semibold text-violet-700">
                              Đã chọn {rowSelectedClassIds.length} lớp. Hoạt động chung cho phép các lớp và giáo viên đã chọn diễn ra đồng thời.
                            </p>
                          </div>
                        ) : null}
                        {/* Per-item teacher selection */}
                        <div className="mt-3 rounded-xl border border-cyan-100 bg-cyan-50/60 p-3">
                          <p className="mb-2 text-xs font-black uppercase text-[var(--brand-dark)]">Giáo viên</p>
                          <div className="flex flex-wrap gap-2">
                            {activeTeachers.map((teacher) => (
                              <label
                                key={teacher.id}
                                className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-xs font-semibold shadow-sm"
                              >
                                <input
                                  type="checkbox"
                                  checked={item.teacherIds.includes(teacher.id)}
                                  onChange={(e) => toggleDraftItemTeacher(item.id, teacher.id, e.target.checked)}
                                />
                                <span>{teacher.name}</span>
                              </label>
                            ))}
                          </div>
                          {activeAssistants.length > 0 ? (
                            <div className="mt-2">
                              <p className="mb-1 text-xs font-bold text-violet-700">Trợ giảng (không tính xung đột)</p>
                              <div className="flex flex-wrap gap-2">
                                {activeAssistants.map((teacher) => (
                                  <label
                                    key={teacher.id}
                                    className="flex items-center gap-2 rounded-lg bg-violet-50 px-2 py-1.5 text-xs font-semibold shadow-sm"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={item.assistantIds.includes(teacher.id)}
                                      onChange={(e) => toggleDraftItemAssistant(item.id, teacher.id, e.target.checked)}
                                    />
                                    <span>{teacher.name}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <button
                onClick={createSchedules}
                disabled={isBusy || draftScheduleConflicts.length > 0}
                className={`sticky bottom-24 z-10 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white shadow-lg shadow-cyan-700/20 transition lg:static ${
                  isBusy || draftScheduleConflicts.length > 0
                    ? "cursor-not-allowed bg-slate-400 shadow-none"
                    : "bg-[var(--brand)] hover:-translate-y-0.5 hover:bg-[var(--brand-dark)]"
                }`}
              >
                <Send size={18} />
                Gửi lịch và email thông báo
              </button>
            </div>
          </Panel>

          <Panel
            title="Xem trước lịch sắp gửi"
            action={`Sẽ tạo ${filteredDraftSchedulePreview.length}/${draftSchedulePreview.length} lịch`}
          >
            <div className="space-y-3">
              <div className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-3">
                <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-[var(--brand-dark)]">
                  Xem theo giáo viên
                  <select
                    value={assignmentPreviewTeacherId}
                    onChange={(event) => setAssignmentPreviewTeacherId(event.target.value)}
                    className={compactInputClass}
                  >
                    <option value="all">Tất cả giáo viên đã chọn</option>
                    {draftPreviewTeacherOptions.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.name} ({draftPreviewScheduleCountByTeacher.get(teacher.id) || 0} lịch)
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {draftScheduleConflicts.length > 0 ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
                  <p className="text-sm font-black text-rose-800">
                    Phát hiện {draftScheduleConflicts.length} xung đột, cần xử lý trước khi gửi
                  </p>
                  <div className="mt-2 space-y-2">
                    {draftScheduleConflicts.slice(0, 8).map((conflict) => (
                      <div key={conflict.key} className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-800">
                        {formatDraftConflictLine(conflict, teachers, classes, timeSlots)}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
                  Không phát hiện xung đột lịch. Có thể gửi lịch hàng loạt an toàn.
                </div>
              )}
              <ScheduleList items={filteredDraftSchedulePreview} compact />
            </div>
          </Panel>
        </div>
        <Panel title="Lịch đã giao" action={`${reportSchedules.length} lịch • ${totalReportedPeriods} tiết`}>
          <div className="space-y-4">
            <div className="grid gap-3 rounded-2xl border border-cyan-100 bg-cyan-50/50 p-3 lg:grid-cols-[1fr_1fr_1.25fr_auto] lg:items-end">
              <label className="grid gap-1 text-xs font-black text-[var(--brand-dark)]">
                Từ ngày
                <input type="date" value={assignmentReportDateFrom} onChange={(event) => setAssignmentReportDateFrom(event.target.value)} className={compactInputClass} />
              </label>
              <label className="grid gap-1 text-xs font-black text-[var(--brand-dark)]">
                Đến ngày
                <input type="date" value={assignmentReportDateTo} onChange={(event) => setAssignmentReportDateTo(event.target.value)} className={compactInputClass} />
              </label>
              <label className="grid gap-1 text-xs font-black text-[var(--brand-dark)]">
                Giáo viên
                <select value={assignmentReportTeacherId} onChange={(event) => setAssignmentReportTeacherId(event.target.value)} className={compactInputClass}>
                  <option value="all">Tất cả giáo viên</option>
                  {activeTeachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
                </select>
              </label>
              <button type="button" onClick={exportAssignmentReport} disabled={isBusy || reportSchedules.length === 0} className={primaryButtonClass}>
                <Download size={16} />
                Xuất Excel
              </button>
            </div>
            {role === "admin" && reportSchedules.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-cyan-100 bg-cyan-50/50 p-3">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedAssignmentScheduleIds((current) =>
                      selectedAssignmentReportIds.length === reportSchedules.length
                        ? current.filter((id) => !reportSchedules.some((schedule) => schedule.id === id))
                        : Array.from(new Set([...current, ...reportSchedules.map((schedule) => schedule.id)])),
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-[var(--brand-dark)] ring-1 ring-cyan-100"
                >
                  <ListChecks size={15} />
                  {selectedAssignmentReportIds.length === reportSchedules.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                </button>
                <span className="text-xs font-black text-[var(--muted)]">{selectedAssignmentReportIds.length} lịch đã chọn</span>
                <button
                  type="button"
                  onClick={() => bulkDeleteAssignmentSchedules(selectedAssignmentReportIds)}
                  disabled={selectedAssignmentReportIds.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                >
                  <Trash2 size={15} />
                  Xóa lịch đã chọn
                </button>
              </div>
            ) : null}
            <ScheduleList
              items={reportSchedules.slice().sort((a, b) => `${b.date}|${b.timeSlotId}`.localeCompare(`${a.date}|${a.timeSlotId}`))}
              selectedIds={selectedAssignmentScheduleIds}
              onToggleSelect={role === "admin" ? (scheduleId) => setSelectedAssignmentScheduleIds((ids) =>
                ids.includes(scheduleId) ? ids.filter((id) => id !== scheduleId) : [...ids, scheduleId],
              ) : undefined}
              onOpenDetail={setSelectedScheduleDetail}
              onDelete={role === "admin" ? deleteSchedule : undefined}
            />
            <div className="border-t border-cyan-100 pt-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-[var(--brand-dark)]">Thống kê đối soát</h3>
                  <p className="mt-1 text-xs font-bold text-[var(--muted)]">Tất cả số liệu chạy theo khoảng thời gian và giáo viên đã chọn.</p>
                </div>
                <div className="rounded-2xl bg-gradient-to-r from-cyan-600 to-teal-500 px-4 py-3 text-white shadow-lg shadow-cyan-700/20">
                  <p className="text-xs font-bold text-cyan-50">Tổng số tiết dạy</p>
                  <p className="mt-1 text-3xl font-black">{totalReportedPeriods}</p>
                </div>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <ReportLineChart title="Đường số tiết theo giáo viên" rows={periodsByTeacher} />
                <ReportLineChart title="Đường số tiết theo trường" rows={periodsBySchool} />
                <ReportLineChart title="Đường số tiết theo môi trường dạy" rows={periodsByEnvironment} />
                <SchoolTrendLineChart />
              </div>
            </div>
          </div>
        </Panel>
        <AssignmentSummaryPanel />
      </div>
    );
  }

  function AssignmentSummaryPanel() {
    const activeSchedules = schedules.filter((s) => s.status !== "cancelled");
    const summaryByTeacher = useMemo(() => {
      const map = new Map<string, { total: number; envCounts: Record<string, number>; schools: Set<string> }>();
      for (const s of activeSchedules) {
        let entry = map.get(s.teacherId);
        if (!entry) {
          entry = { total: 0, envCounts: {}, schools: new Set() };
          map.set(s.teacherId, entry);
        }
        entry.total++;
        const env = s.teachingEnvironment ?? "in_class";
        entry.envCounts[env] = (entry.envCounts[env] || 0) + 1;
        entry.schools.add(s.schoolId);
      }
      return map;
    }, [activeSchedules]);

    async function exportScheduleExcel() {
      setPendingAction("Đang xuất Excel...");
      try {
        const XLSX = await import("xlsx");
        const rows = activeSchedules.map((s) => {
          const teacher = teachers.find((t) => t.id === s.teacherId);
          const school = schools.find((sc) => sc.id === s.schoolId);
          const cls = classes.find((c) => c.id === s.classId);
          const lesson = lessons.find((l) => l.id === s.lessonId);
          const slot = timeSlots.find((ts) => ts.id === s.timeSlotId);
          const envLabel = teachingEnvironmentOptions.find((o) => o.value === s.teachingEnvironment)?.label ?? s.teachingEnvironment ?? "";
          return {
            "Ngày": s.date,
            "Giáo viên": teacher?.name ?? s.teacherId,
            "Trường": school?.name ?? s.schoolId,
            "Lớp": cls?.name ?? s.classId,
            "Bài học": lesson?.title ?? s.lessonId,
            "Khung giờ": slot ? `${slot.label} (${slot.start}-${slot.end})` : s.timeSlotId,
            "Môi trường": envLabel,
            "Trạng thái": statusLabels[s.status] ?? s.status,
            "Trợ giảng": s.assistantIds ?? "",
          };
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Lịch dạy");
        XLSX.writeFile(wb, `lich-day-${currentDateKey()}.xlsx`);
        pushToast("Xuất Excel thành công", `Đã xuất ${rows.length} lịch dạy.`, "success");
      } catch (error) {
        pushToast("Lỗi xuất Excel", String(error), "error");
      } finally {
        setPendingAction("");
      }
    }

    return (
      <Panel title="Bảng tổng hợp lịch" action={`${activeSchedules.length} lịch đang hoạt động`}>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button onClick={exportScheduleExcel} disabled={isBusy} className={ghostButtonClass}>
              <Download size={16} />
              Xuất Excel
            </button>
          </div>
          <div className="app-scrollbar overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-xs font-black uppercase text-[var(--brand-dark)]">
                  <th className="px-3 py-2">Giáo viên</th>
                  <th className="px-3 py-2">Tổng lịch</th>
                  <th className="px-3 py-2">Trường</th>
                  {teachingEnvironmentOptions.map((o) => (
                    <th key={o.value} className="px-3 py-2">{o.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeTeachers.map((teacher) => {
                  const entry = summaryByTeacher.get(teacher.id);
                  return (
                    <tr key={teacher.id} className="border-b border-[var(--line)] hover:bg-cyan-50/40">
                      <td className="px-3 py-2 font-semibold">{teacher.name}</td>
                      <td className="px-3 py-2">{entry?.total ?? 0}</td>
                      <td className="px-3 py-2">{entry ? entry.schools.size : 0}</td>
                      {teachingEnvironmentOptions.map((o) => (
                        <td key={o.value} className="px-3 py-2">{entry?.envCounts[o.value] ?? 0}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    );
  }

  function CalendarPanel() {
    const todayKey = currentDateKey();
    const calendarGridClass = calendarViewMode === "day" ? "grid-cols-1" : "grid-cols-7";
    const showTeacherBadgesInCalendarCell = calendarViewMode === "day" || !isMobileViewport;
    const bulkTargets = selectedDaySchedules.filter((schedule) => selectedScheduleIds.includes(schedule.id));

    return (
      <div className="space-y-5">
        <Panel title={role === "admin" ? "Lịch tổng quan" : "Lịch dạy của tôi"} action={formatMonthTitle(calendarMonth)}>
          <div className="mb-4 grid gap-3 xl:grid-cols-[1fr_auto]">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                title="Tháng trước"
                onClick={() => setCalendarMonth((value) => addMonths(value, -1))}
                className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--line)] bg-white text-[var(--brand-dark)] transition hover:bg-cyan-50"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                title="Tháng sau"
                onClick={() => setCalendarMonth((value) => addMonths(value, 1))}
                className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--line)] bg-white text-[var(--brand-dark)] transition hover:bg-cyan-50"
              >
                <ChevronRight size={18} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setCalendarMonth(currentMonthKey());
                  selectCalendarDate(todayKey);
                }}
                className="h-10 rounded-xl bg-cyan-50 px-3 text-xs font-black text-[var(--brand-dark)] transition hover:bg-cyan-100"
              >
                Hôm nay
              </button>
              <div className="order-last mt-1 flex w-full overflow-hidden rounded-xl border border-[var(--line)] bg-white sm:order-none sm:mt-0 sm:ml-2 sm:w-auto">
                {(["month", "week", "day"] as CalendarViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setCalendarViewMode(mode)}
                    className={`h-10 flex-1 px-3 text-xs font-black sm:flex-none ${
                      calendarViewMode === mode ? "bg-[var(--brand)] text-white" : "text-[var(--brand-dark)] hover:bg-cyan-50"
                    }`}
                  >
                    {mode === "month" ? "Tháng" : mode === "week" ? "Tuần" : "Ngày"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-black">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{calendarStats.total} lịch</span>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">{calendarStats.sent} chờ</span>
              <span className="rounded-full bg-cyan-50 px-3 py-1 text-cyan-800">{calendarStats.confirmed} đã nhận</span>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800">{calendarStats.attended} điểm danh</span>
              <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-800">{calendarStats.cancelled} hủy</span>
            </div>
          </div>
          {isTeachingStaff && quickScheduleDates.length > 0 ? (
            <div className="mb-4 rounded-2xl border border-orange-200 bg-orange-50/70 p-3">
              <p className="text-center text-[11px] font-black uppercase tracking-wide text-orange-700">CÁC NGÀY CÓ LỊCH DẠY</p>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {quickScheduleDates.map((item) => (
                  <button
                    key={item.dateKey}
                    type="button"
                    onClick={() => {
                      setCalendarMonth(item.dateKey.slice(0, 7));
                      selectCalendarDate(item.dateKey);
                    }}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black transition ${
                      selectedCalendarDate === item.dateKey
                        ? "border-orange-500 bg-orange-500 text-white"
                        : "border-orange-200 bg-white text-orange-800 hover:bg-orange-100"
                    }`}
                  >
                    <span>{formatShortDateLabel(item.dateKey)}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${selectedCalendarDate === item.dateKey ? "bg-white/20 text-white" : "bg-orange-50 text-orange-800"}`}>
                      {item.count}
                    </span>
                    {item.isToday ? <span className="text-[10px] uppercase tracking-wide">Hôm nay</span> : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {role === "admin" ? (
            <div className="mb-4 grid gap-3 rounded-2xl border border-cyan-100 bg-cyan-50/45 p-3 md:grid-cols-2 xl:grid-cols-7">
              <select
                value={calendarFilters.status}
                onChange={(event) => setCalendarFilters((current) => ({ ...current, status: event.target.value }))}
                className={compactInputClass}
              >
                <option value="all">Tất cả trạng thái</option>
                {Object.entries(statusLabels).map(([status, label]) => (
                  <option key={status} value={status}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={calendarFilters.teacherId}
                onChange={(event) => setCalendarFilters((current) => ({ ...current, teacherId: event.target.value }))}
                className={compactInputClass}
              >
                <option value="all">Tất cả giáo viên</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
              <select
                value={calendarFilters.schoolId}
                onChange={(event) => setCalendarFilters((current) => ({ ...current, schoolId: event.target.value, classId: "all" }))}
                className={compactInputClass}
              >
                <option value="all">Tất cả trường</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
              <select
                value={calendarFilters.classId}
                onChange={(event) => setCalendarFilters((current) => ({ ...current, classId: event.target.value }))}
                className={compactInputClass}
              >
                <option value="all">Tất cả lớp</option>
                {classes
                  .filter((classRoom) => calendarFilters.schoolId === "all" || classRoom.schoolId === calendarFilters.schoolId)
                  .map((classRoom) => (
                    <option key={classRoom.id} value={classRoom.id}>
                      {classRoom.name}
                    </option>
                  ))}
              </select>
              <select
                value={calendarFilters.timeSlotId}
                onChange={(event) => setCalendarFilters((current) => ({ ...current, timeSlotId: event.target.value }))}
                className={compactInputClass}
              >
                <option value="all">Tất cả khung giờ</option>
                {timeSlots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.label} {slot.start}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={calendarFilters.dateFrom}
                onChange={(event) => setCalendarFilters((current) => ({ ...current, dateFrom: event.target.value }))}
                className={compactInputClass}
              />
              <input
                type="date"
                value={calendarFilters.dateTo}
                onChange={(event) => setCalendarFilters((current) => ({ ...current, dateTo: event.target.value }))}
                className={compactInputClass}
              />
              <select
                value={calendarFilters.sort}
                onChange={(event) => setCalendarFilters((current) => ({ ...current, sort: event.target.value as CalendarSortMode }))}
                className={compactInputClass}
              >
                <option value="date-asc">Sớm nhất trước</option>
                <option value="date-desc">Mới nhất trước</option>
                <option value="status">Theo trạng thái</option>
              </select>
              <button
                type="button"
                onClick={resetCalendarFilters}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-white px-3 py-2 text-xs font-black text-[var(--brand-dark)] transition hover:bg-cyan-50 xl:col-span-2"
              >
                <SlidersHorizontal size={15} />
                Xóa lọc
              </button>
            </div>
          ) : null}

          {operationalAlerts.length > 0 ? (
            <div className="mb-4 grid gap-2 md:grid-cols-3">
              {operationalAlerts.map((alert) => (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => setSelectedOperationalAlert(alert)}
                  className={`rounded-2xl border px-4 py-3 text-left text-sm font-bold transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-300 ${alert.className}`}
                >
                  <p className="font-black">{alert.title}</p>
                  <p className="mt-1 text-xs">{alert.body}</p>
                  <p className="mt-2 text-[11px] font-black uppercase tracking-wide opacity-70">Bấm để xem chi tiết</p>
                </button>
              ))}
            </div>
          ) : null}

          {calendarViewMode !== "day" ? (
            <div className="app-scrollbar overflow-x-auto pb-1">
              <div className="grid min-w-[700px] grid-cols-7 gap-2 text-center text-[11px] font-black uppercase text-[var(--muted)] sm:min-w-0">
              {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => (
                  <span key={day} className="rounded-xl bg-cyan-50/70 py-1.5">
                    {day}
                  </span>
              ))}
              </div>
            </div>
          ) : null}
          <div className="app-scrollbar overflow-x-auto pb-1">
            <div className={`mt-2 grid ${calendarGridClass} gap-2 ${calendarViewMode === "day" ? "" : "min-w-[700px] sm:min-w-0"}`}>
              {calendarDays.map((day) => {
              const isSelected = selectedCalendarDate === day.dateKey;
              const statusTone = day.schedules.some((schedule) => schedule.status === "sent")
                ? "bg-amber-50 text-amber-800"
                : day.schedules.some((schedule) => schedule.status === "cancelled")
                  ? "bg-rose-50 text-rose-700"
                  : "bg-cyan-50 text-cyan-800";

              return (
                <button
                  key={day.dateKey}
                  ref={isSelected ? selectedCalendarDayRef : undefined}
                  type="button"
                  onClick={() => {
                    selectCalendarDate(day.dateKey);
                    setSelectedScheduleIds([]);
                  }}
                  className={`flex min-h-[104px] flex-col items-center justify-center rounded-2xl border p-2.5 text-center transition sm:min-h-[112px] sm:p-3 ${
                    isSelected
                      ? "border-[var(--brand)] bg-cyan-50 shadow-lg shadow-cyan-900/10"
                        : day.isToday
                          ? "border-orange-400 bg-orange-50/80 shadow-md shadow-orange-500/10"
                        : day.inMonth
                          ? "border-[var(--line)] bg-white hover:border-orange-200 hover:bg-orange-50/30"
                          : "border-slate-100 bg-slate-50/70 text-slate-400"
                  }`}
                >
                  <span
                    className={`grid h-8 w-8 place-items-center rounded-full text-sm font-black ${
                      day.isToday ? "bg-[var(--accent)] text-white" : "text-[var(--brand-dark)]"
                    }`}
                  >
                    {day.dayNumber}
                  </span>
                  {day.schedules.length > 0 ? (
                    <div className="mt-2 flex flex-col items-center space-y-1.5 sm:mt-3 sm:space-y-2">
                      <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-black ${statusTone}`}>
                        {day.schedules.length} lịch
                      </span>
                      {showTeacherBadgesInCalendarCell ? (
                        <div className="flex flex-wrap justify-center gap-1">
                          {teacherNamesForSchedules(day.schedules, teachers).map((name) => (
                            <span key={name} className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-[var(--brand-dark)] ring-1 ring-cyan-100">
                              {name}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </button>
              );
              })}
            </div>
          </div>
        </Panel>

        <div ref={calendarDetailRef} />
        {selectedCalendarDate ? (
          <Panel title={`Chi tiết ngày ${formatDate(selectedCalendarDate)}`} action={`${selectedDaySchedules.length} lịch`}>
            {role === "admin" && selectedDaySchedules.length > 0 ? (
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-cyan-100 bg-cyan-50/50 p-3">
                <button
                  type="button"
                  onClick={toggleSelectAllSelectedDay}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-[var(--brand-dark)] ring-1 ring-cyan-100"
                >
                  <ListChecks size={15} />
                  {selectedScheduleIds.length === selectedDaySchedules.length ? "Bỏ chọn" : "Chọn tất cả"}
                </button>
                <span className="text-xs font-black text-[var(--muted)]">{bulkTargets.length} lịch đã chọn</span>
                <button
                  type="button"
                  onClick={bulkCancelSchedules}
                  disabled={bulkTargets.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                >
                  <Trash2 size={15} />
                  Hủy hàng loạt
                </button>
                <button
                  type="button"
                  onClick={sendScheduleReminders}
                  disabled={bulkTargets.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
                >
                  <Bell size={15} />
                  Nhắc xác nhận
                </button>
                <select
                  value={bulkReassignTeacherId}
                  onChange={(event) => setBulkReassignTeacherId(event.target.value)}
                  className="min-w-[220px] rounded-xl border border-cyan-100 bg-white px-3 py-2 text-xs font-black text-[var(--brand-dark)] outline-none"
                >
                  <option value="">Chọn giáo viên chuyển</option>
                  {activeTeachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={bulkReassignSchedules}
                  disabled={bulkTargets.length === 0 || !bulkReassignTeacherId}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-50 px-3 py-2 text-xs font-black text-[var(--brand-dark)] transition hover:bg-cyan-100 disabled:opacity-50"
                >
                  <RefreshCcw size={15} />
                  Chuyển hàng loạt
                </button>
              </div>
            ) : null}
            <ScheduleList
              items={selectedDaySchedules}
              selectedIds={selectedScheduleIds}
              onToggleSelect={role === "admin" ? toggleScheduleSelection : undefined}
              onOpenDetail={setSelectedScheduleDetail}
              auditLogs={auditLogs}
              expandedHistoryId={expandedHistoryScheduleId}
              onToggleHistory={(scheduleId) =>
                setExpandedHistoryScheduleId((current) => (current === scheduleId ? "" : scheduleId))
              }
            />
          </Panel>
        ) : (
          <div className="rounded-2xl border border-dashed border-cyan-200 bg-cyan-50 px-5 py-4 text-sm font-bold text-[var(--brand-dark)]">
            Chọn một ngày trên lịch để xem danh sách chi tiết.
          </div>
        )}
      </div>
    );
  }

  function TeachersPanel() {
    return (
      <Panel title="Danh sách giáo viên" action={`${filteredTeachers.length}/${teachers.length} người`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-[var(--brand-dark)]">Bảng quản lý giáo viên</p>
            <p className="text-xs font-semibold text-[var(--muted)]">Theo dõi thông tin, email, số điện thoại và phân quyền.</p>
          </div>
          <button type="button" onClick={() => setTeacherModalOpen(true)} className={primaryButtonClass}>
            <UserPlus size={18} />
            Thêm giáo viên
          </button>
        </div>
        <div className="app-scrollbar overflow-x-auto">
          <div className="min-w-[1120px] overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
            <div className="grid grid-cols-[2fr_150px_2fr_150px_110px_190px] gap-3 border-b border-[var(--line)] bg-cyan-50 px-4 py-3 text-xs font-black uppercase text-[var(--brand-dark)]">
              <span>Tên giáo viên</span>
              <span>Số điện thoại</span>
              <span>Email</span>
              <span>Phân quyền</span>
              <span>Trạng thái</span>
              <span>Thao tác</span>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {filteredTeachers.map((teacher) => (
                <TeacherTableRow
                  key={teacher.id}
                  teacher={teacher}
                  user={userForTeacher(teacher.id)}
                  onRoleChange={updateTeacherRole}
                  isEditing={editingTeacherId === teacher.id}
                  draft={teacherEditDraft}
                  onStartEdit={startEditTeacher}
                  onCancelEdit={cancelEditTeacher}
                  onDraftChange={setTeacherEditDraft}
                  onSaveEdit={saveTeacherEdit}
                  onToggleActive={toggleTeacherActive}
                  onDelete={deleteTeacher}
                />
              ))}
              {filteredTeachers.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm font-semibold text-[var(--muted)]">
                  Không tìm thấy giáo viên phù hợp với từ khóa đang nhập.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </Panel>
    );
  }

  function LessonsPanel() {
    return (
      <div className="space-y-5">
        <Panel title="Nhập mẫu bài học" action="Spreadsheet / hàng loạt">
          <div className="grid gap-4">
            <div className="app-scrollbar overflow-x-auto">
              <div className="min-w-[1480px]">
                <div className="grid grid-cols-[130px_190px_190px_1fr_190px_1fr_220px_100px_48px] gap-2 px-2 pb-2 text-xs font-black uppercase text-[var(--brand-dark)]">
                  <span>Khối</span>
                  <span>Tên chuyên đề</span>
                  <span>Tên tiết 1</span>
                  <span>Mục tiêu tiết 1</span>
                  <span>Tên tiết 2</span>
                  <span>Mục tiêu tiết 2</span>
                  <span>Giáo án mẫu</span>
                  <span>Số phút</span>
                  <span />
                </div>
                <div className="space-y-2">
                  {bulkLessonRows.map((row) => (
                    <div key={row.id}>
                      <div className="grid grid-cols-[130px_190px_190px_1fr_190px_1fr_220px_100px_48px] items-start gap-2">
                        <select
                          value={row.grade}
                          onChange={(event) => updateBulkLessonRow(row.id, { grade: event.target.value })}
                          onPaste={(event) => pasteBulkLessons(row.id, event)}
                          className={compactInputClass}
                        >
                          {lessonGrades.map((grade) => (
                            <option key={grade}>{grade}</option>
                          ))}
                        </select>
                        <input
                          value={row.title}
                          onChange={(event) => updateBulkLessonRow(row.id, { title: event.target.value })}
                          onPaste={(event) => pasteBulkLessons(row.id, event)}
                          placeholder="Tên chuyên đề"
                          className={compactInputClass}
                        />
                        <input
                          value={row.lesson1Title}
                          onChange={(event) => updateBulkLessonRow(row.id, { lesson1Title: event.target.value })}
                          onPaste={(event) => pasteBulkLessons(row.id, event)}
                          placeholder="Tên tiết 1"
                          className={compactInputClass}
                        />
                        <textarea
                          value={row.lesson1Objective}
                          onChange={(event) => updateBulkLessonRow(row.id, { lesson1Objective: event.target.value })}
                          onPaste={(event) => pasteBulkLessons(row.id, event)}
                          placeholder="Mục tiêu tiết 1"
                          className={`${compactInputClass} min-h-12 resize-y whitespace-pre-line`}
                        />
                        <input
                          value={row.lesson2Title}
                          onChange={(event) => updateBulkLessonRow(row.id, { lesson2Title: event.target.value })}
                          onPaste={(event) => pasteBulkLessons(row.id, event)}
                          placeholder="Tên tiết 2"
                          className={compactInputClass}
                        />
                        <textarea
                          value={row.lesson2Objective}
                          onChange={(event) => updateBulkLessonRow(row.id, { lesson2Objective: event.target.value })}
                          onPaste={(event) => pasteBulkLessons(row.id, event)}
                          placeholder="Mục tiêu tiết 2"
                          className={`${compactInputClass} min-h-12 resize-y whitespace-pre-line`}
                        />
                        <input
                          value={row.samplePlanUrl}
                          onChange={(event) => updateBulkLessonRow(row.id, { samplePlanUrl: event.target.value })}
                          onPaste={(event) => pasteBulkLessons(row.id, event)}
                          placeholder="Link Google Drive/PDF"
                          className={compactInputClass}
                        />
                        <select
                          value={row.durationMinutes}
                          onChange={(event) =>
                            updateBulkLessonRow(row.id, { durationMinutes: toLessonDuration(event.target.value) })
                          }
                          onPaste={(event) => pasteBulkLessons(row.id, event)}
                          className={compactInputClass}
                        >
                          <option value="">Chọn</option>
                          {lessonDurations.map((minutes) => (
                            <option key={minutes} value={minutes}>
                              {minutes}
                            </option>
                          ))}
                        </select>
                        <button
                          title="Xóa dòng"
                          onClick={() => removeBulkLessonRow(row.id)}
                          className="grid h-11 w-11 place-items-center rounded-xl bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      {bulkLessonErrors[row.id] ? (
                        <p className="mt-1 px-2 text-xs font-bold text-rose-700">{bulkLessonErrors[row.id]}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={downloadLessonSpreadsheetTemplate}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-100 bg-white px-3 py-2 text-xs font-black text-[var(--brand-dark)] transition hover:bg-cyan-50"
                  >
                    <Download size={16} />
                    Tải mẫu spreadsheet
                  </button>
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-cyan-100 bg-white px-3 py-2 text-xs font-black text-[var(--brand-dark)] transition hover:bg-cyan-50">
                    <FileSpreadsheet size={16} />
                    Nhập từ spreadsheet
                    <input
                      type="file"
                      accept=".xlsx,.csv,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/tab-separated-values"
                      className="hidden"
                      onChange={importLessonsFromSpreadsheet}
                    />
                  </label>
                  <button
                    onClick={addBulkLessonRow}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-100 bg-white px-3 py-2 text-xs font-black text-[var(--brand-dark)] transition hover:bg-cyan-50"
                  >
                    <Plus size={16} />
                    Thêm dòng
                  </button>
                  <button onClick={saveBulkLessons} disabled={isBusy} className={primaryButtonClass}>
                    {isBusy ? <LoaderCircle className="animate-spin" size={17} /> : <Save size={17} />}
                    {isBusy ? "Đang lưu..." : "Lưu hàng loạt"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Thư viện bài học" action={`${filteredLessons.length}/${activeLessons.length} bài`}>
          <div className="mb-4 grid gap-3 md:grid-cols-[1fr_180px]">
            <label className="flex min-w-0 items-center gap-2 rounded-2xl border border-[var(--line)] bg-white px-3 py-2 shadow-sm transition focus-within:border-[var(--brand)]">
              <Search size={17} className="text-[var(--muted)]" />
              <input
                value={lessonSearchTerm}
                onChange={(event) => setLessonSearchTerm(event.target.value)}
                placeholder="Tìm chuyên đề, mục tiêu..."
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--brand-dark)] outline-none placeholder:text-slate-400"
              />
            </label>
            <select
              value={lessonGradeFilter}
              onChange={(event) => setLessonGradeFilter(event.target.value)}
              className={compactInputClass}
            >
              <option value="all">Tất cả khối</option>
              {lessonGrades.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {filteredLessons.map((lesson) => {
              const isEditing = editingLessonId === lesson.id;
              return (
                <div key={lesson.id} className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
                  {isEditing ? (
                    <div className="grid gap-3">
                      <div className="grid gap-3 md:grid-cols-[140px_1fr_120px]">
                        <select
                          value={lessonEditDraft.grade}
                          onChange={(event) => setLessonEditDraft({ ...lessonEditDraft, grade: event.target.value })}
                          className={compactInputClass}
                        >
                          {lessonGrades.map((grade) => (
                            <option key={grade}>{grade}</option>
                          ))}
                        </select>
                        <input
                          value={lessonEditDraft.title}
                          onChange={(event) => setLessonEditDraft({ ...lessonEditDraft, title: event.target.value })}
                          className={compactInputClass}
                        />
                        <select
                          value={lessonEditDraft.durationMinutes}
                          onChange={(event) =>
                            setLessonEditDraft({ ...lessonEditDraft, durationMinutes: toLessonDuration(event.target.value) })
                          }
                          className={compactInputClass}
                        >
                          <option value="">Chọn</option>
                          {lessonDurations.map((minutes) => (
                            <option key={minutes} value={minutes}>
                              {minutes} phút
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-2">
                        <div className="grid gap-2 rounded-2xl border border-cyan-100 bg-cyan-50/45 p-3">
                          <p className="text-xs font-black uppercase text-[var(--brand-dark)]">Tiết 1</p>
                          <input
                            value={lessonEditDraft.lesson1Title}
                            onChange={(event) => setLessonEditDraft({ ...lessonEditDraft, lesson1Title: event.target.value })}
                            placeholder="Tên tiết 1"
                            className={compactInputClass}
                          />
                          <textarea
                            value={lessonEditDraft.lesson1Objective}
                            onChange={(event) => setLessonEditDraft({ ...lessonEditDraft, lesson1Objective: event.target.value })}
                            placeholder="Mục tiêu tiết 1"
                            className={`${compactInputClass} min-h-24 resize-y whitespace-pre-line`}
                          />
                        </div>
                        <div className="grid gap-2 rounded-2xl border border-violet-100 bg-violet-50/45 p-3">
                          <p className="text-xs font-black uppercase text-violet-800">Tiết 2</p>
                          <input
                            value={lessonEditDraft.lesson2Title}
                            onChange={(event) => setLessonEditDraft({ ...lessonEditDraft, lesson2Title: event.target.value })}
                            placeholder="Tên tiết 2"
                            className={compactInputClass}
                          />
                          <textarea
                            value={lessonEditDraft.lesson2Objective}
                            onChange={(event) => setLessonEditDraft({ ...lessonEditDraft, lesson2Objective: event.target.value })}
                            placeholder="Mục tiêu tiết 2"
                            className={`${compactInputClass} min-h-24 resize-y whitespace-pre-line`}
                          />
                        </div>
                      </div>
                      <input
                        value={lessonEditDraft.samplePlanUrl}
                        onChange={(event) =>
                          setLessonEditDraft({ ...lessonEditDraft, samplePlanUrl: event.target.value })
                        }
                        placeholder="Link giáo án mẫu trên Google Drive/PDF"
                        className={compactInputClass}
                      />
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          onClick={() => setEditingLessonId("")}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-black text-[var(--brand-dark)] transition hover:bg-cyan-50"
                        >
                          <X size={16} />
                          Hủy
                        </button>
                        <button onClick={() => saveLessonEdit(lesson.id)} disabled={isBusy} className={primaryButtonClass}>
                          {isBusy ? <LoaderCircle className="animate-spin" size={17} /> : <Save size={17} />}
                          {isBusy ? "Đang lưu..." : "Lưu"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase text-[var(--brand)]">{lesson.grade}</p>
                          <h3 className="mt-1 text-base font-black text-[var(--brand-dark)]">{lesson.title}</h3>
                          <div className="mt-3 grid gap-2">
                            <LessonSessionCard
                              number={1}
                              title={lesson.lesson1Title ?? "Tiết 1"}
                              objective={lesson.lesson1Objective ?? lesson.objective}
                            />
                            <LessonSessionCard
                              number={2}
                              title={lesson.lesson2Title ?? "Tiết 2"}
                              objective={lesson.lesson2Objective ?? "Chưa cập nhật mục tiêu tiết 2."}
                            />
                          </div>
                          {lesson.samplePlanUrl ? (
                            <a
                              href={lesson.samplePlanUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700 transition hover:bg-blue-100"
                            >
                              <FileSpreadsheet size={14} />
                              Giáo án mẫu
                            </a>
                          ) : null}
                        </div>
                        <span className="shrink-0 rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-700">
                          {lesson.durationMinutes} phút
                        </span>
                      </div>
                      <div className="mt-4 flex justify-end gap-2">
                        <button
                          title="Sửa bài học"
                          onClick={() => startEditLesson(lesson)}
                          className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-50 text-[var(--brand-dark)] transition hover:bg-cyan-100"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          title="Xóa bài học"
                          onClick={() => setLessonDeleteTarget(lesson)}
                          className="grid h-9 w-9 place-items-center rounded-xl bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    );
  }

  function SlotsPanel() {
    const orderedSlots = [...timeSlots].sort((left, right) => left.start.localeCompare(right.start));
    const selectedSlotCount = selectedSlotIds.length;
    const allVisibleSlotsSelected =
      orderedSlots.length > 0 && orderedSlots.every((slot) => selectedSlotIds.includes(slot.id));

    return (
      <Panel
        title="Thiết lập Khung giờ dạy"
        action={`${timeSlots.length} khung • chuẩn 45/90 phút`}
        collapsed={collapsedSettingsSections.slots}
        onToggleCollapse={() => toggleSettingsSection("slots")}
      >
        <div className="grid gap-5 xl:grid-cols-[0.85fr_1.5fr]">
          <div className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Clock3 className="text-[var(--brand)]" />
              <h3 className="text-base font-black text-[var(--brand-dark)]">Thêm khung giờ</h3>
            </div>
            <div className="mt-3 grid gap-3">
              <input
                value={slotDraft.label}
                onChange={(event) => setSlotDraft({ ...slotDraft, label: event.target.value })}
                placeholder="Ví dụ: Tiết 1 hoặc Ca chuyên đề"
                className={inputClass}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="time"
                  value={slotDraft.start}
                  onChange={(event) => setSlotDraft({ ...slotDraft, start: event.target.value })}
                  className={inputClass}
                />
                <input
                  type="time"
                  value={slotDraft.end}
                  onChange={(event) => setSlotDraft({ ...slotDraft, end: event.target.value })}
                  className={inputClass}
                />
              </div>
              <p className="text-xs font-bold text-[var(--muted)]">
                Thời lượng hiện tại: {getTimeSlotDurationLabel(slotDraft.start, slotDraft.end)}.
              </p>
              <button onClick={addSlot} className={primaryButtonClass}>
                <Plus size={18} />
                Lưu khung giờ
              </button>
            </div>
            <div className="mt-5 rounded-2xl bg-cyan-50 p-4">
              <p className="text-xs font-black uppercase text-[var(--brand-dark)]">Import Excel nhanh</p>
              <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
                File mẫu chỉ nhận khung 45 phút hoặc 90 phút để đồng bộ với lịch dạy.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={downloadTimeSlotSpreadsheetTemplate}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-black text-[var(--brand-dark)] shadow-sm"
                >
                  <Download size={16} />
                  Tải mẫu Excel
                </button>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--brand)] px-3 py-2 text-sm font-black text-white shadow-sm">
                  <UploadCloud size={16} />
                  Import file
                  <input
                    type="file"
                    accept=".xlsx,.csv,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/tab-separated-values"
                    className="hidden"
                    onChange={importTimeSlotsFromSpreadsheet}
                  />
                </label>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-white shadow-sm">
            <div className="min-w-[960px]">
              <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-4 py-3">
                <span className="mr-auto text-sm font-black text-[var(--brand-dark)]">
                  {selectedSlotCount > 0 ? `Đã chọn ${selectedSlotCount} khung giờ` : "Chọn nhiều để bật/tắt nhanh"}
                </span>
                <button
                  onClick={() => updateSelectedSlotsActive(true)}
                  disabled={selectedSlotCount === 0 || isBusy}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCircle2 size={16} />
                  Bật đã chọn
                </button>
                <button
                  onClick={() => updateSelectedSlotsActive(false)}
                  disabled={selectedSlotCount === 0 || isBusy}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X size={16} />
                  Tắt đã chọn
                </button>
              </div>
              <div className="grid grid-cols-[40px_1.2fr_0.8fr_0.8fr_0.8fr_0.8fr_1fr] gap-3 border-b border-[var(--line)] bg-cyan-50 px-4 py-3 text-xs font-black uppercase text-[var(--brand-dark)]">
                <input
                  type="checkbox"
                  checked={allVisibleSlotsSelected}
                  onChange={(event) => toggleAllVisibleSlots(orderedSlots, event.target.checked)}
                  aria-label="Chọn tất cả khung giờ"
                  className="h-4 w-4 accent-[var(--brand)]"
                />
                <span>Tên</span>
                <span>Bắt đầu</span>
                <span>Kết thúc</span>
                <span>Số phút</span>
                <span>Trạng thái</span>
                <span className="text-right">Thao tác</span>
              </div>
              <div className="divide-y divide-[var(--line)]">
              {orderedSlots.map((slot) => {
                const duration = getTimeSlotDurationMinutes(slot.start, slot.end);
                const isEditing = editingSlotId === slot.id;
                const standardDuration = isValidTimeSlotDuration(slot.start, slot.end);
                return (
                  <div
                    key={slot.id}
                    className={`grid gap-3 px-4 py-3 text-sm font-semibold text-[var(--brand-dark)] lg:grid-cols-[40px_1.2fr_0.8fr_0.8fr_0.8fr_0.8fr_1fr] ${
                      slot.active === false ? "bg-slate-50 opacity-75" : "bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSlotIds.includes(slot.id)}
                      onChange={(event) => toggleSlotSelection(slot.id, event.target.checked)}
                      aria-label={`Chọn ${slot.label}`}
                      className="mt-1 h-4 w-4 accent-[var(--brand)]"
                    />
                    {isEditing ? (
                      <>
                        <input
                          value={slotEditDraft.label}
                          onChange={(event) => setSlotEditDraft((current) => ({ ...current, label: event.target.value }))}
                          className={compactInputClass}
                        />
                        <input
                          type="time"
                          value={slotEditDraft.start}
                          onChange={(event) => setSlotEditDraft((current) => ({ ...current, start: event.target.value }))}
                          className={compactInputClass}
                        />
                        <input
                          type="time"
                          value={slotEditDraft.end}
                          onChange={(event) => setSlotEditDraft((current) => ({ ...current, end: event.target.value }))}
                          className={compactInputClass}
                        />
                        <span className="rounded-full bg-orange-50 px-3 py-2 text-xs font-black text-orange-700">
                          {getTimeSlotDurationLabel(slotEditDraft.start, slotEditDraft.end)}
                        </span>
                        <label className="flex items-center gap-2 text-xs font-black text-[var(--muted)]">
                          <input
                            type="checkbox"
                            checked={slotEditDraft.active !== false}
                            onChange={(event) =>
                              setSlotEditDraft((current) => ({ ...current, active: event.target.checked }))
                            }
                          />
                          Bật
                        </label>
                        <div className="flex justify-end gap-2">
                          <button
                            title="Hủy sửa"
                            onClick={cancelEditSlot}
                            className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--line)] bg-white text-[var(--brand-dark)]"
                          >
                            <X size={14} />
                          </button>
                          <button
                            title="Lưu khung giờ"
                            onClick={() => saveSlotEdit(slot.id)}
                            className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--brand)] text-white"
                          >
                            <Save size={14} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="min-w-0 truncate">{slot.label}</span>
                        <span>{slot.start}</span>
                        <span>{slot.end}</span>
                        <span
                          className={`w-fit rounded-full px-3 py-1 text-xs font-black ${
                            standardDuration ? "bg-orange-50 text-orange-700" : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {duration > 0 ? `${duration} phút` : "Sai giờ"}
                        </span>
                        <span
                          className={`w-fit rounded-full px-3 py-1 text-xs font-black ${
                            slot.active === false ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {slot.active === false ? "Tắt" : "Bật"}
                        </span>
                        <div className="flex justify-end gap-1">
                          <button
                            title="Sửa khung giờ"
                            onClick={() => startEditSlot(slot)}
                            className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-50 text-[var(--brand-dark)]"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            title={slot.active === false ? "Bật khung giờ" : "Tắt khung giờ"}
                            onClick={() => toggleSlotActive(slot)}
                            className={`grid h-8 w-8 place-items-center rounded-lg ${
                              slot.active === false ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {slot.active === false ? <CheckCircle2 size={14} /> : <X size={14} />}
                          </button>
                          <button
                            title="Xóa mềm khung giờ"
                            onClick={() => deleteSlot(slot)}
                            className="grid h-8 w-8 place-items-center rounded-lg bg-rose-50 text-rose-700"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
                {orderedSlots.length === 0 ? (
                  <div className="px-4 py-6 text-sm font-semibold text-[var(--muted)]">Chưa có khung giờ.</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </Panel>
    );
  }

  function LessonPlansPanel() {
    return role === "admin" ? AdminLessonPlansPanel() : TeacherLessonPlansPanel();
  }

  function AdminLessonPlansPanel() {
    const searchableTerm = searchTerm.trim().toLowerCase();
    const operationalSchedules = schedules.filter((schedule) => schedule.status !== "cancelled");
    const submittedScheduleIds = new Set(lessonPlans.map((plan) => plan.scheduleId));
    const missingSchedules = operationalSchedules
      .filter((schedule) => !submittedScheduleIds.has(schedule.id))
      .sort((left, right) => left.date.localeCompare(right.date));
    const upcomingMissingSchedules = missingSchedules.filter((schedule) => isWithinNextDays(schedule.date, 3));
    const latestPlanRows = lessonPlans
      .map((plan) => {
        const schedule = schedules.find((item) => item.id === plan.scheduleId);
        return schedule ? { plan, schedule, meta: lookupSchedule(schedule) } : null;
      })
      .filter((item): item is { plan: LessonPlan; schedule: Schedule; meta: ReturnType<typeof lookupSchedule> } => Boolean(item))
      .sort((left, right) => right.plan.uploadedAt.localeCompare(left.plan.uploadedAt));

    const filteredPlanRows = latestPlanRows.filter(({ plan, schedule, meta }) => {
      const matchesTeacher = lessonPlanTeacherFilter === "all" || plan.teacherId === lessonPlanTeacherFilter;
      const matchesStatus =
        lessonPlanStatusFilter === "all" ||
        (lessonPlanStatusFilter === "uploaded" && submittedScheduleIds.has(schedule.id));
      const matchesTerm =
        !searchableTerm ||
        [plan.fileName, meta.teacher?.name, meta.lesson?.title, meta.school?.name, meta.classRoom?.name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(searchableTerm);
      return matchesTeacher && matchesStatus && matchesTerm;
    });

    const filteredMissingSchedules = missingSchedules.filter((schedule) => {
      const meta = lookupSchedule(schedule);
      const matchesTeacher = lessonPlanTeacherFilter === "all" || schedule.teacherId === lessonPlanTeacherFilter;
      const matchesStatus = lessonPlanStatusFilter === "all" || lessonPlanStatusFilter === "missing";
      const matchesTerm =
        !searchableTerm ||
        [meta.teacher?.name, meta.lesson?.title, meta.school?.name, meta.classRoom?.name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(searchableTerm);
      return matchesTeacher && matchesStatus && matchesTerm;
    });
    const filteredSubmittedSchedules = operationalSchedules
      .filter((schedule) => submittedScheduleIds.has(schedule.id))
      .filter((schedule) => {
        const meta = lookupSchedule(schedule);
        const matchesTeacher = lessonPlanTeacherFilter === "all" || schedule.teacherId === lessonPlanTeacherFilter;
        const matchesStatus = lessonPlanStatusFilter === "all" || lessonPlanStatusFilter === "uploaded";
        const matchesTerm =
          !searchableTerm ||
          [meta.teacher?.name, meta.lesson?.title, meta.school?.name, meta.classRoom?.name]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(searchableTerm);
        return matchesTeacher && matchesStatus && matchesTerm;
      })
      .sort((left, right) => left.date.localeCompare(right.date));
    const focusedMissingSchedules =
      lessonPlanAdminFocus === "upcoming-missing"
        ? filteredMissingSchedules.filter((schedule) => isWithinNextDays(schedule.date, 3))
        : filteredMissingSchedules;
    const adminFocusTitle = {
      uploaded: "Giáo án đã tải lên",
      submitted: "Lịch đã có giáo án",
      missing: "Lịch chưa có giáo án",
      "upcoming-missing": "Sắp dạy còn thiếu giáo án",
    }[lessonPlanAdminFocus];
    const adminFocusSubtitle = {
      uploaded: "Theo thời gian upload mới nhất",
      submitted: "Các lịch đã nhận được ít nhất một file",
      missing: "Các lịch chưa có file giáo án",
      "upcoming-missing": "Các lịch trong 3 ngày tới chưa có giáo án",
    }[lessonPlanAdminFocus];

    return (
      <Panel title="Tổng quan giáo án" action={`${lessonPlans.length} file • ${missingSchedules.length} lịch chưa có`}>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Stat
              icon={FileSpreadsheet}
              label="Giáo án đã nộp"
              value={lessonPlans.length}
              tone="blue"
              active={lessonPlanAdminFocus === "uploaded"}
              onClick={() => setLessonPlanAdminFocus("uploaded")}
            />
            <Stat
              icon={CheckCircle2}
              label="Lịch đã có giáo án"
              value={submittedScheduleIds.size}
              tone="emerald"
              active={lessonPlanAdminFocus === "submitted"}
              onClick={() => setLessonPlanAdminFocus("submitted")}
            />
            <Stat
              icon={Clock3}
              label="Lịch chưa có giáo án"
              value={missingSchedules.length}
              tone="orange"
              active={lessonPlanAdminFocus === "missing"}
              onClick={() => setLessonPlanAdminFocus("missing")}
            />
            <Stat
              icon={Bell}
              label="Sắp dạy còn thiếu"
              value={upcomingMissingSchedules.length}
              tone="rose"
              active={lessonPlanAdminFocus === "upcoming-missing"}
              onClick={() => setLessonPlanAdminFocus("upcoming-missing")}
            />
          </div>

          <div className="grid gap-3 rounded-2xl border border-white/75 bg-white/85 p-4 shadow-sm md:grid-cols-2 xl:grid-cols-[1fr_1fr_auto]">
            <select
              value={lessonPlanTeacherFilter}
              onChange={(event) => setLessonPlanTeacherFilter(event.target.value)}
              className={inputClass}
            >
              <option value="all">Tất cả giáo viên</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </option>
              ))}
            </select>
            <select
              value={lessonPlanStatusFilter}
              onChange={(event) => setLessonPlanStatusFilter(event.target.value as "all" | "uploaded" | "missing")}
              className={inputClass}
            >
              <option value="all">Tất cả trạng thái giáo án</option>
              <option value="uploaded">Đã nộp giáo án</option>
              <option value="missing">Chưa có giáo án</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setLessonPlanTeacherFilter("all");
                setLessonPlanStatusFilter("all");
              }}
              className={ghostButtonClass}
            >
              <RefreshCcw size={15} />
              Xóa lọc
            </button>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.35fr_0.9fr]">
            <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm">
              <div className="border-b border-[var(--line)] bg-gradient-to-r from-sky-50 to-cyan-50 px-4 py-3">
                <p className="text-sm font-black text-[var(--brand-dark)]">{adminFocusTitle}</p>
                <p className="mt-1 text-xs font-bold text-[var(--muted)]">{adminFocusSubtitle}</p>
              </div>
              <div className="divide-y divide-[var(--line)]">
                {lessonPlanAdminFocus === "uploaded" ? (
                  <>
                    {filteredPlanRows.map(({ plan, schedule, meta }) => (
                      <LessonPlanFileRow key={plan.id} plan={plan} schedule={schedule} meta={meta} />
                    ))}
                    {filteredPlanRows.length === 0 ? (
                      <div className="px-4 py-6 text-sm font-semibold text-[var(--muted)]">Chưa có giáo án phù hợp bộ lọc.</div>
                    ) : null}
                  </>
                ) : lessonPlanAdminFocus === "submitted" ? (
                  <>
                    {filteredSubmittedSchedules.map((schedule) => {
                      const meta = lookupSchedule(schedule);
                      return <LessonPlanScheduleRow key={schedule.id} schedule={schedule} meta={meta} />;
                    })}
                    {filteredSubmittedSchedules.length === 0 ? (
                      <div className="px-4 py-6 text-sm font-semibold text-[var(--muted)]">Chưa có lịch đã nộp giáo án phù hợp bộ lọc.</div>
                    ) : null}
                  </>
                ) : (
                  <>
                    {focusedMissingSchedules.map((schedule) => {
                      const meta = lookupSchedule(schedule);
                      return <MissingLessonPlanRow key={schedule.id} schedule={schedule} meta={meta} />;
                    })}
                    {focusedMissingSchedules.length === 0 ? (
                      <div className="px-4 py-6 text-sm font-semibold text-[var(--muted)]">Không có lịch thiếu giáo án phù hợp.</div>
                    ) : null}
                  </>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <Bell className="text-amber-700" />
                <div>
                  <p className="text-sm font-black text-amber-900">Lịch chưa có giáo án</p>
                  <p className="text-xs font-bold text-amber-800/75">Ưu tiên các lịch sắp dạy</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {filteredMissingSchedules.slice(0, 8).map((schedule) => {
                  const meta = lookupSchedule(schedule);
                  return (
                    <div key={schedule.id} className="rounded-2xl border border-white/80 bg-white/90 p-3 shadow-sm">
                      <p className="text-sm font-black text-[var(--brand-dark)]">{meta.lesson?.title || "Bài học"}</p>
                      <p className="mt-1 text-xs font-bold text-[var(--muted)]">
                        {meta.teacher?.name} • {meta.school?.name} • Lớp {meta.classRoom?.name}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">
                          {formatScheduleDateTime(schedule)}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {filteredMissingSchedules.length === 0 ? (
                  <p className="rounded-2xl bg-white/80 px-3 py-4 text-sm font-semibold text-emerald-700">
                    Không còn lịch thiếu giáo án theo bộ lọc.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </Panel>
    );
  }

  function TeacherLessonPlansPanel() {
    const scopedSchedules = schedules.filter((item) => item.teacherId === currentTeacherId && item.status !== "cancelled");
    const submittedScheduleIds = new Set(
      lessonPlans.filter((plan) => plan.teacherId === currentTeacherId).map((plan) => plan.scheduleId),
    );
    const pendingSchedules = scopedSchedules
      .filter((schedule) => !submittedScheduleIds.has(schedule.id))
      .sort((left, right) => left.date.localeCompare(right.date));
    const submittedSchedules = scopedSchedules
      .filter((schedule) => submittedScheduleIds.has(schedule.id))
      .sort((left, right) => left.date.localeCompare(right.date));
    const lessonPlanScheduleCards = scopedSchedules
      .slice()
      .sort((left, right) => left.date.localeCompare(right.date));
    const myPlanRows = lessonPlans
      .filter((plan) => plan.teacherId === currentTeacherId)
      .map((plan) => {
        const schedule = schedules.find((item) => item.id === plan.scheduleId);
        return schedule ? { plan, schedule, meta: lookupSchedule(schedule) } : null;
      })
      .filter((item): item is { plan: LessonPlan; schedule: Schedule; meta: ReturnType<typeof lookupSchedule> } => Boolean(item))
      .sort((left, right) => right.plan.uploadedAt.localeCompare(left.plan.uploadedAt));
    const teacherFocusTitle = {
      uploaded: "Giáo án mới nhất",
      pending: "Lịch cần nộp giáo án",
      submitted: "Lịch đã có giáo án",
    }[lessonPlanTeacherFocus];
    const teacherFocusSubtitle = {
      uploaded: "Sắp xếp theo thời gian upload mới nhất",
      pending: "Các lịch chưa có file giáo án",
      submitted: "Các lịch đã có ít nhất một file",
    }[lessonPlanTeacherFocus];

    return (
      <Panel title="Giáo án của tôi" action={`${myPlanRows.length} file • ${pendingSchedules.length} cần nộp`}>
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-2">
            <Stat
              icon={FileSpreadsheet}
              label="Giáo án đã gửi"
              value={myPlanRows.length}
              tone="blue"
              active={lessonPlanTeacherFocus === "uploaded"}
              onClick={() => setLessonPlanTeacherFocus("uploaded")}
            />
            <Stat
              icon={Clock3}
              label="Lịch cần nộp"
              value={pendingSchedules.length}
              tone="orange"
              active={lessonPlanTeacherFocus === "pending"}
              onClick={() => setLessonPlanTeacherFocus("pending")}
            />
            <Stat
              icon={CheckCircle2}
              label="Lịch đã có giáo án"
              value={submittedScheduleIds.size}
              tone="emerald"
              active={lessonPlanTeacherFocus === "submitted"}
              onClick={() => setLessonPlanTeacherFocus("submitted")}
            />
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <FileUp className="text-amber-700" />
              <div>
                <p className="text-sm font-black text-amber-900">Lịch dạy và giáo án theo chuyên đề</p>
                <p className="text-xs font-bold text-amber-800/75">
                  File/link giáo án hiển thị ngay trong từng card sau khi tải lên.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {lessonPlanScheduleCards.map((schedule) => {
                const meta = lookupSchedule(schedule);
                return <TeacherLessonPlanCard key={schedule.id} schedule={schedule} meta={meta} />;
              })}
              {lessonPlanScheduleCards.length === 0 ? (
                <p className="rounded-2xl bg-white/80 px-4 py-5 text-sm font-semibold text-emerald-700">
                  Chưa có lịch cần nộp giáo án.
                </p>
              ) : null}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm">
            <div className="border-b border-[var(--line)] bg-gradient-to-r from-sky-50 to-cyan-50 px-4 py-3">
              <p className="text-sm font-black text-[var(--brand-dark)]">{teacherFocusTitle}</p>
              <p className="mt-1 text-xs font-bold text-[var(--muted)]">{teacherFocusSubtitle}</p>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {lessonPlanTeacherFocus === "uploaded" ? (
                <>
                  {myPlanRows.map(({ plan, schedule, meta }) => (
                    <LessonPlanFileRow key={plan.id} plan={plan} schedule={schedule} meta={meta} />
                  ))}
                  {myPlanRows.length === 0 ? (
                    <div className="px-4 py-6 text-sm font-semibold text-[var(--muted)]">Bạn chưa tải giáo án nào.</div>
                  ) : null}
                </>
              ) : lessonPlanTeacherFocus === "pending" ? (
                <>
                  {pendingSchedules.map((schedule) => {
                    const meta = lookupSchedule(schedule);
                    return <MissingLessonPlanRow key={schedule.id} schedule={schedule} meta={meta} allowUpload />;
                  })}
                  {pendingSchedules.length === 0 ? (
                    <div className="px-4 py-6 text-sm font-semibold text-emerald-700">Bạn không còn lịch thiếu giáo án.</div>
                  ) : null}
                </>
              ) : (
                <>
                  {submittedSchedules.map((schedule) => {
                    const meta = lookupSchedule(schedule);
                    return <LessonPlanScheduleRow key={schedule.id} schedule={schedule} meta={meta} />;
                  })}
                  {submittedSchedules.length === 0 ? (
                    <div className="px-4 py-6 text-sm font-semibold text-[var(--muted)]">Chưa có lịch đã nộp giáo án.</div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      </Panel>
    );
  }

  function LessonPlanFileRow({
    plan,
    schedule,
    meta,
  }: {
    plan: LessonPlan;
    schedule: Schedule;
    meta: ReturnType<typeof lookupSchedule>;
  }) {
    return (
      <div className="grid gap-3 px-4 py-3 lg:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <a
            href={plan.driveUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-full items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-sm font-black text-sky-800"
          >
            <UploadCloud size={16} />
            <span className="truncate">{plan.fileName}</span>
          </a>
          <p className="mt-2 text-sm font-bold text-[var(--brand-dark)]">
            {meta.lesson?.title || "Bài học"} • {meta.teacher?.name || "Giáo viên"}
          </p>
          <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
            {meta.school?.name} • Lớp {meta.classRoom?.name} • {formatScheduleDateTime(schedule)}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 lg:justify-end">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
            {formatDateTime(plan.uploadedAt)}
          </span>
          <LessonPlanActions plan={plan} />
        </div>
      </div>
    );
  }

  function TeacherLessonPlanCard({
    schedule,
    meta,
  }: {
    schedule: Schedule;
    meta: ReturnType<typeof lookupSchedule>;
  }) {
    const hasPlans = meta.plans.length > 0;
    return (
      <div
        className={`rounded-2xl border p-4 shadow-sm ${
          hasPlans ? "border-emerald-200 bg-emerald-50/55" : "border-white/80 bg-white/90"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-black uppercase text-[var(--brand-dark)]">{meta.lesson?.title || "Bài học"}</p>
            <p className="mt-1 text-xs font-bold text-[var(--muted)]">
              {meta.school?.name} • Lớp {meta.classRoom?.name} • {formatScheduleDateTime(schedule)}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-black ${
              hasPlans ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
            }`}
          >
            {hasPlans ? `${meta.plans.length} giáo án` : "Chưa có"}
          </span>
        </div>

        {hasPlans ? (
          <div className="mt-3 space-y-2">
            {meta.plans.map((plan) => (
              <div key={plan.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-white/90 px-3 py-2">
                <a
                  href={plan.driveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-w-0 max-w-full items-center gap-2 text-sm font-black text-sky-800"
                >
                  <UploadCloud size={15} />
                  <span className="truncate">{plan.fileName}</span>
                  {plan.source === "external_link" ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase text-amber-800">
                      Link
                    </span>
                  ) : null}
                </a>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700">
                    {formatDateTime(plan.uploadedAt)}
                  </span>
                  <LessonPlanActions plan={plan} />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-3 grid gap-2">
          <div className="flex flex-wrap gap-2">
            <LessonPlanUploadButton schedule={schedule} />
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <input
              value={lessonPlanLinkDrafts[schedule.id] || ""}
              onChange={(event) =>
                setLessonPlanLinkDrafts((items) => ({ ...items, [schedule.id]: event.target.value }))
              }
              placeholder="Dán link PPT/PPTX từ Google Drive nếu file nặng hơn 10MB (mở quyền xem cho admin)"
              className={compactInputClass}
            />
            <button
              type="button"
              onClick={() => attachLessonPlanLink(schedule)}
              disabled={isBusy}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-black text-amber-800 transition hover:bg-amber-50"
            >
              <ExternalLink size={15} />
              Lưu link
            </button>
          </div>
        </div>
      </div>
    );
  }

  function TeacherOverviewPanel() {
    const teacher = teachers.find((item) => item.id === currentTeacherId);
    const today = currentDateKey();
    const scopedSchedules = schedules.filter(
      (schedule) =>
        schedule.teacherId === currentTeacherId &&
        schedule.status !== "cancelled" &&
        isDateWithinRange(schedule.date, teacherOverviewDateFrom, teacherOverviewDateTo),
    );
    const attendanceBySchedule = new Map(
      attendance
        .filter((record) => record.teacherId === currentTeacherId)
        .map((record) => [record.scheduleId, record] as const),
    );
    const taughtSchedules = scopedSchedules.filter(
      (schedule) => isAttendanceTrackedSchedule(schedule) && attendanceBySchedule.has(schedule.id),
    );
    const upcomingSchedules = scopedSchedules.filter((schedule) => schedule.date >= today);
    const pastTrackedSchedules = scopedSchedules.filter(
      (schedule) => schedule.date < today && isAttendanceTrackedSchedule(schedule),
    );
    const lateAttendanceSchedules = taughtSchedules.filter((schedule) =>
      isLateAttendance(schedule, attendanceBySchedule.get(schedule.id), timeSlots),
    );
    const missingAttendanceSchedules = pastTrackedSchedules.filter((schedule) => !attendanceBySchedule.has(schedule.id));
    const submittedPlanScheduleIds = new Set(
      lessonPlans.filter((plan) => plan.teacherId === currentTeacherId).map((plan) => plan.scheduleId),
    );
    const submittedPlanSchedules = scopedSchedules.filter((schedule) => submittedPlanScheduleIds.has(schedule.id));
    const missingPlanSchedules = scopedSchedules.filter((schedule) => !submittedPlanScheduleIds.has(schedule.id));
    const taughtInClassSchedules = taughtSchedules.filter(
      (schedule) => normalizeTeachingEnvironmentValue(schedule.teachingEnvironment) === "in_class",
    );
    const taughtOutdoorSchedules = taughtSchedules.filter(
      (schedule) => normalizeTeachingEnvironmentValue(schedule.teachingEnvironment) === "outdoor",
    );
    const taughtGymSchedules = taughtSchedules.filter(
      (schedule) => normalizeTeachingEnvironmentValue(schedule.teachingEnvironment) === "gym",
    );
    const taughtSchoolyardReportSchedules = taughtSchedules.filter(
      (schedule) => normalizeTeachingEnvironmentValue(schedule.teachingEnvironment) === "schoolyard_report",
    );

    const detailRows: Record<TeacherOverviewFocus, Schedule[]> = {
      taught: taughtSchedules,
      upcoming: upcomingSchedules,
      late: lateAttendanceSchedules,
      "missing-attendance": missingAttendanceSchedules,
      "plan-submitted": submittedPlanSchedules,
      "plan-missing": missingPlanSchedules,
      "env-in-class": taughtInClassSchedules,
      "env-outdoor": taughtOutdoorSchedules,
      "env-gym": taughtGymSchedules,
      "env-schoolyard-report": taughtSchoolyardReportSchedules,
    };
    const detailTitles: Record<TeacherOverviewFocus, string> = {
      taught: "Các tiết đã dạy",
      upcoming: "Các tiết sắp dạy",
      late: "Các lần điểm danh trễ",
      "missing-attendance": "Các lịch chưa điểm danh",
      "plan-submitted": "Các lịch đã gửi giáo án",
      "plan-missing": "Các lịch chưa gửi giáo án",
      "env-in-class": "Tiết đã dạy: Trong lớp",
      "env-outdoor": "Tiết đã dạy: Ngoài sân",
      "env-gym": "Tiết đã dạy: Nhà thi đấu",
      "env-schoolyard-report": "Tiết đã dạy: Báo cáo sân trường",
    };
    const selectedRows = teacherOverviewFocus ? detailRows[teacherOverviewFocus] : [];
    const selectedTitle = teacherOverviewFocus ? detailTitles[teacherOverviewFocus] : "";
    const dateRangeLabel =
      teacherOverviewDateFrom || teacherOverviewDateTo
        ? `${teacherOverviewDateFrom || "..."} đến ${teacherOverviewDateTo || "..."}`
        : "Toàn thời gian";

    return (
      <div className="space-y-5">
        <Panel title={`Tổng quan giáo viên ${teacher?.name || ""}`} action={dateRangeLabel}>
          <div className="space-y-4">
            <div className="grid gap-3 rounded-2xl border border-cyan-100 bg-cyan-50/50 p-3 md:grid-cols-[1fr_1fr_auto]">
              <input
                type="date"
                value={teacherOverviewDateFrom}
                onChange={(event) => setTeacherOverviewDateFrom(event.target.value)}
                className={compactInputClass}
              />
              <input
                type="date"
                value={teacherOverviewDateTo}
                onChange={(event) => setTeacherOverviewDateTo(event.target.value)}
                className={compactInputClass}
              />
              <button
                type="button"
                onClick={() => {
                  setTeacherOverviewDateFrom("");
                  setTeacherOverviewDateTo("");
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-white px-3 py-2 text-xs font-black text-[var(--brand-dark)] transition hover:bg-cyan-50"
              >
                <SlidersHorizontal size={15} />
                Xóa lọc thời gian
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
                <Stat
                  icon={CalendarDays}
                  label="Số lịch đã dạy"
                  value={taughtSchedules.length}
                  tone="cyan"
                  active={teacherOverviewFocus === "taught"}
                  onClick={() => setTeacherOverviewFocus("taught")}
                />
                <Stat
                  icon={Clock3}
                  label="Số lịch sắp dạy"
                  value={upcomingSchedules.length}
                  tone="blue"
                  active={teacherOverviewFocus === "upcoming"}
                  onClick={() => setTeacherOverviewFocus("upcoming")}
                />
                <Stat
                  icon={Clock3}
                  label="Số lần điểm danh trễ"
                  value={lateAttendanceSchedules.length}
                  tone="amber"
                  active={teacherOverviewFocus === "late"}
                  onClick={() => setTeacherOverviewFocus("late")}
                />
                <Stat
                  icon={Users}
                  label="Số lần không điểm danh"
                  value={missingAttendanceSchedules.length}
                  tone="rose"
                  active={teacherOverviewFocus === "missing-attendance"}
                  onClick={() => setTeacherOverviewFocus("missing-attendance")}
                />
                <Stat
                  icon={FileUp}
                  label="Giáo án đã gửi"
                  value={submittedPlanSchedules.length}
                  tone="emerald"
                  active={teacherOverviewFocus === "plan-submitted"}
                  onClick={() => setTeacherOverviewFocus("plan-submitted")}
                />
                <Stat
                  icon={FileUp}
                  label="Giáo án chưa gửi"
                  value={missingPlanSchedules.length}
                  tone="violet"
                  active={teacherOverviewFocus === "plan-missing"}
                  onClick={() => setTeacherOverviewFocus("plan-missing")}
                />
              </div>

            <Panel title="Tổng số tiết đã dạy theo môi trường" action={`${taughtSchedules.length} tiết`}>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Stat
                  icon={School2}
                  label="Trong lớp"
                  value={taughtInClassSchedules.length}
                  tone="cyan"
                  active={teacherOverviewFocus === "env-in-class"}
                  onClick={() => setTeacherOverviewFocus("env-in-class")}
                />
                <Stat
                  icon={School2}
                  label="Ngoài sân"
                  value={taughtOutdoorSchedules.length}
                  tone="emerald"
                  active={teacherOverviewFocus === "env-outdoor"}
                  onClick={() => setTeacherOverviewFocus("env-outdoor")}
                />
                <Stat
                  icon={School2}
                  label="Nhà thi đấu"
                  value={taughtGymSchedules.length}
                  tone="blue"
                  active={teacherOverviewFocus === "env-gym"}
                  onClick={() => setTeacherOverviewFocus("env-gym")}
                />
                <Stat
                  icon={School2}
                  label="Báo cáo sân trường"
                  value={taughtSchoolyardReportSchedules.length}
                  tone="orange"
                  active={teacherOverviewFocus === "env-schoolyard-report"}
                  onClick={() => setTeacherOverviewFocus("env-schoolyard-report")}
                />
              </div>
            </Panel>
          </div>
        </Panel>

        {teacherOverviewFocus ? (
          <div className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-slate-950/35 p-4 backdrop-blur-sm">
            <div
              data-modal-scroll="true"
              className="app-scrollbar max-h-[calc(100dvh-2rem)] w-full max-w-5xl overflow-y-auto overscroll-contain rounded-3xl border border-cyan-100 bg-white p-5 shadow-2xl ring-1 ring-orange-100"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-[var(--brand-dark)]">{selectedTitle}</h2>
                  <p className="mt-1 text-sm font-bold text-[var(--muted)]">
                    {selectedRows.length} lịch • {dateRangeLabel}
                  </p>
                </div>
                <button
                  type="button"
                  title="Đóng"
                  onClick={() => setTeacherOverviewFocus(null)}
                  className="grid h-10 w-10 place-items-center rounded-xl bg-slate-50 text-[var(--brand-dark)] transition hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>
              <ScheduleList items={selectedRows} compact />
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  function LessonPlanScheduleRow({
    schedule,
    meta,
  }: {
    schedule: Schedule;
    meta: ReturnType<typeof lookupSchedule>;
  }) {
    return (
      <div className="grid gap-3 px-4 py-3 lg:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <p className="text-sm font-black text-[var(--brand-dark)]">{meta.lesson?.title || "Bài học"}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
            {meta.teacher?.name || "Giáo viên"} • {meta.school?.name} • Lớp {meta.classRoom?.name} • {formatScheduleDateTime(schedule)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {meta.plans.map((plan) => (
              <div key={plan.id} className="inline-flex max-w-full items-center gap-2 rounded-xl bg-sky-50 px-3 py-2">
                <a
                  href={plan.driveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-w-0 items-center gap-2 text-xs font-black text-sky-800"
                >
                  <UploadCloud size={14} />
                  <span className="truncate">{plan.fileName}</span>
                </a>
                <LessonPlanActions plan={plan} />
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 lg:justify-end">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
            {meta.plans.length} file
          </span>
        </div>
      </div>
    );
  }

  function MissingLessonPlanRow({
    schedule,
    meta,
    allowUpload = false,
  }: {
    schedule: Schedule;
    meta: ReturnType<typeof lookupSchedule>;
    allowUpload?: boolean;
  }) {
    return (
      <div className="grid gap-3 px-4 py-3 lg:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <p className="text-sm font-black text-[var(--brand-dark)]">{meta.lesson?.title || "Bài học"}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
            {meta.teacher?.name || "Giáo viên"} • {meta.school?.name} • Lớp {meta.classRoom?.name} • {formatScheduleDateTime(schedule)}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 lg:justify-end">
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">Chưa có giáo án</span>
          {allowUpload ? <LessonPlanUploadButton schedule={schedule} compact /> : null}
        </div>
      </div>
    );
  }

  function LessonPlanActions({ plan }: { plan: LessonPlan }) {
    return canManageLessonPlan(plan) ? (
      <div className="flex items-center gap-2">
        <button
          type="button"
          title="Sửa tên giáo án"
          onClick={() => editLessonPlan(plan)}
          className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-50 text-[var(--brand-dark)] transition hover:bg-cyan-100"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          title="Xóa giáo án"
          onClick={() => deleteLessonPlan(plan)}
          className="grid h-8 w-8 place-items-center rounded-lg bg-rose-50 text-rose-700 transition hover:bg-rose-100"
        >
          <Trash2 size={14} />
        </button>
      </div>
    ) : null;
  }

  function LessonPlanUploadButton({ schedule, compact = false }: { schedule: Schedule; compact?: boolean }) {
    return (
      <label
        className={`inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-sm font-black text-white shadow-lg shadow-orange-500/20 transition hover:-translate-y-0.5 ${
          compact ? "h-9 px-3 text-xs" : "h-11 px-4"
        }`}
      >
        <FileUp size={compact ? 15 : 17} />
        Tải lên
        <input
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv"
          className="hidden"
          onChange={(event) => {
            uploadLessonPlans(schedule, event.target.files);
            event.currentTarget.value = "";
          }}
        />
      </label>
    );
  }

  function AttendancePanel() {
    const scopedSchedules =
      role === "admin" ? schedules : schedules.filter((item) => item.teacherId === currentTeacherId);
    const today = currentDateKey();
    const scopedScheduleIds = new Set(scopedSchedules.map((schedule) => schedule.id));
    const attendanceToday = attendance.filter((record) => dateTimeDateKey(record.checkedInAt) === today);
    const todaySchedules = scopedSchedules.filter((schedule) => schedule.date === today && isAttendanceTrackedSchedule(schedule));
    const checkedToday = attendanceToday
      .map((record) => schedules.find((schedule) => schedule.id === record.scheduleId))
      .filter(
        (schedule): schedule is Schedule =>
          Boolean(schedule && scopedScheduleIds.has(schedule.id) && isAttendanceTrackedSchedule(schedule)),
      );
    const missingToday = todaySchedules.filter((schedule) => !lookupSchedule(schedule).checkIn);
    const lateToday = checkedToday.filter((schedule) =>
      isLateAttendance(schedule, lookupSchedule(schedule).checkIn, timeSlots),
    );
    const selectedAttendanceRows =
      attendanceAdminFocus === "all-today"
        ? todaySchedules
        : attendanceAdminFocus === "checked-today"
          ? checkedToday
          : attendanceAdminFocus === "missing-today"
            ? missingToday
            : attendanceAdminFocus === "late-today"
              ? lateToday
              : [];
    const selectedAttendanceTitle = {
      "all-today": "Tất cả tiết hôm nay",
      "checked-today": "Đã điểm danh hôm nay",
      "missing-today": "Chưa điểm danh hôm nay",
      "late-today": "Điểm danh trễ hôm nay",
    }[attendanceAdminFocus ?? "all-today"];
    const teacherWarnings = buildAttendanceTeacherWarnings(schedules, attendance, teachers, timeSlots);
    const selectedWarning = attendanceWarningFocus
      ? teacherWarnings.find((warning) => warning.teacher.id === attendanceWarningFocus.teacherId)
      : undefined;
    const selectedWarningRows =
      selectedWarning && attendanceWarningFocus?.kind === "missing"
        ? selectedWarning.missingSchedules
        : selectedWarning && attendanceWarningFocus?.kind === "late"
          ? selectedWarning.lateSchedules
          : [];
    const selectedWarningTitle = selectedWarning
      ? `${selectedWarning.teacher.name} - ${
          attendanceWarningFocus?.kind === "missing" ? "các lần chưa điểm danh" : "các lần điểm danh trễ"
        }`
      : "";

    if (role === "admin") {
      return (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Stat
              icon={CalendarDays}
              label="Tiết hôm nay"
              value={todaySchedules.length}
              tone="cyan"
              onClick={() => setAttendanceAdminFocus("all-today")}
            />
            <Stat
              icon={CheckCircle2}
              label="Đã điểm danh hôm nay"
              value={checkedToday.length}
              tone="emerald"
              onClick={() => setAttendanceAdminFocus("checked-today")}
            />
            <Stat
              icon={Users}
              label="Chưa điểm danh hôm nay"
              value={missingToday.length}
              tone="rose"
              onClick={() => setAttendanceAdminFocus("missing-today")}
            />
            <Stat
              icon={Clock3}
              label="Điểm danh trễ hôm nay"
              value={lateToday.length}
              tone="orange"
              onClick={() => setAttendanceAdminFocus("late-today")}
            />
          </div>

          <Panel title="Cảnh báo điểm danh" action={`${teacherWarnings.length} giáo viên cần theo dõi`}>
            <div className="space-y-3">
              {teacherWarnings.length > 0 ? (
                teacherWarnings.map((warning) => (
                  <div
                    key={warning.teacher.id}
                    className="grid gap-3 rounded-2xl border border-rose-100 bg-rose-50/60 p-4 md:grid-cols-[1fr_auto_auto]"
                  >
                    <div>
                      <p className="text-sm font-black text-[var(--brand-dark)]">{warning.teacher.name}</p>
                      <p className="mt-1 text-xs font-bold text-slate-600">
                        {warning.teacher.phone || "Chưa có SĐT"} · {warning.teacher.email}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttendanceWarningFocus({ teacherId: warning.teacher.id, kind: "missing" })}
                      className="rounded-full bg-white px-3 py-2 text-xs font-black text-rose-700 transition hover:bg-rose-100"
                    >
                      {warning.missingCount} lần chưa điểm danh
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttendanceWarningFocus({ teacherId: warning.teacher.id, kind: "late" })}
                      className="rounded-full bg-white px-3 py-2 text-xs font-black text-orange-700 transition hover:bg-orange-100"
                    >
                      {warning.lateCount} lần trễ
                    </button>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-5 text-sm font-bold text-emerald-800">
                  Chưa có giáo viên vượt ngưỡng cảnh báo trong dữ liệu hiện tại.
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Lịch sử điểm danh gần nhất" action={`${attendance.length} bản ghi`}>
            <div className="space-y-3">
              {attendance.slice(0, 8).map((record) => {
                const schedule = schedules.find((item) => item.id === record.scheduleId);
                if (!schedule) {
                  return null;
                }
                return <AttendanceScheduleRow key={record.id} schedule={schedule} />;
              })}
            </div>
          </Panel>

          {attendanceAdminFocus ? (
            <div className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-slate-950/35 p-4 backdrop-blur-sm">
              <div
                data-modal-scroll="true"
                className="app-scrollbar max-h-[calc(100dvh-2rem)] w-full max-w-4xl overflow-y-auto overscroll-contain rounded-3xl border border-cyan-100 bg-white p-5 shadow-2xl ring-1 ring-orange-100"
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-black text-[var(--brand-dark)]">{selectedAttendanceTitle}</h2>
                    <p className="mt-1 text-sm font-bold text-[var(--muted)]">{formatDate(today)}</p>
                  </div>
                  <button
                    type="button"
                    title="Đóng"
                    onClick={() => setAttendanceAdminFocus(null)}
                    className="grid h-10 w-10 place-items-center rounded-xl bg-slate-50 text-[var(--brand-dark)] transition hover:bg-slate-100"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="space-y-3">
                  {selectedAttendanceRows.length > 0 ? (
                    selectedAttendanceRows.map((schedule) => (
                      <AttendanceScheduleRow key={schedule.id} schedule={schedule} showLateDetail />
                    ))
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm font-bold text-slate-600">
                      Không có tiết phù hợp.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {attendanceWarningFocus ? (
            <div className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-slate-950/35 p-4 backdrop-blur-sm">
              <div
                data-modal-scroll="true"
                className="app-scrollbar max-h-[calc(100dvh-2rem)] w-full max-w-4xl overflow-y-auto overscroll-contain rounded-3xl border border-cyan-100 bg-white p-5 shadow-2xl ring-1 ring-orange-100"
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-black text-[var(--brand-dark)]">{selectedWarningTitle}</h2>
                    <p className="mt-1 text-sm font-bold text-[var(--muted)]">
                      {selectedWarningRows.length} lịch cần kiểm tra
                    </p>
                  </div>
                  <button
                    type="button"
                    title="Đóng"
                    onClick={() => setAttendanceWarningFocus(null)}
                    className="grid h-10 w-10 place-items-center rounded-xl bg-slate-50 text-[var(--brand-dark)] transition hover:bg-slate-100"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="space-y-3">
                  {selectedWarningRows.length > 0 ? (
                    selectedWarningRows.map((schedule) => (
                      <AttendanceScheduleRow key={schedule.id} schedule={schedule} showLateDetail />
                    ))
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm font-bold text-slate-600">
                      Không có lịch phù hợp.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <Panel title="Điểm danh từng tiết" action="Lưu thời gian bấm">
        <div className="space-y-3">
          {scopedSchedules.map((schedule) => {
            const meta = lookupSchedule(schedule);
            const isCheckedIn = Boolean(meta.checkIn);
            const isCancelled = schedule.status === "cancelled";
            return (
              <div
                key={schedule.id}
                className="grid gap-4 rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm lg:grid-cols-[1fr_auto]"
              >
                <div>
                  <p className="text-sm font-black text-[var(--brand-dark)]">
                    {meta.slot?.label} - {meta.lesson?.title}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {meta.teacher?.name} tại {meta.school?.name}, lớp {meta.classRoom?.name}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-black">
                    <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-cyan-800">
                      <CalendarDays size={14} />
                      Ngày dạy {formatDate(schedule.date)}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-indigo-700">
                      <Clock3 size={14} />
                      Bắt đầu {meta.slot?.start || "--:--"} · Kết thúc {meta.slot?.end || "--:--"}
                    </span>
                  </div>
                  {meta.checkIn ? (
                    <p className="mt-2 text-sm font-bold text-emerald-700">
                      Đã điểm danh lúc {formatDateTime(meta.checkIn.checkedInAt)}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm font-bold text-orange-700">Chưa điểm danh</p>
                  )}
                </div>
                <button
                  onClick={() => checkIn(schedule)}
                  disabled={isCheckedIn || isCancelled}
                  className={
                    isCheckedIn || isCancelled
                      ? "inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-200 px-4 py-3 text-sm font-black text-slate-500 shadow-none"
                      : primaryButtonClass
                  }
                >
                  <CheckCircle2 size={18} />
                  {isCheckedIn ? "Đã điểm danh" : "Điểm danh"}
                </button>
              </div>
            );
          })}
        </div>
      </Panel>
    );
  }

  function AttendanceScheduleRow({ schedule, showLateDetail = false }: { schedule: Schedule; showLateDetail?: boolean }) {
    const meta = lookupSchedule(schedule);
    const lateMinutes = getAttendanceLateMinutes(schedule, meta.checkIn, timeSlots);
    return (
      <div className="grid gap-3 rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm md:grid-cols-[1fr_auto]">
        <div>
          <p className="text-sm font-black text-[var(--brand-dark)]">{meta.lesson?.title || "Chưa rõ chuyên đề"}</p>
          <p className="mt-1 text-sm font-bold text-[var(--muted)]">
            {meta.teacher?.name || "Chưa rõ giáo viên"} · {meta.school?.name || "Chưa rõ trường"} · Lớp{" "}
            {meta.classRoom?.name || "?"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-black">
            <span className="rounded-full bg-cyan-50 px-2 py-1 text-cyan-800">Ngày dạy {formatDate(schedule.date)}</span>
            <span className="rounded-full bg-indigo-50 px-2 py-1 text-indigo-700">
              {meta.slot?.label || "Khung giờ"} {formatSlotRange(meta.slot)}
            </span>
            <span className={`rounded-full px-2 py-1 ${meta.checkIn ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
              {meta.checkIn ? `Đã điểm danh ${formatDateTime(meta.checkIn.checkedInAt)}` : "Chưa điểm danh"}
            </span>
            {showLateDetail && lateMinutes > 0 ? (
              <span className="rounded-full bg-orange-50 px-2 py-1 text-orange-700">Trễ {lateMinutes} phút</span>
            ) : null}
          </div>
        </div>
        <div className="justify-self-end self-start">
          <StatusChip status={schedule.status} />
        </div>
      </div>
    );
  }

  function WeeklyUpdatesPanel() {
    const sortedUpdates = [...weeklyUpdates].sort((a, b) => {
      if (b.weekNumber !== a.weekNumber) return b.weekNumber - a.weekNumber;
      return (b.updateDate || "").localeCompare(a.updateDate || "");
    });

    const classesForSchool = (sid: string) => classes.filter((c) => c.schoolId === sid);

    async function createWeeklyUpdate() {
      const weekNum = Number(weeklyUpdateDraft.weekNumber);
      if (!weekNum || weekNum <= 0) {
        pushToast("Lỗi", "Tuần phải lớn hơn 0.", "error");
        return;
      }
      if (!weeklyUpdateDraft.schoolId) {
        pushToast("Lỗi", "Vui lòng chọn trường.", "error");
        return;
      }
      if (!weeklyUpdateDraft.classId) {
        pushToast("Lỗi", "Vui lòng chọn lớp.", "error");
        return;
      }
      const hours = Number(weeklyUpdateDraft.teachingHours || 0);
      if (hours < 0 || Number.isNaN(hours)) {
        pushToast("Lỗi", "Số giờ dạy phải lớn hơn hoặc bằng 0.", "error");
        return;
      }

      try {
        const created = await saveRequest<WeeklyUpdate>("Đang lưu cập nhật tuần...", "/api/weekly-updates", {
          method: "POST",
          body: JSON.stringify({
            weekNumber: weekNum,
            updateDate: weeklyUpdateDraft.updateDate,
            schoolId: weeklyUpdateDraft.schoolId,
            classId: weeklyUpdateDraft.classId,
            teachingHours: hours,
            note: weeklyUpdateDraft.note || undefined,
          }),
        });
        setWeeklyUpdates((items) => [created, ...items]);
        setWeeklyUpdateDraft({
          weekNumber: "",
          updateDate: currentDateKey(),
          schoolId: "",
          classId: "",
          teachingHours: "",
          note: "",
        });
        setDataStatus("connected");
        setSaveError("");
        pushToast("Thành công", "Đã lưu cập nhật tuần.", "success");
      } catch (error) {
        handleSaveError(error);
      }
    }

    function startEditWeeklyUpdate(update: WeeklyUpdate) {
      setEditingWeeklyUpdateId(update.id);
      setWeeklyUpdateEditDraft({
        weekNumber: String(update.weekNumber),
        updateDate: update.updateDate || "",
        schoolId: update.schoolId,
        classId: update.classId,
        teachingHours: String(update.teachingHours ?? 0),
        note: update.note ?? "",
      });
    }

    async function saveWeeklyUpdateEdit(id: string) {
      const weekNum = Number(weeklyUpdateEditDraft.weekNumber);
      if (!weekNum || weekNum <= 0) {
        pushToast("Lỗi", "Tuần phải lớn hơn 0.", "error");
        return;
      }
      const hours = Number(weeklyUpdateEditDraft.teachingHours || 0);
      if (hours < 0 || Number.isNaN(hours)) {
        pushToast("Lỗi", "Số giờ dạy phải lớn hơn hoặc bằng 0.", "error");
        return;
      }

      try {
        const updated = await saveRequest<WeeklyUpdate>("Đang cập nhật...", "/api/weekly-updates", {
          method: "PUT",
          body: JSON.stringify({
            id,
            weekNumber: weekNum,
            updateDate: weeklyUpdateEditDraft.updateDate,
            schoolId: weeklyUpdateEditDraft.schoolId,
            classId: weeklyUpdateEditDraft.classId,
            teachingHours: hours,
            note: weeklyUpdateEditDraft.note || undefined,
          }),
        });
        setWeeklyUpdates((items) => items.map((item) => (item.id === id ? { ...item, ...updated } : item)));
        setEditingWeeklyUpdateId("");
        setDataStatus("connected");
        setSaveError("");
        pushToast("Thành công", "Đã cập nhật.", "success");
      } catch (error) {
        handleSaveError(error);
      }
    }

    async function deleteWeeklyUpdate(id: string) {
      try {
        await saveRequest("Đang xóa...", `/api/weekly-updates?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        setWeeklyUpdates((items) => items.filter((item) => item.id !== id));
        setWeeklyUpdateDeleteTarget(null);
        setDataStatus("connected");
        setSaveError("");
        pushToast("Thành công", "Đã xóa cập nhật tuần.", "success");
      } catch (error) {
        handleSaveError(error);
      }
    }

    const totalHours = weeklyUpdates.reduce((sum, u) => sum + (u.teachingHours ?? 0), 0);
    const uniqueWeeks = new Set(weeklyUpdates.map((u) => u.weekNumber)).size;

    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Stat icon={ListChecks} label="Tổng cập nhật" value={weeklyUpdates.length} tone="cyan" />
          <Stat icon={CalendarDays} label="Số tuần" value={uniqueWeeks} tone="emerald" />
          <Stat icon={Clock3} label="Tổng giờ dạy" value={totalHours} tone="blue" />
        </div>

        <Panel title="Thêm cập nhật tuần" action="Nhập mới">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-600">Tuần số *</span>
              <input
                type="number"
                min={1}
                value={weeklyUpdateDraft.weekNumber}
                onChange={(e) => setWeeklyUpdateDraft({ ...weeklyUpdateDraft, weekNumber: e.target.value })}
                placeholder="VD: 1"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-600">Ngày cập nhật</span>
              <input
                type="date"
                value={weeklyUpdateDraft.updateDate}
                onChange={(e) => setWeeklyUpdateDraft({ ...weeklyUpdateDraft, updateDate: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-600">Trường *</span>
              <select
                value={weeklyUpdateDraft.schoolId}
                onChange={(e) =>
                  setWeeklyUpdateDraft({ ...weeklyUpdateDraft, schoolId: e.target.value, classId: "" })
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]"
              >
                <option value="">-- Chọn trường --</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-600">Lớp *</span>
              <select
                value={weeklyUpdateDraft.classId}
                onChange={(e) => setWeeklyUpdateDraft({ ...weeklyUpdateDraft, classId: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]"
              >
                <option value="">-- Chọn lớp --</option>
                {classesForSchool(weeklyUpdateDraft.schoolId).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-600">Số giờ dạy</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={weeklyUpdateDraft.teachingHours}
                onChange={(e) => setWeeklyUpdateDraft({ ...weeklyUpdateDraft, teachingHours: e.target.value })}
                placeholder="VD: 2"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]"
              />
            </label>
            <label className="block sm:col-span-2 lg:col-span-1">
              <span className="mb-1 block text-xs font-bold text-slate-600">Ghi chú</span>
              <input
                type="text"
                value={weeklyUpdateDraft.note}
                onChange={(e) => setWeeklyUpdateDraft({ ...weeklyUpdateDraft, note: e.target.value })}
                placeholder="Ghi chú tùy chọn..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]"
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={createWeeklyUpdate}
              disabled={!!pendingAction}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--brand)] to-[var(--brand-dark)] px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:shadow-lg disabled:opacity-60"
            >
              <Plus size={16} />
              Thêm cập nhật
            </button>
          </div>
        </Panel>

        <Panel title="Lịch sử cập nhật tuần" action={`${sortedUpdates.length} bản ghi`}>
          {sortedUpdates.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Chưa có cập nhật tuần nào.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-2">Tuần</th>
                    <th className="px-3 py-2">Ngày</th>
                    <th className="px-3 py-2">Trường</th>
                    <th className="px-3 py-2">Lớp</th>
                    <th className="px-3 py-2">Giờ dạy</th>
                    <th className="px-3 py-2">Ghi chú</th>
                    <th className="px-3 py-2">Người cập nhật</th>
                    <th className="px-3 py-2 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedUpdates.map((update) => {
                    const isEditing = editingWeeklyUpdateId === update.id;
                    const schoolLabel = schools.find((s) => s.id === update.schoolId)?.name || update.schoolId;
                    const classLabel = classes.find((c) => c.id === update.classId)?.name || update.classId;

                    if (isEditing) {
                      return (
                        <tr key={update.id} className="border-b border-slate-50 bg-cyan-50/50">
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={1}
                              value={weeklyUpdateEditDraft.weekNumber}
                              onChange={(e) =>
                                setWeeklyUpdateEditDraft({ ...weeklyUpdateEditDraft, weekNumber: e.target.value })
                              }
                              className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="date"
                              value={weeklyUpdateEditDraft.updateDate}
                              onChange={(e) =>
                                setWeeklyUpdateEditDraft({ ...weeklyUpdateEditDraft, updateDate: e.target.value })
                              }
                              className="w-36 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={weeklyUpdateEditDraft.schoolId}
                              onChange={(e) =>
                                setWeeklyUpdateEditDraft({
                                  ...weeklyUpdateEditDraft,
                                  schoolId: e.target.value,
                                  classId: "",
                                })
                              }
                              className="w-32 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                            >
                              <option value="">--</option>
                              {schools.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={weeklyUpdateEditDraft.classId}
                              onChange={(e) =>
                                setWeeklyUpdateEditDraft({ ...weeklyUpdateEditDraft, classId: e.target.value })
                              }
                              className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                            >
                              <option value="">--</option>
                              {classesForSchool(weeklyUpdateEditDraft.schoolId).map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              step={0.5}
                              value={weeklyUpdateEditDraft.teachingHours}
                              onChange={(e) =>
                                setWeeklyUpdateEditDraft({ ...weeklyUpdateEditDraft, teachingHours: e.target.value })
                              }
                              className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={weeklyUpdateEditDraft.note}
                              onChange={(e) =>
                                setWeeklyUpdateEditDraft({ ...weeklyUpdateEditDraft, note: e.target.value })
                              }
                              className="w-32 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-3 py-2 text-slate-500">{update.updatedBy}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => saveWeeklyUpdateEdit(update.id)}
                                disabled={!!pendingAction}
                                className="rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-60"
                              >
                                Lưu
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingWeeklyUpdateId("")}
                                className="rounded-lg bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-300"
                              >
                                Hủy
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={update.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                        <td className="px-3 py-2 font-bold text-[var(--brand-dark)]">{update.weekNumber}</td>
                        <td className="px-3 py-2 text-slate-600">{formatDate(update.updateDate)}</td>
                        <td className="px-3 py-2">{schoolLabel}</td>
                        <td className="px-3 py-2">{classLabel}</td>
                        <td className="px-3 py-2 text-center font-medium">{update.teachingHours ?? 0}</td>
                        <td className="max-w-[200px] truncate px-3 py-2 text-slate-500">{update.note || "—"}</td>
                        <td className="px-3 py-2 text-slate-500">{update.updatedBy}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => startEditWeeklyUpdate(update)}
                              title="Sửa"
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-cyan-50 hover:text-[var(--brand-dark)]"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setWeeklyUpdateDeleteTarget(update)}
                              title="Xóa"
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {weeklyUpdateDeleteTarget ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
              <h3 className="mb-2 text-base font-black text-slate-800">Xóa cập nhật tuần?</h3>
              <p className="mb-4 text-sm text-slate-600">
                Bạn có chắc muốn xóa cập nhật tuần {weeklyUpdateDeleteTarget.weekNumber} —{" "}
                {schools.find((s) => s.id === weeklyUpdateDeleteTarget.schoolId)?.name || ""}?
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setWeeklyUpdateDeleteTarget(null)}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => deleteWeeklyUpdate(weeklyUpdateDeleteTarget.id)}
                  disabled={!!pendingAction}
                  className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-bold text-white hover:bg-rose-600 disabled:opacity-60"
                >
                  Xóa
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  function SettingsPanel() {
    const usageGuideUrl = "/huong-dan-su-dung/";
    return (
      <div className="flex flex-col gap-5">
        <div className="order-1">
        <Panel
          title="Thông báo chạy đầu ứng dụng"
          action={`${appAnnouncements.filter((item) => item.active).length} đang chạy`}
          collapsed={collapsedSettingsSections.announcements}
          onToggleCollapse={() => toggleSettingsSection("announcements")}
        >
          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-rose-50 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-100 text-amber-800">
                  <Megaphone size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-[var(--brand-dark)]">Đẩy thông báo cho giáo viên</h3>
                  <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
                    Thông báo đang bật sẽ chạy ở đầu ứng dụng cho đến khi admin tắt hoặc xóa.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                <input
                  value={announcementDraft.title}
                  onChange={(event) => setAnnouncementDraft((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Tiêu đề ngắn, ví dụ: Họp giáo viên tuần này"
                  className={inputClass}
                />
                <textarea
                  value={announcementDraft.body}
                  onChange={(event) => setAnnouncementDraft((current) => ({ ...current, body: event.target.value }))}
                  placeholder="Nội dung thông báo chạy trên đầu ứng dụng"
                  rows={4}
                  className={`${inputClass} resize-y`}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  {(["important_urgent", "important_not_urgent"] as AppAnnouncementPriority[]).map((priority) => (
                    <button
                      key={priority}
                      type="button"
                      onClick={() => setAnnouncementDraft((current) => ({ ...current, priority }))}
                      className={`rounded-2xl border px-4 py-3 text-left text-sm font-black transition ${
                        announcementDraft.priority === priority
                          ? priority === "important_urgent"
                            ? "border-rose-300 bg-rose-100 text-rose-900 shadow-md"
                            : "border-amber-300 bg-amber-100 text-amber-900 shadow-md"
                          : "border-slate-200 bg-white text-[var(--brand-dark)] hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {priority === "important_urgent" ? <AlertTriangle size={16} /> : <Megaphone size={16} />}
                        {announcementPriorityLabel(priority)}
                      </span>
                    </button>
                  ))}
                </div>
                <button type="button" onClick={createAppAnnouncement} disabled={isBusy} className={primaryButtonClass}>
                  <Send size={16} />
                  Đẩy thông báo
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-black text-[var(--brand-dark)]">Danh sách thông báo</h3>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                  {appAnnouncements.length} mục
                </span>
              </div>
              <div className="app-scrollbar max-h-[420px] space-y-3 overflow-y-auto pr-1">
                {appAnnouncements.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center text-sm font-semibold text-slate-600">
                    Chưa có thông báo chạy nào.
                  </div>
                ) : (
                  appAnnouncements
                    .slice()
                    .sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt))
                    .map((announcement) => {
                      const urgent = announcement.priority === "important_urgent";
                      return (
                        <div
                          key={announcement.id}
                          className={`rounded-2xl border p-3 ${
                            announcement.active
                              ? urgent
                                ? "border-rose-200 bg-rose-50/70"
                                : "border-amber-200 bg-amber-50/70"
                              : "border-slate-200 bg-slate-50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black uppercase ${
                                  urgent ? "bg-rose-600 text-white" : "bg-amber-500 text-white"
                                }`}
                              >
                                {urgent ? <AlertTriangle size={13} /> : <Megaphone size={13} />}
                                {announcementPriorityLabel(announcement.priority)}
                              </span>
                              <p className="mt-2 text-sm font-black text-[var(--brand-dark)]">{announcement.title}</p>
                              <p className="mt-1 whitespace-pre-line text-xs font-semibold text-[var(--muted)]">{announcement.body}</p>
                              <p className="mt-2 text-[11px] font-bold text-slate-500">
                                {announcement.active ? "Đang chạy" : "Đã tắt"} · {formatDateTime(announcement.updatedAt || announcement.createdAt)}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => toggleAppAnnouncement(announcement)}
                              disabled={isBusy}
                              className="rounded-xl border border-cyan-200 bg-white px-3 py-2 text-xs font-black text-[var(--brand-dark)] transition hover:bg-cyan-50"
                            >
                              {announcement.active ? "Tắt" : "Bật"}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteAppAnnouncement(announcement)}
                              disabled={isBusy}
                              className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-black text-rose-700 transition hover:bg-rose-50"
                            >
                              Xóa
                            </button>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>
        </Panel>
        </div>

        <div className="order-6">
        <Panel title="Observability vận hành" action="Admin-only">
          <div className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-black text-[var(--brand-dark)]">Dashboard lỗi, quyền và cảnh báo</p>
                <p className="text-xs font-semibold text-[var(--muted)]">
                  Cập nhật gần nhất: {observability ? formatDateTime(observability.checkedAt) : "Chưa có dữ liệu"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadObservability()}
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-800 transition hover:bg-cyan-100"
              >
                <RefreshCcw size={14} className={observabilityLoading ? "animate-spin" : ""} />
                Làm mới
              </button>
            </div>

            {observabilityError ? (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                {observabilityError}
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Tổng sự kiện" value={String(observability?.summary.totalEvents || 0)} tone="cyan" />
              <MetricCard label="Deny (1h)" value={String(observability?.summary.deny1h || 0)} tone="rose" />
              <MetricCard label="API Error (1h)" value={String(observability?.summary.apiError1h || 0)} tone="amber" />
              <MetricCard
                label="Health"
                value={healthStatusLabel(observability?.health.status || "degraded")}
                tone={observability?.health.status === "ok" ? "emerald" : observability?.health.status === "down" ? "rose" : "amber"}
              />
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <div className="rounded-xl border border-[var(--line)] bg-slate-50 p-3">
                <p className="text-xs font-black uppercase text-slate-700">Top route theo số lần gọi</p>
                <div className="mt-2 space-y-2">
                  {(observability?.topRoutes || []).slice(0, 6).map((item) => (
                    <div key={item.route} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[var(--brand-dark)]">
                      <p className="truncate font-black">{item.route}</p>
                      <p className="mt-1 text-[11px] text-[var(--muted)]">Tổng: {item.total} · Deny: {item.denied}</p>
                    </div>
                  ))}
                  {(!observability || observability.topRoutes.length === 0) ? (
                    <p className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[var(--muted)]">Chưa có dữ liệu route.</p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl border border-[var(--line)] bg-slate-50 p-3">
                <p className="text-xs font-black uppercase text-slate-700">Cảnh báo vận hành</p>
                <div className="mt-2 space-y-2">
                  {(observability?.alerts || []).map((alert, index) => (
                    <div
                      key={`${alert.level}-${index}`}
                      className={`rounded-lg px-3 py-2 text-xs font-bold ${
                        alert.level === "critical"
                          ? "border border-rose-200 bg-rose-50 text-rose-700"
                          : "border border-amber-200 bg-amber-50 text-amber-700"
                      }`}
                    >
                      {alert.message}
                    </div>
                  ))}
                  {(!observability || observability.alerts.length === 0) ? (
                    <p className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-emerald-700">Không có cảnh báo, hệ thống đang ổn định.</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </Panel>
        </div>

        <div className="order-5">
        <Panel title="Hướng dẫn sử dụng & Feedback" action="Dành cho admin">
          <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-sky-50 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-100 text-cyan-800">
                  <BookOpen size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-[var(--brand-dark)]">Hướng dẫn sử dụng trực quan</h3>
                  <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
                    Tổng hợp tính năng của từng phân hệ và cách dùng nhanh theo tác vụ thực tế.
                  </p>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-cyan-200 bg-white p-3">
                <p className="text-xs font-black uppercase text-cyan-800">File index hướng dẫn</p>
                <p className="mt-1 text-sm font-semibold text-[var(--brand-dark)]">Mở tài liệu hướng dẫn đầy đủ ở tab mới</p>
                <a
                  href={usageGuideUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-black text-white transition hover:bg-cyan-700"
                >
                  <ExternalLink size={16} />
                  Mở hướng dẫn sử dụng
                </a>
              </div>
            </div>

            <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-100 text-violet-700">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-[var(--brand-dark)]">Tiếp nhận feedback nâng cấp</h3>
                  <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
                    Ghi nhận nhanh nhu cầu cập nhật tính năng và quy trình mong muốn của người dùng.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                <input
                  value={feedbackDraft.upgradeTarget}
                  onChange={(event) => setFeedbackDraft((current) => ({ ...current, upgradeTarget: event.target.value }))}
                  placeholder="Cập nhật/nâng cấp tính năng nào?"
                  className={inputClass}
                />
                <input
                  value={feedbackDraft.menuName}
                  onChange={(event) => setFeedbackDraft((current) => ({ ...current, menuName: event.target.value }))}
                  placeholder="Trong menu/phân hệ nào?"
                  className={inputClass}
                />
                <textarea
                  value={feedbackDraft.desiredFlow}
                  onChange={(event) => setFeedbackDraft((current) => ({ ...current, desiredFlow: event.target.value }))}
                  placeholder="Quy trình mong muốn (ví dụ: Bấm A ra B, bấm B ra C, rồi xác nhận)."
                  rows={4}
                  className={`${inputClass} resize-y`}
                />
                <p className="rounded-xl bg-violet-100/70 px-3 py-2 text-xs font-bold text-violet-800">
                  Gợi ý để dễ hình dung: Bắt đầu từ màn hình nào? Cần bấm các nút gì theo thứ tự? Kết quả cuối cùng mong muốn là gì?
                </p>
                <button type="button" onClick={submitFeedback} disabled={isBusy} className={primaryButtonClass}>
                  <Send size={16} />
                  Gửi feedback
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-black text-[var(--brand-dark)]">Feedback gần đây</h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                {feedbackNotifications.length} phản hồi
              </span>
            </div>
            <div className="space-y-2">
              {feedbackNotifications.slice(0, 8).map((item) => (
                <div key={item.id} className="rounded-xl border border-violet-200 bg-violet-50/40 px-3 py-3">
                  <p className="text-sm font-black text-violet-900">{item.title.replace("Feedback | ", "")}</p>
                  <p className="mt-1 whitespace-pre-line text-xs font-semibold text-violet-800">{item.body}</p>
                  <p className="mt-2 text-[11px] font-bold text-violet-700">{formatDateTime(item.createdAt)}</p>
                </div>
              ))}
              {feedbackNotifications.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-sm font-semibold text-slate-600">
                  Chưa có feedback nào.
                </div>
              ) : null}
            </div>
          </div>
        </Panel>
        </div>

        <div className="order-2">
        <Panel
          title="Thiết lập Trường và Lớp"
          action={`${schools.length} trường`}
          collapsed={collapsedSettingsSections.schools}
          onToggleCollapse={() => toggleSettingsSection("schools")}
        >
          <div className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <School2 className="text-[var(--brand)]" />
              <h3 className="text-base font-black text-[var(--brand-dark)]">Thêm trường</h3>
            </div>
            <div className="mt-3 grid gap-3">
              <input
                value={schoolDraft.name}
                onChange={(event) => setSchoolDraft({ ...schoolDraft, name: event.target.value })}
                placeholder="Tên trường"
                className={inputClass}
              />
              <input
                value={schoolDraft.district}
                onChange={(event) => setSchoolDraft({ ...schoolDraft, district: event.target.value })}
                placeholder="Quận/Huyện"
                className={inputClass}
              />
              <button onClick={addSchool} className={primaryButtonClass}>
                <Plus size={18} />
                Lưu trường
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {schools.map((school) => (
                <div key={school.id} className="rounded-xl bg-cyan-50 px-3 py-2 text-sm font-semibold text-[var(--brand-dark)]">
                  {editingSchoolId === school.id ? (
                    <div className="grid gap-2">
                      <input
                        value={schoolEditDraft.name}
                        onChange={(event) => setSchoolEditDraft((current) => ({ ...current, name: event.target.value }))}
                        placeholder="Tên trường"
                        className={compactInputClass}
                      />
                      <input
                        value={schoolEditDraft.district}
                        onChange={(event) => setSchoolEditDraft((current) => ({ ...current, district: event.target.value }))}
                        placeholder="Quận/Huyện"
                        className={compactInputClass}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={cancelEditSchool}
                          className="rounded-lg border border-[var(--line)] bg-white px-3 py-1 text-xs font-black text-[var(--brand-dark)]"
                        >
                          Hủy
                        </button>
                        <button
                          onClick={() => saveSchoolEdit(school.id)}
                          className="rounded-lg bg-[var(--brand)] px-3 py-1 text-xs font-black text-white"
                        >
                          Lưu
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="min-w-0">
                        <p className="truncate">{school.name}</p>
                        <p className="truncate text-xs font-bold text-[var(--muted)]">{school.district}</p>
                      </div>
                      <div className="ml-auto flex gap-1">
                        <button
                          title="Sửa trường"
                          onClick={() => startEditSchool(school)}
                          className="grid h-8 w-8 place-items-center rounded-lg bg-white text-[var(--brand-dark)]"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          title="Xóa trường"
                          onClick={() => deleteSchool(school.id)}
                          className="grid h-8 w-8 place-items-center rounded-lg bg-rose-100 text-rose-700"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Panel>
        </div>

        <div className="order-3">
        <Panel
          title="Thêm lớp"
          action={`${classes.length} lớp`}
          collapsed={collapsedSettingsSections.classes}
          onToggleCollapse={() => toggleSettingsSection("classes")}
        >
          <div className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <BookOpen className="text-[var(--accent)]" />
              <h3 className="text-base font-black text-[var(--brand-dark)]">Thêm lớp</h3>
            </div>
            <div className="mt-3 grid gap-3">
              <select
                value={classDraft.schoolId}
                onChange={(event) => setClassDraft({ ...classDraft, schoolId: event.target.value })}
                className={inputClass}
              >
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
              <input
                value={classDraft.name}
                onChange={(event) => setClassDraft({ ...classDraft, name: event.target.value })}
                placeholder="Tên lớp cách nhau dấu phẩy (ví dụ: 1A,1B,2A)"
                className={inputClass}
              />
              <p className="text-xs font-bold text-[var(--muted)]">
                Hệ thống tự xác định khối theo số trong tên lớp. Ví dụ: 10A sẽ thành Khối 10.
              </p>
              <button onClick={addClassRoom} className={primaryButtonClass}>
                <Plus size={18} />
                Lưu lớp
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {classes.map((classRoom) => (
                <div key={classRoom.id} className="rounded-xl bg-cyan-50 px-3 py-2 text-sm font-semibold text-[var(--brand-dark)]">
                  {editingClassId === classRoom.id ? (
                    <div className="grid gap-2">
                      <select
                        value={classEditDraft.schoolId}
                        onChange={(event) => setClassEditDraft((current) => ({ ...current, schoolId: event.target.value }))}
                        className={compactInputClass}
                      >
                        {schools.map((school) => (
                          <option key={school.id} value={school.id}>
                            {school.name}
                          </option>
                        ))}
                      </select>
                      <input
                        value={classEditDraft.name}
                        onChange={(event) => setClassEditDraft((current) => ({ ...current, name: event.target.value }))}
                        placeholder="Tên lớp"
                        className={compactInputClass}
                      />
                      <input
                        value={classEditDraft.grade}
                        onChange={(event) => setClassEditDraft((current) => ({ ...current, grade: event.target.value }))}
                        placeholder="Khối"
                        className={compactInputClass}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={cancelEditClassRoom}
                          className="rounded-lg border border-[var(--line)] bg-white px-3 py-1 text-xs font-black text-[var(--brand-dark)]"
                        >
                          Hủy
                        </button>
                        <button
                          onClick={() => saveClassRoomEdit(classRoom.id)}
                          className="rounded-lg bg-[var(--brand)] px-3 py-1 text-xs font-black text-white"
                        >
                          Lưu
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="min-w-0">
                        <p className="truncate">
                          {classRoom.name} - {classRoom.grade}
                        </p>
                        <p className="truncate text-xs font-bold text-[var(--muted)]">
                          {schools.find((school) => school.id === classRoom.schoolId)?.name || "Không rõ trường"}
                        </p>
                      </div>
                      <div className="ml-auto flex gap-1">
                        <button
                          title="Sửa lớp"
                          onClick={() => startEditClassRoom(classRoom)}
                          className="grid h-8 w-8 place-items-center rounded-lg bg-white text-[var(--brand-dark)]"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          title="Xóa lớp"
                          onClick={() => deleteClassRoom(classRoom.id)}
                          className="grid h-8 w-8 place-items-center rounded-lg bg-rose-100 text-rose-700"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Panel>
        </div>

        <div className="order-4">
          <SlotsPanel />
        </div>
      </div>
    );
  }
  function ScheduleList({
    items,
    compact = false,
    selectedIds = [],
    onToggleSelect,
    onOpenDetail,
    onDelete,
    auditLogs: rowAuditLogs = [],
    expandedHistoryId = "",
    onToggleHistory,
  }: {
    items: Schedule[];
    compact?: boolean;
    selectedIds?: string[];
    onToggleSelect?: (scheduleId: string) => void;
    onOpenDetail?: (schedule: Schedule) => void;
    onDelete?: (schedule: Schedule) => void;
    auditLogs?: AuditLog[];
    expandedHistoryId?: string;
    onToggleHistory?: (scheduleId: string) => void;
  }) {
    const [expandedParticipantScheduleId, setExpandedParticipantScheduleId] = useState("");
    if (items.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-cyan-200 bg-cyan-50 p-8 text-center">
          <p className="font-black text-[var(--brand-dark)]">Chưa có lịch phù hợp</p>
          <p className="mt-2 text-sm text-[var(--muted)]">Hãy tạo lịch mới hoặc đổi bộ lọc tìm kiếm.</p>
        </div>
      );
    }

    return (
      <div className="app-scrollbar overflow-x-auto">
        <div className="space-y-3 sm:min-w-[860px]">
          {items.map((schedule) => {
            const meta = lookupSchedule(schedule);
            const checkedIn = Boolean(meta.checkIn);
            const scheduleLogs = rowAuditLogs
              .filter((log) => log.entityType === "Schedule" && log.entityId === schedule.id)
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
            const isHistoryOpen = expandedHistoryId === schedule.id;
            const participantNames = formatScheduleParticipantClassNames(meta.participantClasses, meta.classRoom);
            const hasMultipleParticipantClasses = meta.participantClasses.length > 1;
            const isParticipantClassesOpen = expandedParticipantScheduleId === schedule.id;
            return (
              <div
                key={schedule.id}
                role={onOpenDetail ? "button" : undefined}
                tabIndex={onOpenDetail ? 0 : undefined}
                onClick={() => onOpenDetail?.(schedule)}
                onKeyDown={(event) => {
                  if (onOpenDetail && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    onOpenDetail(schedule);
                  }
                }}
                className={`rounded-2xl border bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-lg sm:p-4 ${scheduleAccentBorder(schedule.status)}`}
              >
                <div className="grid gap-3 sm:grid-cols-[130px_1fr_160px_190px] sm:items-center sm:gap-4">
                  <div className="flex items-start gap-2">
                    {onToggleSelect ? (
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(schedule.id)}
                        onClick={(event) => event.stopPropagation()}
                        onChange={() => onToggleSelect(schedule.id)}
                        className="mt-1"
                      />
                    ) : null}
                    <div>
                      <p className="text-sm font-black text-[var(--brand-dark)]">{formatDate(schedule.date)}</p>
                      <p className="mt-1 inline-flex rounded-full bg-indigo-50 px-2 py-1 text-xs font-black text-indigo-700">
                        {formatSlotRange(meta.slot) || "Chưa có khung giờ"}
                      </p>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenDetail?.(schedule);
                        }}
                        className="block max-w-full truncate text-left text-sm font-black text-[var(--brand-dark)] transition hover:text-[var(--brand)]"
                      >
                        {meta.lesson?.title}
                      </button>
                      <span
                        className={`shrink-0 rounded-full px-2 py-1 text-xs font-black ${teachingEnvironmentChipClass(schedule.teachingEnvironment)}`}
                      >
                        {teachingEnvironmentLabel(schedule.teachingEnvironment)}
                      </span>
                    </div>
                    <p className="mt-2 flex flex-wrap gap-1 text-xs font-black">
                      <span className="rounded-full bg-cyan-50 px-2 py-1 text-cyan-800">{meta.school?.name}</span>
                      {hasMultipleParticipantClasses ? (
                        <button
                          type="button"
                          title="Bấm để xem đầy đủ các lớp tham gia"
                          onClick={(event) => {
                            event.stopPropagation();
                            setExpandedParticipantScheduleId((current) => (current === schedule.id ? "" : schedule.id));
                          }}
                          className="rounded-full bg-orange-50 px-2 py-1 text-orange-700 transition hover:bg-orange-100"
                        >
                          {formatScheduleParticipantScope(meta.participantClasses, meta.classRoom)}
                        </button>
                      ) : (
                        <span className="rounded-full bg-orange-50 px-2 py-1 text-orange-700">
                          {formatScheduleParticipantScope(meta.participantClasses, meta.classRoom)}
                        </span>
                      )}
                      <span className={`rounded-full px-2 py-1 ${checkedIn ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                        {checkedIn ? "Đã điểm danh" : "Chưa điểm danh"}
                      </span>
                    </p>
                    {isParticipantClassesOpen ? (
                      <p className="mt-2 text-xs font-bold text-orange-800">Các lớp tham gia: {participantNames}</p>
                    ) : null}
                    <p className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-[var(--muted)]">
                      {meta.coTeachers.length > 0 ? (
                        <>
                          <span>Giáo viên đồng giảng: {meta.coTeachers.map((teacher) => teacher.name).join(", ")}</span>
                          <span>•</span>
                        </>
                      ) : null}
                      <span>
                        Trợ giảng: {meta.assistants.length > 0 ? meta.assistants.map((assistant) => assistant.name).join(", ") : "Không có"}
                      </span>
                    </p>
                  </div>
                  <TeacherHover teacher={meta.teacher} />
                  <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
                    <StatusChip status={schedule.status} />
                    {onToggleHistory ? (
                      <button
                        title="Lịch sử thao tác"
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleHistory(schedule.id);
                        }}
                        className="grid h-9 w-9 place-items-center rounded-xl bg-slate-50 text-[var(--brand-dark)] transition hover:bg-slate-100"
                      >
                        <History size={16} />
                      </button>
                    ) : null}
                    {!compact && role === "admin" ? (
                      <div className="flex gap-1">
                        <button
                          title="Chuyển lịch"
                          onClick={(event) => {
                            event.stopPropagation();
                            reassignSchedule(schedule);
                          }}
                          className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-50 text-[var(--brand-dark)] transition hover:bg-cyan-100"
                        >
                          <RefreshCcw size={16} />
                        </button>
                        <button
                          title={onDelete ? "Xóa lịch" : "Hủy lịch"}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (onDelete) {
                              onDelete(schedule);
                            } else {
                              cancelSchedule(schedule);
                            }
                          }}
                          className="grid h-9 w-9 place-items-center rounded-xl bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : null}
                    {!compact && role === "teacher" && ["sent", "reassigned"].includes(schedule.status) ? (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          confirmSchedule(schedule.id);
                        }}
                        className="rounded-xl bg-[var(--brand)] px-3 py-2 text-xs font-black text-white"
                      >
                        Xác nhận
                      </button>
                    ) : null}
                  </div>
                </div>
                {isHistoryOpen ? (
                  <div className="mt-4 rounded-2xl bg-slate-50 p-3">
                    {scheduleLogs.length > 0 ? (
                      <div className="space-y-2">
                        {scheduleLogs.map((log) => (
                          <div key={log.id} className="flex items-start justify-between gap-3 rounded-xl bg-white px-3 py-2 text-xs font-bold text-[var(--brand-dark)]">
                            <div>
                              <p className="font-black">{auditActionLabel(log.action)}</p>
                              <p className="mt-1 text-[var(--muted)]">{log.actorEmail || log.actorId || "Hệ thống"}</p>
                            </div>
                            <span className="shrink-0 text-[var(--muted)]">{formatDateTime(log.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs font-bold text-[var(--muted)]">Chưa có lịch sử thao tác cho lịch này.</p>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
}

function SystemFeedbackLayer({
  pendingAction,
  toastMessages,
  centerFeedback,
  onDismissToast,
}: {
  pendingAction: string;
  toastMessages: ToastMessage[];
  centerFeedback: CenterFeedback | null;
  onDismissToast: (id: string) => void;
}) {
  const hasTopRightFeedback = Boolean(pendingAction) || toastMessages.length > 0;

  return (
    <>
      {hasTopRightFeedback ? (
        <div className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-3 z-[80] flex w-[min(430px,calc(100vw-1.5rem))] flex-col gap-3 sm:bottom-5 sm:right-5 sm:w-[min(430px,calc(100vw-2.5rem))]">
          {pendingAction ? (
            <div className="pointer-events-auto inline-flex items-center gap-3 self-end rounded-2xl border border-cyan-200 bg-white/95 px-4 py-3 text-sm font-black text-[var(--brand-dark)] shadow-2xl shadow-cyan-950/12 backdrop-blur-xl">
              <LoaderCircle className="animate-spin text-cyan-600" size={18} />
              <span className="min-w-0 truncate">{pendingAction}</span>
            </div>
          ) : null}
          {toastMessages.map((toast) => (
            <div
              key={toast.id}
              className={`ui-toast pointer-events-auto rounded-2xl border px-4 py-3 shadow-2xl transition duration-200 ${
                toast.leaving ? "translate-x-4 opacity-0" : "translate-x-0 opacity-100"
              } ${toastToneClass(toast.tone)}`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${toastIconToneClass(toast.tone)}`}>
                  {toast.tone === "error" ? (
                    <X size={14} />
                  ) : toast.tone === "success" ? (
                    <CheckCircle2 size={14} />
                  ) : toast.tone === "warning" ? (
                    <AlertTriangle size={14} />
                  ) : (
                    <Bell size={14} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black">{toast.title}</p>
                  <p className="mt-1 text-sm leading-6">{toast.body}</p>
                </div>
                <button
                  type="button"
                  title="Đóng thông báo"
                  aria-label="Đóng thông báo"
                  onClick={() => onDismissToast(toast.id)}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/80 text-slate-500 transition hover:bg-white hover:text-slate-800"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {centerFeedback ? (
        <div className="pointer-events-none fixed inset-0 z-[85] grid place-items-center p-4">
          <div
            className={`ui-center-feedback max-w-[min(440px,calc(100vw-2rem))] rounded-3xl border px-5 py-4 text-center shadow-2xl transition duration-300 ${
              centerFeedback.leaving ? "translate-y-2 scale-95 opacity-0 blur-sm" : "translate-y-0 scale-100 opacity-100 blur-0"
            } ${centerFeedbackToneClass(centerFeedback.tone)}`}
          >
            <div className={`mx-auto grid h-12 w-12 place-items-center rounded-2xl ${centerFeedbackIconClass(centerFeedback.tone)}`}>
              {centerFeedback.tone === "error" ? (
                <X size={22} />
              ) : centerFeedback.tone === "success" ? (
                <CheckCircle2 size={22} />
              ) : centerFeedback.tone === "warning" ? (
                <AlertTriangle size={22} />
              ) : (
                <Bell size={22} />
              )}
            </div>
            <p className="mt-3 text-base font-black">{centerFeedback.title}</p>
            <p className="mt-1 text-sm font-semibold leading-6 opacity-85">{centerFeedback.body}</p>
          </div>
        </div>
      ) : null}
    </>
  );
}

function toastToneClass(tone: ToastTone) {
  if (tone === "error") {
    return "border-rose-200 bg-rose-50/95 text-rose-900 shadow-rose-900/10";
  }
  if (tone === "warning") {
    return "border-amber-200 bg-amber-50/95 text-amber-950 shadow-amber-900/10";
  }
  if (tone === "success") {
    return "border-emerald-200 bg-emerald-50/95 text-emerald-950 shadow-emerald-900/10";
  }
  return "border-sky-200 bg-white/95 text-[var(--brand-dark)] shadow-sky-900/10";
}

function toastIconToneClass(tone: ToastTone) {
  if (tone === "error") {
    return "bg-rose-100 text-rose-700";
  }
  if (tone === "warning") {
    return "bg-orange-100 text-orange-700";
  }
  if (tone === "success") {
    return "bg-emerald-100 text-emerald-700";
  }
  return "bg-cyan-100 text-[var(--brand-dark)]";
}

function centerFeedbackToneClass(tone: ToastTone) {
  if (tone === "error") {
    return "border-rose-200 bg-rose-50/88 text-rose-950 shadow-rose-950/15";
  }
  if (tone === "warning") {
    return "border-amber-200 bg-amber-50/88 text-amber-950 shadow-amber-950/15";
  }
  if (tone === "success") {
    return "border-emerald-200 bg-emerald-50/88 text-emerald-950 shadow-emerald-950/15";
  }
  return "border-cyan-200 bg-white/88 text-[var(--brand-dark)] shadow-cyan-950/15";
}

function centerFeedbackIconClass(tone: ToastTone) {
  if (tone === "error") {
    return "bg-rose-100 text-rose-700";
  }
  if (tone === "warning") {
    return "bg-amber-100 text-amber-700";
  }
  if (tone === "success") {
    return "bg-emerald-100 text-emerald-700";
  }
  return "bg-cyan-100 text-cyan-700";
}

function AnnouncementTicker({ announcements }: { announcements: AppAnnouncement[] }) {
  if (announcements.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-orange-100 bg-orange-50/80 py-2 backdrop-blur">
      <div className="overflow-hidden whitespace-nowrap">
        <div className="app-announcement-track flex w-max min-w-full items-center gap-8">
          {[...announcements, ...announcements].map((announcement, index) => {
            const urgent = announcement.priority === "important_urgent";
            return (
              <div
                key={`${announcement.id}-${index}`}
                className={`inline-flex items-center gap-2 text-sm font-black ${urgent ? "text-rose-800" : "text-orange-800"}`}
              >
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] uppercase ${
                    urgent ? "bg-rose-600 text-white" : "bg-amber-500 text-white"
                  }`}
                >
                  {urgent ? <AlertTriangle size={13} /> : <Megaphone size={13} />}
                  {announcementPriorityLabel(announcement.priority)}
                </span>
                <span>{announcement.title}</span>
                <span className="font-semibold opacity-85">{announcement.body}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  action,
  collapsed = false,
  onToggleCollapse,
  children,
}: {
  title: string;
  action?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/75 bg-white/90 p-4 shadow-[0_20px_52px_rgba(18,46,68,0.09),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur sm:rounded-3xl sm:p-5">
      <div className={`${collapsed ? "" : "mb-4 sm:mb-5"} flex items-start justify-between gap-3`}>
        <h2 className="text-base font-black tracking-tight text-[var(--brand-dark)] sm:text-lg">{title}</h2>
        <div className="flex items-center gap-2">
          {action ? (
            <span className="max-w-[42vw] truncate rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-[var(--brand-dark)] sm:max-w-none">
              {action}
            </span>
          ) : null}
          {onToggleCollapse ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={collapsed ? "Mở rộng" : "Thu gọn"}
              aria-label={collapsed ? `Mở rộng ${title}` : `Thu gọn ${title}`}
              className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-50 to-sky-50 text-[var(--brand-dark)] shadow-sm transition hover:bg-cyan-100"
            >
              <ChevronRight size={18} className={`transition-transform ${collapsed ? "" : "rotate-90"}`} />
            </button>
          ) : null}
        </div>
      </div>
      {collapsed ? null : children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "cyan" | "rose" | "amber" | "emerald";
}) {
  const toneClass = {
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-900",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
  }[tone];

  return (
    <div className={`rounded-2xl border px-3 py-3 ${toneClass}`}>
      <p className="text-[11px] font-black uppercase opacity-75">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}

function healthStatusLabel(status: "ok" | "degraded" | "down") {
  if (status === "ok") {
    return "Ổn định";
  }
  if (status === "degraded") {
    return "Suy giảm";
  }
  return "Gián đoạn";
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
  active = false,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  tone: "cyan" | "emerald" | "blue" | "orange" | "rose" | "amber" | "violet";
  active?: boolean;
  onClick?: () => void;
}) {
  const toneClasses = {
    cyan: {
      icon: "bg-cyan-100 text-cyan-700",
      card: "border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-cyan-100/60",
      active: "ring-cyan-200 shadow-cyan-300/35",
      value: "text-cyan-900",
      label: "text-cyan-800/85",
    },
    emerald: {
      icon: "bg-emerald-100 text-emerald-700",
      card: "border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/70",
      active: "ring-emerald-200 shadow-emerald-300/35",
      value: "text-emerald-900",
      label: "text-emerald-800/85",
    },
    blue: {
      icon: "bg-blue-100 text-blue-700",
      card: "border-blue-200 bg-gradient-to-br from-blue-50 via-white to-blue-100/70",
      active: "ring-blue-200 shadow-blue-300/35",
      value: "text-blue-900",
      label: "text-blue-800/85",
    },
    orange: {
      icon: "bg-orange-100 text-orange-700",
      card: "border-orange-200 bg-gradient-to-br from-orange-50 via-white to-orange-100/70",
      active: "ring-orange-200 shadow-orange-300/35",
      value: "text-orange-900",
      label: "text-orange-800/85",
    },
    rose: {
      icon: "bg-rose-100 text-rose-700",
      card: "border-rose-200 bg-gradient-to-br from-rose-50 via-white to-rose-100/70",
      active: "ring-rose-200 shadow-rose-300/35",
      value: "text-rose-900",
      label: "text-rose-800/85",
    },
    amber: {
      icon: "bg-amber-100 text-amber-700",
      card: "border-amber-200 bg-gradient-to-br from-amber-50 via-white to-amber-100/70",
      active: "ring-amber-200 shadow-amber-300/35",
      value: "text-amber-900",
      label: "text-amber-800/85",
    },
    violet: {
      icon: "bg-violet-100 text-violet-700",
      card: "border-violet-200 bg-gradient-to-br from-violet-50 via-white to-violet-100/70",
      active: "ring-violet-200 shadow-violet-300/35",
      value: "text-violet-900",
      label: "text-violet-800/85",
    },
  }[tone];

  const className = `rounded-2xl border p-4 text-left shadow-[0_18px_46px_rgba(18,46,68,0.08),inset_0_1px_0_rgba(255,255,255,0.88)] backdrop-blur transition sm:rounded-3xl sm:p-5 ${toneClasses.card} ${
    active ? `ring-4 ${toneClasses.active}` : "hover:-translate-y-0.5 hover:shadow-lg"
  }`;
  const content = (
    <>
      <div className={`grid h-11 w-11 place-items-center rounded-xl sm:h-14 sm:w-14 sm:rounded-2xl ${toneClasses.icon}`}>
        <Icon size={20} />
      </div>
      <p className={`mt-3 text-3xl font-black tracking-tight sm:mt-5 sm:text-4xl ${toneClasses.value}`}>{value}</p>
      <p className={`mt-1 text-sm font-black leading-snug sm:text-base ${toneClasses.label}`}>{label}</p>
    </>
  );

  return onClick ? (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black uppercase text-[var(--brand-dark)]">{label}</span>
      {children}
    </label>
  );
}

function InfoBlock({
  label,
  value,
  tone = "cyan",
}: {
  label: string;
  value: string;
  tone?: "cyan" | "orange" | "emerald" | "amber" | "rose" | "violet" | "indigo" | "slate";
}) {
  const toneClass = {
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-800",
    orange: "border-orange-200 bg-orange-50 text-orange-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    violet: "border-violet-200 bg-violet-50 text-violet-800",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-800",
    slate: "border-slate-200 bg-slate-50 text-slate-800",
  }[tone];

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      <p className="text-[11px] font-black uppercase opacity-75">{label}</p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  );
}

function TeacherTableRow({
  teacher,
  user,
  onRoleChange,
  isEditing,
  draft,
  onStartEdit,
  onCancelEdit,
  onDraftChange,
  onSaveEdit,
  onToggleActive,
  onDelete,
}: {
  teacher: Teacher;
  user?: User;
  onRoleChange: (teacher: Teacher, role: Role) => void;
  isEditing: boolean;
  draft: TeacherEditDraft;
  onStartEdit: (teacher: Teacher) => void;
  onCancelEdit: () => void;
  onDraftChange: (draft: TeacherEditDraft) => void;
  onSaveEdit: (teacherId: string) => void;
  onToggleActive: (teacher: Teacher) => void;
  onDelete: (teacher: Teacher) => void;
}) {
  const role = user?.role ?? "teacher";

  if (isEditing) {
    return (
      <div className="grid grid-cols-[2fr_150px_2fr_150px_110px_190px] items-center gap-3 bg-cyan-50/40 px-4 py-3 text-sm">
        <div className="min-w-0 space-y-2">
          <input
            value={draft.name}
            onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
            placeholder="Họ tên"
            className="w-full rounded-xl border border-cyan-100 bg-white px-3 py-2 font-semibold text-[var(--brand-dark)] outline-none transition focus:border-[var(--brand)]"
          />
          <input
            value={draft.specialty}
            onChange={(event) => onDraftChange({ ...draft, specialty: event.target.value })}
            placeholder="Chuyên môn"
            className="w-full rounded-xl border border-cyan-100 bg-white px-3 py-2 text-xs font-semibold text-[var(--brand-dark)] outline-none transition focus:border-[var(--brand)]"
          />
        </div>
        <input
          value={draft.phone}
          onChange={(event) => onDraftChange({ ...draft, phone: event.target.value })}
          placeholder="Số điện thoại"
          className="w-full rounded-xl border border-cyan-100 bg-white px-3 py-2 font-semibold text-[var(--brand-dark)] outline-none transition focus:border-[var(--brand)]"
        />
        <input
          value={draft.email}
          onChange={(event) => onDraftChange({ ...draft, email: event.target.value })}
          placeholder="Email"
          className="w-full rounded-xl border border-cyan-100 bg-white px-3 py-2 font-semibold text-[var(--brand-dark)] outline-none transition focus:border-[var(--brand)]"
        />
        <select
          value={role}
          onChange={(event) => onRoleChange(teacher, event.target.value as Role)}
          className="w-full rounded-xl border border-cyan-100 bg-white px-3 py-2 text-sm font-black text-[var(--brand-dark)] outline-none transition focus:border-[var(--brand)]"
        >
          <option value="teacher">Giáo viên</option>
          <option value="assistant">Trợ giảng</option>
          <option value="admin">Quản trị</option>
        </select>
        <span
          className={`inline-flex h-10 items-center justify-center rounded-xl px-3 text-xs font-black ${
            teacher.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
          }`}
        >
          {teacher.active ? "Đang bật" : "Đang tắt"}
        </span>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancelEdit}
            className="inline-flex h-9 items-center rounded-lg border border-[var(--line)] bg-white px-3 text-xs font-black text-[var(--brand-dark)]"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => onSaveEdit(teacher.id)}
            className="inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-3 text-xs font-black text-white"
          >
            Lưu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[2fr_150px_2fr_150px_110px_190px] items-center gap-3 px-4 py-3 text-sm transition hover:bg-cyan-50/45">
      <div className="flex min-w-0 items-center gap-3">
        <img alt={teacher.name} src={teacher.avatarUrl} className="h-10 w-10 rounded-xl object-cover" />
        <div className="min-w-0">
          <p className="truncate font-black text-[var(--brand-dark)]">{teacher.name}</p>
          <p className="truncate text-xs font-bold uppercase text-[var(--muted)]">{teacher.specialty}</p>
        </div>
      </div>
      <span className="truncate font-bold text-orange-700">{teacher.phone}</span>
      <span className="truncate font-bold text-[var(--brand-dark)]">{teacher.email}</span>
      <select
        value={role}
        onChange={(event) => onRoleChange(teacher, event.target.value as Role)}
        className="w-full rounded-xl border border-cyan-100 bg-cyan-50 px-3 py-2 text-sm font-black text-[var(--brand-dark)] outline-none transition focus:border-[var(--brand)]"
      >
        <option value="teacher">Giáo viên</option>
        <option value="assistant">Trợ giảng</option>
        <option value="admin">Quản trị</option>
      </select>
      <span
        className={`inline-flex h-10 items-center justify-center rounded-xl px-3 text-xs font-black ${
          teacher.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
        }`}
      >
        {teacher.active ? "Đang bật" : "Đang tắt"}
      </span>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          title="Sửa giáo viên"
          onClick={() => onStartEdit(teacher)}
          className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-50 text-[var(--brand-dark)] transition hover:bg-cyan-100"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          title={teacher.active ? "Tắt giáo viên" : "Bật giáo viên"}
          onClick={() => onToggleActive(teacher)}
          className="inline-flex h-8 items-center rounded-lg bg-white px-2 text-[11px] font-black text-[var(--brand-dark)] ring-1 ring-[var(--line)] transition hover:bg-cyan-50"
        >
          {teacher.active ? "Tắt" : "Bật"}
        </button>
        <button
          type="button"
          title="Xóa giáo viên"
          onClick={() => onDelete(teacher)}
          className="grid h-8 w-8 place-items-center rounded-lg bg-rose-100 text-rose-700 transition hover:bg-rose-200"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function TeacherHover({ teacher }: { teacher?: Teacher }) {
  if (!teacher) {
    return <span className="text-sm font-bold text-[var(--muted)]">Chưa rõ</span>;
  }

  return (
    <div className="group relative">
      <div className="flex items-center gap-3">
        <img alt={teacher.name} src={teacher.avatarUrl} className="h-10 w-10 rounded-full object-cover" />
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-[var(--brand-dark)]">{teacher.name}</p>
          <p className="truncate text-xs text-[var(--muted)]">{teacher.phone}</p>
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-full left-0 z-30 mb-3 hidden w-64 rounded-2xl border border-cyan-100 bg-white p-4 shadow-2xl group-hover:block">
        <div className="flex items-center gap-3">
          <img alt={teacher.name} src={teacher.avatarUrl} className="h-14 w-14 rounded-2xl object-cover" />
          <div>
            <p className="font-black text-[var(--brand-dark)]">{teacher.name}</p>
            <p className="text-xs font-bold text-[var(--brand)]">{teacher.specialty}</p>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-sm font-bold text-[var(--brand-dark)]">
          <p className="flex items-center gap-2">
            <Phone size={15} className="text-[var(--accent)]" />
            {teacher.phone}
          </p>
          <p className="flex items-center gap-2">
            <Mail size={15} className="text-[var(--brand)]" />
            {teacher.email}
          </p>
        </div>
      </div>
    </div>
  );
}

function LessonSessionCard({ number, title, objective }: { number: 1 | 2; title: string; objective: string }) {
  const tone = number === 1 ? "border-cyan-100 bg-cyan-50/55 text-[var(--brand-dark)]" : "border-violet-100 bg-violet-50/55 text-violet-900";
  return (
    <div className={`rounded-xl border px-3 py-2 ${tone}`}>
      <p className="text-sm font-black">Tiết {number}: {title}</p>
      <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-600">{objective}</p>
    </div>
  );
}

function roleLabel(role: Role) {
  if (role === "admin") return "Quản trị";
  if (role === "assistant") return "Trợ giảng";
  return "Giáo viên";
}

function splitAssistantIds(value: string | undefined) {
  return String(value || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function StatusChip({ status }: { status: Schedule["status"] }) {
  return (
    <span className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-black ${statusStyles[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

function validateTeacherImportDraft(row: TeacherImportDraft, label = "Giáo viên") {
  if (!row.name.trim()) {
    return `${label}: Họ tên là bắt buộc.`;
  }
  if (!row.email.trim()) {
    return `${label}: Email Google là bắt buộc.`;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) {
    return `${label}: Email Google không hợp lệ.`;
  }
  if (!["teacher", "assistant", "admin"].includes(row.role)) {
    return `${label}: Quyền phải là Giáo viên, Trợ giảng hoặc Quản trị.`;
  }
  return "";
}

function findDuplicateEmails(emails: string[]) {
  const counts = new Map<string, number>();
  for (const email of emails) {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      continue;
    }
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([email]) => email);
}

function parseTeacherRole(value: string | undefined): Role {
  const normalized = normalizeComparableText(value || "");
  if (["admin", "quan tri", "quantri", "quan tri vien", "quantrivien", "quyen quan tri", "quyenquantri"].includes(normalized)) {
    return "admin";
  }
  if (["tro giang", "trogiang", "quyen tro giang", "quyentrogiang", "assistant"].includes(normalized)) {
    return "assistant";
  }
  return "teacher";
}

function parseTeacherSpreadsheet(text: string): TeacherImportDraft[] {
  const cleanedText = text.replace(/^\uFEFF/, "").trim();
  if (!cleanedText) {
    throw new Error("File giáo viên đang trống.");
  }
  const delimiter = cleanedText.includes("\t") ? "\t" : ",";
  return parseTeacherSpreadsheetRows(parseDelimitedRows(cleanedText, delimiter));
}

async function parseTeacherWorkbook(file: File): Promise<TeacherImportDraft[]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("File Excel không có sheet dữ liệu.");
  }
  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  }) as unknown[][];
  return parseTeacherSpreadsheetRows(rows.map((row) => row.map((cell) => String(cell ?? ""))));
}

function parseTeacherSpreadsheetRows(rows: string[][]): TeacherImportDraft[] {
  const filledRows = rows.filter((cells) => cells.some((cell) => cell.trim()));
  const [headers, ...dataRows] = filledRows;
  if (!headers || dataRows.length === 0) {
    throw new Error("File giáo viên cần có dòng tiêu đề và ít nhất một dòng dữ liệu.");
  }

  const headerMap = createTeacherHeaderMap(headers);
  return dataRows.map((cells) => ({
    id: createId("bulk-teacher"),
    name: cells[headerMap.name]?.trim() ?? "",
    email: (cells[headerMap.email]?.trim() ?? "").toLowerCase(),
    phone: cells[headerMap.phone]?.trim() ?? "",
    specialty: cells[headerMap.specialty]?.trim() ?? "",
    role: parseTeacherRole(cells[headerMap.role]),
  }));
}

function createTeacherHeaderMap(headers: string[]) {
  const normalized = headers.map(normalizeHeader);
  const headerMap = {
    name: findHeaderIndex(normalized, ["hoten", "ten", "name"]),
    email: findHeaderIndex(normalized, ["email", "emailgoogle"]),
    phone: findHeaderIndex(normalized, ["sodienthoai", "phone", "dienthoai"]),
    specialty: findHeaderIndex(normalized, ["chuyenmon", "specialty"]),
    role: findHeaderIndex(normalized, ["quyen", "role"]),
  };

  const missingHeaders = Object.entries(headerMap)
    .filter(([, index]) => index === -1)
    .map(([key]) => {
      const labels: Record<string, string> = {
        name: "Họ tên",
        email: "Email Google",
        phone: "Số điện thoại",
        specialty: "Chuyên môn",
        role: "Quyền",
      };
      return labels[key] ?? key;
    });

  if (missingHeaders.length > 0) {
    throw new Error(`File giáo viên thiếu cột: ${missingHeaders.join(", ")}.`);
  }

  return headerMap;
}

function createEmptyLessonDraft(): LessonDraft {
  return {
    grade: "Khối 1",
    topicId: "",
    title: "",
    lesson1Title: "",
    lesson1Objective: "",
    lesson2Title: "",
    lesson2Objective: "",
    samplePlanUrl: "",
    durationMinutes: 45,
  };
}

function createBulkLessonRow(): BulkLessonRow {
  return {
    id: createId("bulk-lesson"),
    ...createEmptyLessonDraft(),
  };
}

function hasLessonContent(row: BulkLessonRow) {
  return Boolean(
    row.title.trim() ||
      row.lesson1Title.trim() ||
      row.lesson1Objective.trim() ||
      row.lesson2Title.trim() ||
      row.lesson2Objective.trim() ||
      row.samplePlanUrl.trim(),
  );
}

function stripBulkLessonId(row: BulkLessonRow): LessonDraft {
  return {
    grade: row.grade,
    topicId: row.topicId ?? "",
    title: row.title,
    lesson1Title: row.lesson1Title,
    lesson1Objective: row.lesson1Objective,
    lesson2Title: row.lesson2Title,
    lesson2Objective: row.lesson2Objective,
    samplePlanUrl: row.samplePlanUrl,
    durationMinutes: row.durationMinutes,
  };
}

function validateLessonDraft(row: LessonDraft, label = "Bài học") {
  if (!lessonGrades.includes(row.grade)) {
    return `${label}: Khối phải nằm trong Khối 1 đến Khối 12.`;
  }

  if (!row.title.trim()) {
    return `${label}: Tên chuyên đề là bắt buộc.`;
  }

  if (!row.lesson1Title.trim()) {
    return `${label}: Tên tiết 1 là bắt buộc.`;
  }

  if (!row.lesson1Objective.trim()) {
    return `${label}: Mục tiêu tiết 1 là bắt buộc.`;
  }

  if (!row.lesson2Title.trim()) {
    return `${label}: Tên tiết 2 là bắt buộc.`;
  }

  if (!row.lesson2Objective.trim()) {
    return `${label}: Mục tiêu tiết 2 là bắt buộc.`;
  }

  if (row.durationMinutes === "") {
    return `${label}: Số phút là bắt buộc.`;
  }

  if (row.samplePlanUrl.trim() && !/^https?:\/\//i.test(row.samplePlanUrl.trim())) {
    return `${label}: Giáo án mẫu phải là link http hoặc https.`;
  }

  const dur = Number(row.durationMinutes);
  if (dur < MIN_TIME_SLOT_MINUTES || dur > MAX_TIME_SLOT_MINUTES || dur % TIME_SLOT_STEP_MINUTES !== 0) {
    return `${label}: Số phút phải từ ${MIN_TIME_SLOT_MINUTES} đến ${MAX_TIME_SLOT_MINUTES}, bội số của ${TIME_SLOT_STEP_MINUTES}.`;
  }

  return "";
}

function collectBulkLessonErrors(rows: BulkLessonRow[], existingLessons: Lesson[], firstLineNumber: number) {
  const errors: Record<string, string> = {};
  const existingByKey = new Map(
    existingLessons
      .filter((lesson) => lesson.active !== false)
      .map((lesson) => [lessonDuplicateKey(lesson), lesson]),
  );
  const incomingByKey = new Map<string, number>();

  rows.forEach((row, index) => {
    const lineNumber = index + firstLineNumber;
    const validationError = validateLessonDraft(row, `Dòng ${lineNumber}`);
    if (validationError) {
      errors[row.id] = validationError;
      return;
    }

    const duplicateKey = lessonDuplicateKey(row);
    const existing = existingByKey.get(duplicateKey);
    if (existing) {
      errors[row.id] = `Dòng ${lineNumber} trùng hoàn toàn với bài đã lưu: “${existing.title}” — Tiết 1: ${existing.lesson1Title}; Tiết 2: ${existing.lesson2Title}.`;
      return;
    }

    const firstMatchingRow = incomingByKey.get(duplicateKey);
    if (firstMatchingRow !== undefined) {
      errors[row.id] = `Dòng ${lineNumber} trùng hoàn toàn với dòng ${firstMatchingRow + firstLineNumber} trong file.`;
      return;
    }
    incomingByKey.set(duplicateKey, index);
  });

  return errors;
}

function normalizeTimeSlotDraft<T extends TimeSlotDraft & { id?: string }>(row: T) {
  return {
    ...row,
    label: row.label.trim(),
    start: normalizeTimeValue(row.start),
    end: normalizeTimeValue(row.end),
    active: row.active ?? true,
  };
}

function validateTimeSlotDraft(
  row: TimeSlotDraft,
  existingSlots: TimeSlot[],
  label = "Khung giờ",
  ignoreId?: string,
  declaredDuration?: number | "",
) {
  const normalized = normalizeTimeSlotDraft(row);
  if (!normalized.label) {
    return `${label}: Tên khung giờ là bắt buộc.`;
  }
  if (!normalized.start || !normalized.end) {
    return `${label}: Giờ bắt đầu và giờ kết thúc phải đúng định dạng HH:mm.`;
  }

  const duration = getTimeSlotDurationMinutes(normalized.start, normalized.end);
  if (duration <= 0) {
    return `${label}: Giờ kết thúc phải sau giờ bắt đầu.`;
  }
  if (declaredDuration !== undefined && declaredDuration !== "" && Number(declaredDuration) !== duration) {
    return `${label}: Số phút phải khớp với giờ bắt đầu/kết thúc.`;
  }
  if (duration < MIN_TIME_SLOT_MINUTES) {
    return `${label}: Khung giờ phải kéo dài ít nhất ${MIN_TIME_SLOT_MINUTES} phút.`;
  }
  if (duration > MAX_TIME_SLOT_MINUTES) {
    return `${label}: Khung giờ không được dài quá ${MAX_TIME_SLOT_MINUTES} phút.`;
  }
  if (duration % TIME_SLOT_STEP_MINUTES !== 0) {
    return `${label}: Thời lượng phải là bội số của ${TIME_SLOT_STEP_MINUTES} phút.`;
  }

  const labelKey = normalizeTimeSlotLabel(normalized.label);
  const timeKey = timeSlotDuplicateKey(normalized);
  const duplicated = existingSlots.some((slot) => {
    if (slot.id === ignoreId) {
      return false;
    }
    return normalizeTimeSlotLabel(slot.label) === labelKey || timeSlotDuplicateKey(slot) === timeKey;
  });
  if (duplicated) {
    return `${label}: Khung giờ bị trùng tên hoặc trùng giờ bắt đầu/kết thúc.`;
  }

  return "";
}

function getTimeSlotDurationLabel(start: string, end: string) {
  const duration = getTimeSlotDurationMinutes(normalizeTimeValue(start), normalizeTimeValue(end));
  if (duration <= 0) {
    return "chưa hợp lệ";
  }
  return `${duration} phút`;
}

function parseTimeSlotSpreadsheet(text: string): TimeSlotImportDraft[] {
  const cleanedText = text.replace(/^\uFEFF/, "").trim();
  if (!cleanedText) {
    throw new Error("File khung giờ đang trống.");
  }
  const delimiter = cleanedText.includes("\t") ? "\t" : ",";
  return parseTimeSlotSpreadsheetRows(parseDelimitedRows(cleanedText, delimiter));
}

async function parseTimeSlotWorkbook(file: File): Promise<TimeSlotImportDraft[]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("File Excel không có sheet dữ liệu.");
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  }) as unknown[][];

  return parseTimeSlotSpreadsheetRows(rows.map((row) => row.map((cell) => String(cell ?? ""))));
}

function parseTimeSlotSpreadsheetRows(rows: string[][]) {
  const filledRows = rows.filter((cells) => cells.some((cell) => cell.trim()));
  const [headers, ...dataRows] = filledRows;
  if (!headers || dataRows.length === 0) {
    throw new Error("File khung giờ cần có dòng tiêu đề và ít nhất một dòng dữ liệu.");
  }

  const headerMap = createTimeSlotHeaderMap(headers);
  return dataRows.map((cells) => ({
    id: createId("bulk-slot"),
    label: cells[headerMap.label]?.trim() ?? "",
    start: normalizeTimeValue(cells[headerMap.start]),
    end: normalizeTimeValue(cells[headerMap.end]),
    durationMinutes: normalizeDuration(cells[headerMap.durationMinutes]),
    active: headerMap.active === -1 ? true : parseTimeSlotActive(cells[headerMap.active]),
  }));
}

function createTimeSlotHeaderMap(headers: string[]) {
  const normalized = headers.map(normalizeHeader);
  const headerMap = {
    label: findHeaderIndex(normalized, ["tenkhunggio", "khunggio", "ten", "label"]),
    start: findHeaderIndex(normalized, ["giobatdau", "batdau", "start"]),
    end: findHeaderIndex(normalized, ["gioketthuc", "ketthuc", "end"]),
    durationMinutes: findHeaderIndex(normalized, ["sophut", "thoiluong", "durationminutes", "duration"]),
    active: findHeaderIndex(normalized, ["trangthai", "active", "status"]),
  };

  const requiredLabels: Record<string, string> = {
    label: "Tên khung giờ",
    start: "Giờ bắt đầu",
    end: "Giờ kết thúc",
    durationMinutes: "Số phút",
  };
  const missingHeaders = Object.entries(requiredLabels)
    .filter(([key]) => headerMap[key as keyof typeof headerMap] === -1)
    .map(([, value]) => value);

  if (missingHeaders.length > 0) {
    throw new Error(`File khung giờ thiếu cột: ${missingHeaders.join(", ")}.`);
  }

  return headerMap;
}

function parseTimeSlotActive(value: string | undefined) {
  const normalized = normalizeComparableText(value || "");
  return !["tat", "inactive", "off", "false", "0", "xoa"].includes(normalized);
}

function findDuplicateValues(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) {
      continue;
    }
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([value]) => value);
}

function parseLessonClipboard(text: string): BulkLessonRow[] {
  if (!text.includes("\t")) {
    return [];
  }

  return parseDelimitedRows(text, "\t")
    .filter((cells) => cells.some((cell) => cell.trim()))
    .map((cells) => ({
      id: createId("bulk-lesson"),
      grade: normalizeGrade(cells[0]),
      topicId: "",
      title: cells[1]?.trim() ?? "",
      lesson1Title: cells[2]?.trim() ?? "",
      lesson1Objective: cells[3]?.trim() ?? "",
      lesson2Title: cells[4]?.trim() ?? "",
      lesson2Objective: cells[5]?.trim() ?? "",
      samplePlanUrl: cells[6]?.trim() ?? "",
      durationMinutes: normalizeDuration(cells[7]),
    }));
}

function parseLessonSpreadsheet(text: string): BulkLessonRow[] {
  const cleanedText = text.replace(/^\uFEFF/, "").trim();
  if (!cleanedText) {
    throw new Error("File spreadsheet đang trống.");
  }

  const delimiter = cleanedText.includes("\t") ? "\t" : ",";
  return parseLessonSpreadsheetRows(parseDelimitedRows(cleanedText, delimiter));
}

async function parseLessonWorkbook(file: File): Promise<BulkLessonRow[]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("File Excel không có sheet dữ liệu.");
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  }) as unknown[][];

  return parseLessonSpreadsheetRows(rows.map((row) => row.map((cell) => String(cell ?? ""))));
}

function parseLessonSpreadsheetRows(rows: string[][]) {
  const filledRows = rows.filter((cells) => cells.some((cell) => cell.trim()));
  const [headers, ...dataRows] = filledRows;
  if (!headers || dataRows.length === 0) {
    throw new Error("File spreadsheet cần có dòng tiêu đề và ít nhất một dòng bài học.");
  }

  const headerMap = createLessonHeaderMap(headers);
  return dataRows.map((cells) => ({
    id: createId("bulk-lesson"),
    grade: normalizeGrade(cells[headerMap.grade]),
    topicId: "",
    title: cells[headerMap.title]?.trim() ?? "",
    lesson1Title: cells[headerMap.lesson1Title]?.trim() ?? "",
    lesson1Objective: cells[headerMap.lesson1Objective]?.trim() ?? "",
    lesson2Title: cells[headerMap.lesson2Title]?.trim() ?? "",
    lesson2Objective: cells[headerMap.lesson2Objective]?.trim() ?? "",
    samplePlanUrl: cells[headerMap.samplePlanUrl]?.trim() ?? "",
    durationMinutes: normalizeDuration(cells[headerMap.durationMinutes]),
  }));
}

function createLessonHeaderMap(headers: string[]) {
  const normalized = headers.map(normalizeHeader);
  const headerMap = {
    grade: findHeaderIndex(normalized, ["khoi", "grade"]),
    title: findHeaderIndex(normalized, ["tenchuyende", "tenbaihoc", "title"]),
    lesson1Title: findHeaderIndex(normalized, ["tentiet1", "lesson1title"]),
    lesson1Objective: findHeaderIndex(normalized, ["muctieutiet1", "lesson1objective"]),
    lesson2Title: findHeaderIndex(normalized, ["tentiet2", "lesson2title"]),
    lesson2Objective: findHeaderIndex(normalized, ["muctieutiet2", "lesson2objective"]),
    samplePlanUrl: findHeaderIndex(normalized, ["giaoanmau", "sampleplanurl", "sampleplan", "pdf"]),
    durationMinutes: findHeaderIndex(normalized, ["sophut", "durationminutes", "duration"]),
  };

  const missingHeaders = Object.entries(headerMap)
    .filter(([, index]) => index === -1)
    .map(([key]) => {
      const labels: Record<string, string> = {
        grade: "Khối",
        title: "Tên chuyên đề",
        lesson1Title: "Tên tiết 1",
        lesson1Objective: "Mục tiêu tiết 1",
        lesson2Title: "Tên tiết 2",
        lesson2Objective: "Mục tiêu tiết 2",
        samplePlanUrl: "Giáo án mẫu",
        durationMinutes: "Số phút",
      };
      return labels[key] ?? key;
    });

  if (missingHeaders.length > 0) {
    throw new Error(`File spreadsheet thiếu cột: ${missingHeaders.join(", ")}.`);
  }

  return headerMap;
}

function findHeaderIndex(headers: string[], candidates: string[]) {
  return headers.findIndex((header) => candidates.includes(header));
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function parseDelimitedRows(text: string, delimiter: "," | "\t") {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "\"") {
      if (quoted && next === "\"") {
        cell += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === delimiter && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

function normalizeGrade(value: string | undefined) {
  const text = String(value || "").trim();
  const matchedNumber = text.match(/\d+/)?.[0];
  const grade = matchedNumber ? `Khối ${Number(matchedNumber)}` : text;
  return lessonGrades.includes(grade) ? grade : "Khối 1";
}

function normalizeDuration(value: string | undefined): number | "" {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  const minutes = Number(text.match(/\d+/)?.[0] || 0);
  return Number.isFinite(minutes) ? minutes : "";
}

function toLessonDuration(value: string) {
  return value ? Number(value) : "";
}

function toCsv(rows: string[][]) {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

function escapeCsvCell(value: string) {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function createDraftScheduleItem(seed?: Partial<DraftScheduleItem>): DraftScheduleItem {
  return {
    id: seed?.id || createId("draft"),
    date: seed?.date || currentDateKey(),
    schoolId: seed?.schoolId || "",
    classId: seed?.classId || "",
    classIds: seed?.classIds ?? (seed?.classId ? [seed.classId] : []),
    lessonId: seed?.lessonId || "",
    lessonPeriods: seed?.lessonPeriods ?? ["lesson1"],
    timeSlotId: seed?.timeSlotId || "",
    teachingEnvironment: normalizeTeachingEnvironmentValue(seed?.teachingEnvironment),
    teacherIds: seed?.teacherIds ?? [],
    topicId: seed?.topicId ?? "",
    assistantIds: seed?.assistantIds ?? [],
  };
}

function lessonPeriodOptions(lesson: Lesson | undefined): Array<{ value: LessonPeriod; label: string }> {
  if (!lesson) {
    return [];
  }
  const lesson1Title = lesson.lesson1Title?.trim() || lesson.title;
  const lesson2Title = lesson.lesson2Title?.trim();
  const options: Array<{ value: LessonPeriod; label: string }> = [
    { value: "lesson1", label: `Tiết 1: ${lesson1Title}` },
  ];
  if (lesson2Title) {
    options.push({ value: "lesson2", label: `Tiết 2: ${lesson2Title}` });
  }
  return options;
}

function defaultLessonPeriods(lesson: Lesson | undefined): LessonPeriod[] {
  return lessonPeriodOptions(lesson).slice(0, 1).map((option) => option.value);
}

function normalizeLessonPeriods(periods: LessonPeriod[], lesson: Lesson | undefined): LessonPeriod[] {
  const allowed = new Set(lessonPeriodOptions(lesson).map((option) => option.value));
  const valid = periods.filter((period) => allowed.has(period));
  return valid.length > 0 ? Array.from(new Set(valid)) : defaultLessonPeriods(lesson);
}

function buildTeacherSlotKey(schedule: Pick<Schedule, "date" | "timeSlotId" | "teacherId">) {
  return `${schedule.date}|${schedule.timeSlotId}|${schedule.teacherId}`;
}

function buildClassSlotKey(schedule: Pick<Schedule, "date" | "timeSlotId" | "classId">) {
  return `${schedule.date}|${schedule.timeSlotId}|${schedule.classId}`;
}

function scheduleParticipantClassIds(schedule: Pick<Schedule, "classId" | "participantClassIds">) {
  const values = String(schedule.participantClassIds || schedule.classId)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return Array.from(new Set(values));
}

function formatScheduleParticipantScope(participantClasses: ClassRoom[], primaryClass?: ClassRoom) {
  if (participantClasses.length <= 1) {
    return `Lớp ${participantClasses[0]?.name || primaryClass?.name || "chưa cập nhật"}`;
  }
  return `${participantClasses.length} lớp tham gia`;
}

function formatScheduleParticipantClassNames(participantClasses: ClassRoom[], primaryClass?: ClassRoom) {
  const names = participantClasses.map((classRoom) => classRoom.name).filter(Boolean);
  return names.length > 0 ? names.join(", ") : primaryClass?.name || "Chưa rõ";
}

function canShareGroupActivitySlot(
  first: { schoolId: string; env: TeachingEnvironment },
  second: { schoolId: string; env: TeachingEnvironment },
) {
  return first.schoolId === second.schoolId && first.env !== "in_class" && second.env !== "in_class";
}

function pushDraftConflict(
  list: DraftScheduleConflict[],
  dedupe: Set<string>,
  conflict: Omit<DraftScheduleConflict, "key">,
) {
  const key = `${conflict.source}|${conflict.scope}|${conflict.date}|${conflict.timeSlotId}|${conflict.teacherId}|${conflict.classId}`;
  if (dedupe.has(key)) {
    return;
  }
  dedupe.add(key);
  list.push({ ...conflict, key });
}

function formatDraftConflictLine(
  conflict: DraftScheduleConflict,
  teachers: Teacher[],
  classes: ClassRoom[],
  slots: TimeSlot[],
) {
  const teacherName = teachers.find((item) => item.id === conflict.teacherId)?.name || conflict.teacherId;
  const className = classes.find((item) => item.id === conflict.classId)?.name || conflict.classId;
  const slotLabel = slots.find((item) => item.id === conflict.timeSlotId)?.label || conflict.timeSlotId;
  const target = conflict.scope === "teacher" ? `GV ${teacherName}` : `lớp ${className}`;
  const reason =
    conflict.source === "existing"
      ? "đã có lịch ở hệ thống"
      : "bị trùng trong danh sách chuẩn bị gửi";
  return `${conflict.date} · ${slotLabel} · ${target} ${reason}`;
}

function normalizeDraftScheduleItem(
  item: DraftScheduleItem,
  context: {
    schools: School[];
    classes: ClassRoom[];
    activeLessons: Lesson[];
    activeTimeSlots: TimeSlot[];
  },
): DraftScheduleItem {
  const schoolId = context.schools.some((school) => school.id === item.schoolId)
    ? item.schoolId
    : context.schools[0]?.id ?? "";
  const grade = pickDefaultGradeForSchool(schoolId, item.classId, context.classes);
  const classId = pickClassIdForSchoolGrade(schoolId, grade, item.classId, context.classes);
  const classIds = Array.from(
    new Set(
      (item.classIds.length > 0 ? item.classIds : [classId]).filter((selectedClassId) =>
        context.classes.some((classRoom) => classRoom.id === selectedClassId && classRoom.schoolId === schoolId && classRoom.grade === grade),
      ),
    ),
  );
  if (classIds.length === 0 && classId) {
    classIds.push(classId);
  }
  const lessonId = pickLessonIdForClass(classId, item.lessonId, context.classes, context.activeLessons);
  const selectedLesson = context.activeLessons.find((lesson) => lesson.id === lessonId);
  const timeSlotId = context.activeTimeSlots.some((slot) => slot.id === item.timeSlotId)
    ? item.timeSlotId
    : context.activeTimeSlots[0]?.id ?? "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : currentDateKey();
  return {
    ...item,
    date,
    schoolId,
    classId: classIds[0] ?? classId,
    classIds,
    lessonId,
    lessonPeriods: normalizeLessonPeriods(item.lessonPeriods, selectedLesson),
    timeSlotId,
    teachingEnvironment: normalizeTeachingEnvironmentValue(item.teachingEnvironment),
    teacherIds: item.teacherIds ?? [],
    topicId: item.topicId ?? "",
    assistantIds: item.assistantIds ?? [],
  };
}

function pickLessonIdForClass(
  classId: string,
  currentLessonId: string,
  classRooms: ClassRoom[],
  activeLessons: Lesson[],
) {
  const classRoom = classRooms.find((item) => item.id === classId);
  if (!classRoom) {
    return activeLessons.some((lesson) => lesson.id === currentLessonId) ? currentLessonId : activeLessons[0]?.id ?? "";
  }

  return pickLessonIdForGrade(classRoom.grade, currentLessonId, activeLessons);
}

function pickLessonIdForGrade(grade: string, currentLessonId: string, activeLessons: Lesson[]) {
  const lessons = lessonsForGrade(activeLessons, grade);
  if (lessons.length === 0) {
    return "";
  }
  return lessons.some((lesson) => lesson.id === currentLessonId) ? currentLessonId : lessons[0].id;
}

function lessonsForGrade(lessons: Lesson[], grade: string) {
  const normalizedGrade = normalizeComparableText(grade);
  return lessons.filter((lesson) => normalizeComparableText(lesson.grade) === normalizedGrade);
}

function classesForSchool(classRooms: ClassRoom[], schoolId: string) {
  return classRooms
    .filter((classRoom) => classRoom.schoolId === schoolId)
    .sort((a, b) => a.name.localeCompare(b.name, "vi", { numeric: true, sensitivity: "base" }));
}

function classesForSchoolGrade(classRooms: ClassRoom[], schoolId: string, grade: string) {
  const normalizedGrade = normalizeComparableText(grade);
  return classesForSchool(classRooms, schoolId).filter(
    (classRoom) => normalizeComparableText(classRoom.grade) === normalizedGrade,
  );
}

function gradeNumber(grade: string) {
  const number = Number(grade.match(/\d+/)?.[0]);
  return Number.isFinite(number) ? number : 0;
}

function gradesForClasses(classRooms: ClassRoom[]) {
  const sorted = [...classRooms].sort((a, b) => compareGradeLabel(a.grade, b.grade));
  const seen = new Set<string>();
  const grades: string[] = [];
  for (const classRoom of sorted) {
    const normalizedGrade = normalizeComparableText(classRoom.grade);
    if (!normalizedGrade || seen.has(normalizedGrade)) {
      continue;
    }
    seen.add(normalizedGrade);
    grades.push(classRoom.grade);
  }
  return grades;
}

function pickDefaultGradeForSchool(schoolId: string, currentClassId: string, classRooms: ClassRoom[]) {
  const schoolClasses = classesForSchool(classRooms, schoolId);
  const currentClass = schoolClasses.find((classRoom) => classRoom.id === currentClassId);
  if (currentClass) {
    return currentClass.grade;
  }
  return gradesForClasses(schoolClasses)[0] ?? "";
}

function pickClassIdForSchoolGrade(schoolId: string, grade: string, currentClassId: string, classRooms: ClassRoom[]) {
  const gradeClasses = classesForSchoolGrade(classRooms, schoolId, grade);
  if (gradeClasses.some((classRoom) => classRoom.id === currentClassId)) {
    return currentClassId;
  }
  return gradeClasses[0]?.id ?? "";
}

function compareGradeLabel(a: string, b: string) {
  const aIndex = gradeSortIndex(a);
  const bIndex = gradeSortIndex(b);
  if (aIndex !== bIndex) {
    return aIndex - bIndex;
  }
  return a.localeCompare(b, "vi", { sensitivity: "base", numeric: true });
}

function gradeSortIndex(grade: string) {
  const normalized = normalizeComparableText(grade);
  const index = lessonGrades.findIndex((item) => normalizeComparableText(item) === normalized);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function normalizeComparableText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function inferLessonPlanLinkName(url: string) {
  try {
    const parsed = new URL(url);
    const pathName = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).at(-1) || "");
    if (pathName && pathName.includes(".")) {
      return pathName;
    }
    if (parsed.hostname.includes("docs.google.com")) {
      return "Link Google Drive/PPT";
    }
    return parsed.hostname ? `Link giáo án - ${parsed.hostname}` : "Link giáo án";
  } catch {
    return "Link giáo án";
  }
}

function announcementPriorityLabel(priority: AppAnnouncementPriority) {
  return priority === "important_not_urgent" ? "Quan trọng - không khẩn" : "Quan trọng - khẩn";
}

const inputClass =
  "w-full rounded-2xl border border-sky-200 bg-white/90 px-4 py-3 text-base font-semibold text-[var(--brand-dark)] shadow-sm outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100 sm:text-sm";

const compactInputClass =
  "w-full rounded-xl border border-sky-200 bg-white/90 px-3 py-2 text-base font-semibold text-[var(--brand-dark)] shadow-sm outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100 sm:text-sm";

const primaryButtonClass =
  "ui-primary-gradient inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-white transition hover:-translate-y-0.5";

const ghostButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-white/90 px-3 py-2 text-xs font-black text-[var(--brand-dark)] shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50";

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const headers = new Headers(init?.headers);
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function fileToBase64(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Không đọc được file giáo án."));
    reader.readAsDataURL(file);
  });

  return dataUrl.split(",")[1] || "";
}

function isSupportedLessonPlanFile(file: File) {
  if (file.type && supportedLessonPlanMimeTypes.has(file.type)) {
    return true;
  }

  const lowerName = file.name.toLowerCase();
  return supportedLessonPlanExtensions.some((extension) => lowerName.endsWith(extension));
}

const invalidDateFallback = "—";

/**
 * Intl.DateTimeFormat.format() nem RangeError khi gap Invalid Date.
 * Du lieu doc tu Google Sheet co the bi trong hoac sai dinh dang, va mot o hong
 * du de lam sap toan bo cay React. Moi cho format ngay deu phai di qua helper nay.
 */
function safeFormatDate(value: string, options: Intl.DateTimeFormatOptions) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return invalidDateFallback;
  }

  return new Intl.DateTimeFormat("vi-VN", options).format(date);
}

function formatDate(value: string) {
  return safeFormatDate(`${value}T00:00:00`, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatShortDateLabel(value: string) {
  return safeFormatDate(`${value}T00:00:00`, {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function formatMonthTitle(monthKey: string) {
  return safeFormatDate(`${monthKey}-01T00:00:00`, {
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(value: string) {
  return safeFormatDate(value, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function currentDateKey() {
  return toDateKey(new Date());
}

function dateTimeDateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return toDateKey(date);
}

function currentMonthKey() {
  return currentDateKey().slice(0, 7);
}

function isWithinNextDays(dateKey: string, days: number) {
  const today = new Date(`${currentDateKey()}T00:00:00`);
  const target = new Date(`${dateKey}T00:00:00`);
  const diffDays = Math.floor((target.getTime() - today.getTime()) / 86_400_000);
  return diffDays >= 0 && diffDays <= days;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addMonths(monthKey: string, offset: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return toDateKey(date).slice(0, 7);
}

function buildCalendarDays(monthKey: string, selectedDateKey: string, viewMode: CalendarViewMode, schedules: Schedule[]) {
  const [year, month] = monthKey.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const selectedDate = selectedDateKey ? new Date(`${selectedDateKey}T00:00:00`) : new Date();
  const viewStart =
    viewMode === "day"
      ? selectedDate
      : viewMode === "week"
        ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - ((selectedDate.getDay() + 6) % 7))
        : new Date(year, month - 1, 1 - ((firstDay.getDay() + 6) % 7));
  const dayCount = viewMode === "month" ? 42 : viewMode === "week" ? 7 : 1;
  const today = currentDateKey();
  const schedulesByDate = new Map<string, Schedule[]>();

  for (const schedule of schedules) {
    const list = schedulesByDate.get(schedule.date) || [];
    list.push(schedule);
    schedulesByDate.set(schedule.date, list);
  }

  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(viewStart);
    date.setDate(viewStart.getDate() + index);
    const dateKey = toDateKey(date);

    return {
      dateKey,
      dayNumber: date.getDate(),
      inMonth: date.getMonth() === month - 1,
      isToday: dateKey === today,
      schedules: schedulesByDate.get(dateKey) || [],
    };
  });
}

function countSchedulesByStatus(schedules: Schedule[], status: Schedule["status"]) {
  return schedules.filter((schedule) => schedule.status === status).length;
}

function buildCalendarStats(schedules: Schedule[]) {
  return {
    total: schedules.length,
    sent: countSchedulesByStatus(schedules, "sent") + countSchedulesByStatus(schedules, "reassigned"),
    confirmed: countSchedulesByStatus(schedules, "confirmed"),
    attended: countSchedulesByStatus(schedules, "attended"),
    cancelled: countSchedulesByStatus(schedules, "cancelled"),
  };
}

function buildOperationalAlerts(schedules: Schedule[], attendanceRows: Attendance[], teachers: Teacher[]): OperationalAlert[] {
  const today = currentDateKey();
  const attendanceScheduleIds = new Set(attendanceRows.map((item) => item.scheduleId));
  const unconfirmedSoon = schedules.filter(
    (schedule) => ["sent", "reassigned"].includes(schedule.status) && schedule.date <= addDays(today, 2),
  );
  const pastWithoutAttendance = schedules.filter(
    (schedule) =>
      schedule.date < today &&
      !attendanceScheduleIds.has(schedule.id) &&
      !["cancelled", "draft"].includes(schedule.status),
  );
  const cancelledByTeacher = new Map<string, number>();
  for (const schedule of schedules) {
    if (schedule.status === "cancelled") {
      cancelledByTeacher.set(schedule.teacherId, (cancelledByTeacher.get(schedule.teacherId) ?? 0) + 1);
    }
  }
  const highCancelTeacher = Array.from(cancelledByTeacher.entries()).find(([, count]) => count >= 3);
  const alerts: OperationalAlert[] = [];

  if (unconfirmedSoon.length > 0) {
    alerts.push({
      id: "unconfirmed-soon",
      title: `${unconfirmedSoon.length} lịch sắp dạy chưa xác nhận`,
      body: "Ưu tiên gửi nhắc xác nhận cho các lịch này.",
      className: "border-amber-200 bg-amber-50 text-amber-800",
      scheduleIds: unconfirmedSoon.map((schedule) => schedule.id),
    });
  }
  if (pastWithoutAttendance.length > 0) {
    alerts.push({
      id: "past-without-attendance",
      title: `${pastWithoutAttendance.length} lịch quá ngày chưa điểm danh`,
      body: "Cần kiểm tra lại với giáo viên hoặc giáo vụ phụ trách.",
      className: "border-rose-200 bg-rose-50 text-rose-800",
      scheduleIds: pastWithoutAttendance.map((schedule) => schedule.id),
    });
  }
  if (highCancelTeacher) {
    const teacher = teachers.find((item) => item.id === highCancelTeacher[0]);
    const cancelledSchedules = schedules.filter(
      (schedule) => schedule.teacherId === highCancelTeacher[0] && schedule.status === "cancelled",
    );
    alerts.push({
      id: "high-cancel-teacher",
      title: `${teacher?.name || "Một giáo viên"} có nhiều lịch hủy`,
      body: `${highCancelTeacher[1]} lịch đã hủy trong dữ liệu đang lọc.`,
      className: "border-violet-200 bg-violet-50 text-violet-800",
      scheduleIds: cancelledSchedules.map((schedule) => schedule.id),
    });
  }

  return alerts;
}

function isDateWithinRange(date: string, from: string, to: string) {
  if (from && date < from) {
    return false;
  }
  if (to && date > to) {
    return false;
  }
  return true;
}

function matchesCalendarFilters(schedule: Schedule, filters: CalendarFilters) {
  if (filters.status !== "all" && schedule.status !== filters.status) {
    return false;
  }
  if (filters.teacherId !== "all" && schedule.teacherId !== filters.teacherId) {
    return false;
  }
  if (filters.schoolId !== "all" && schedule.schoolId !== filters.schoolId) {
    return false;
  }
  if (filters.classId !== "all" && schedule.classId !== filters.classId) {
    return false;
  }
  if (filters.timeSlotId !== "all" && schedule.timeSlotId !== filters.timeSlotId) {
    return false;
  }
  if (filters.dateFrom && schedule.date < filters.dateFrom) {
    return false;
  }
  if (filters.dateTo && schedule.date > filters.dateTo) {
    return false;
  }
  return true;
}

function sortSchedules(schedules: Schedule[], sortMode: CalendarSortMode) {
  const statusOrder: Record<string, number> = {
    sent: 0,
    reassigned: 1,
    confirmed: 2,
    lesson_plan_uploaded: 3,
    attended: 4,
    cancelled: 5,
    draft: 6,
  };

  return [...schedules].sort((a, b) => {
    if (sortMode === "date-desc") {
      return b.date.localeCompare(a.date);
    }
    if (sortMode === "status") {
      const byStatus = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
      return byStatus || a.date.localeCompare(b.date);
    }
    return a.date.localeCompare(b.date);
  });
}

function loadCalendarFilters(): CalendarFilters {
  if (typeof window === "undefined") {
    return defaultCalendarFilters;
  }

  try {
    const stored = window.localStorage.getItem(calendarFilterStorageKey);
    if (!stored) {
      return defaultCalendarFilters;
    }
    return { ...defaultCalendarFilters, ...JSON.parse(stored) };
  } catch {
    return defaultCalendarFilters;
  }
}

function saveCalendarFilters(filters: CalendarFilters) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(calendarFilterStorageKey, JSON.stringify(filters));
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function isAttendanceTrackedSchedule(schedule: Schedule) {
  return !["cancelled", "draft"].includes(schedule.status);
}

function formatSlotRange(slot: TimeSlot | undefined) {
  if (!slot?.start || !slot?.end) {
    return "";
  }

  return `${slot.start}-${slot.end}`;
}

function normalizeTeachingEnvironmentValue(value: unknown): NonNullable<Schedule["teachingEnvironment"]> {
  const normalized = String(value || "").trim() as NonNullable<Schedule["teachingEnvironment"]>;
  return teachingEnvironmentOptions.some((option) => option.value === normalized) ? normalized : defaultTeachingEnvironment;
}

function teachingEnvironmentLabel(value: Schedule["teachingEnvironment"]) {
  const normalized = normalizeTeachingEnvironmentValue(value);
  return teachingEnvironmentOptions.find((option) => option.value === normalized)?.label ?? "Trong lớp";
}

function teachingEnvironmentChipClass(value: Schedule["teachingEnvironment"]) {
  const normalized = normalizeTeachingEnvironmentValue(value);
  return teachingEnvironmentOptions.find((option) => option.value === normalized)?.chipClass ?? "bg-cyan-50 text-cyan-800";
}

function getAttendanceLateMinutes(schedule: Schedule, record: Attendance | undefined, slots: TimeSlot[]) {
  if (!record) {
    return 0;
  }

  const slot = slots.find((item) => item.id === schedule.timeSlotId);
  if (!slot?.start) {
    return 0;
  }

  const checkedInAt = new Date(record.checkedInAt);
  const startsAt = parseScheduleDateTime(schedule.date, slot.start);
  if (Number.isNaN(checkedInAt.getTime()) || Number.isNaN(startsAt.getTime()) || checkedInAt <= startsAt) {
    return 0;
  }

  return Math.ceil((checkedInAt.getTime() - startsAt.getTime()) / 60_000);
}

function isLateAttendance(schedule: Schedule, record: Attendance | undefined, slots: TimeSlot[]) {
  return getAttendanceLateMinutes(schedule, record, slots) > 0;
}

function buildAttendanceTeacherWarnings(
  schedules: Schedule[],
  attendanceRows: Attendance[],
  teachers: Teacher[],
  slots: TimeSlot[],
) {
  const today = currentDateKey();
  const attendanceBySchedule = new Map(attendanceRows.map((item) => [item.scheduleId, item]));
  const summary = new Map<
    string,
    { teacher: Teacher; missingCount: number; lateCount: number; missingSchedules: Schedule[]; lateSchedules: Schedule[] }
  >();

  for (const schedule of schedules) {
    if (schedule.date >= today || !isAttendanceTrackedSchedule(schedule)) {
      continue;
    }

    const teacher = teachers.find((item) => item.id === schedule.teacherId);
    if (!teacher) {
      continue;
    }

    const item = summary.get(teacher.id) ?? {
      teacher,
      missingCount: 0,
      lateCount: 0,
      missingSchedules: [],
      lateSchedules: [],
    };
    const record = attendanceBySchedule.get(schedule.id);
    if (!record) {
      item.missingCount += 1;
      item.missingSchedules.push(schedule);
    } else if (isLateAttendance(schedule, record, slots)) {
      item.lateCount += 1;
      item.lateSchedules.push(schedule);
    }
    summary.set(teacher.id, item);
  }

  return Array.from(summary.values())
    .filter((item) => item.missingCount >= 2 || item.lateCount >= 2)
    .sort((a, b) => b.missingCount + b.lateCount - (a.missingCount + a.lateCount));
}

function parseScheduleDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00`);
}

function auditActionLabel(action: string) {
  const labels: Record<string, string> = {
    "schedule.create": "Tạo lịch",
    "schedule.confirm": "Xác nhận lịch",
    "schedule.cancel": "Hủy lịch",
    "schedule.reassign": "Chuyển lịch",
    "schedule.attend": "Điểm danh",
    "schedule.attended": "Điểm danh",
  };
  return labels[action] ?? action;
}

function scheduleStatusTone(status: Schedule["status"]): "cyan" | "orange" | "emerald" | "amber" | "rose" | "violet" | "indigo" | "slate" {
  const tones: Record<Schedule["status"], "cyan" | "orange" | "emerald" | "amber" | "rose" | "violet" | "indigo" | "slate"> = {
    draft: "slate",
    sent: "amber",
    confirmed: "cyan",
    lesson_plan_uploaded: "indigo",
    attended: "emerald",
    cancelled: "rose",
    reassigned: "violet",
  };
  return tones[status];
}

function scheduleAccentBorder(status: Schedule["status"]) {
  const borders: Record<Schedule["status"], string> = {
    draft: "border-l-4 border-l-slate-300",
    sent: "border-l-4 border-l-amber-400",
    confirmed: "border-l-4 border-l-cyan-400",
    lesson_plan_uploaded: "border-l-4 border-l-indigo-400",
    attended: "border-l-4 border-l-emerald-400",
    cancelled: "border-l-4 border-l-rose-400",
    reassigned: "border-l-4 border-l-violet-400",
  };
  return borders[status];
}

function teacherNamesForSchedules(schedules: Schedule[], teachers: Teacher[]) {
  const names = new Set<string>();
  for (const schedule of schedules) {
    names.add(teachers.find((teacher) => teacher.id === schedule.teacherId)?.name || "Giáo viên");
  }
  return Array.from(names).slice(0, 3);
}

function splitObjectiveLines(objective: string) {
  const text = objective.trim();
  if (!text) {
    return ["Chưa cập nhật mục tiêu."];
  }

  const normalized = text
    .replace(/\s*-\s*Mục tiêu/gi, "\nMục tiêu")
    .replace(/\s*Mục tiêu\s*(\d+)/gi, "\nMục tiêu $1")
    .split(/\n|;|•/)
    .map((line) => line.replace(/^[-\s]+/, "").trim())
    .filter(Boolean);

  return normalized.length > 0 ? normalized : [text];
}
