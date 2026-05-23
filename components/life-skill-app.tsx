"use client";

import {
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  FileUp,
  FileSpreadsheet,
  GraduationCap,
  LayoutDashboard,
  LoaderCircle,
  Mail,
  MessageSquareText,
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
  Trash2,
  UploadCloud,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  attendance as seedAttendance,
  chatMessages as seedMessages,
  chatThreads as seedThreads,
  classes as seedClasses,
  lessonPlans as seedLessonPlans,
  lessons as seedLessons,
  notifications as seedNotifications,
  schedules as seedSchedules,
  schools as seedSchools,
  teachers as seedTeachers,
  timeSlots as seedTimeSlots,
  users,
} from "@/lib/sample-data";
import { statusLabels, statusStyles } from "@/lib/status";
import type {
  Attendance,
  ChatMessage,
  ChatThread,
  ClassRoom,
  Lesson,
  LessonPlan,
  Notification,
  Role,
  Schedule,
  School,
  Teacher,
  TimeSlot,
  User,
} from "@/lib/types";

type TabId =
  | "dashboard"
  | "assignment"
  | "calendar"
  | "teachers"
  | "lessons"
  | "slots"
  | "plans"
  | "attendance"
  | "chat"
  | "settings";

type DraftSchedule = {
  date: string;
  schoolId: string;
  classId: string;
  lessonId: string;
  timeSlotId: string;
  teacherIds: string[];
};

type AppData = {
  users: User[];
  teachers: Teacher[];
  schools: School[];
  classes: ClassRoom[];
  lessons: Lesson[];
  timeSlots: TimeSlot[];
  schedules: Schedule[];
  lessonPlans: LessonPlan[];
  attendance: Attendance[];
  chatThreads: ChatThread[];
  chatMessages: ChatMessage[];
  notifications: Notification[];
};

type AuthSession = {
  user: User | null;
};

type EmailResult = {
  scheduleId: string;
  teacherId: string;
  sent: boolean;
  reason?: string;
  id?: string;
};

type ScheduleCreateResponse = {
  schedules: Schedule[];
  chatThreads?: ChatThread[];
  notifications?: Notification[];
  emailResults?: EmailResult[];
};

type ScheduleUpdateResponse = Partial<Schedule> & {
  id: string;
  notifications?: Notification[];
  emailResult?: EmailResult | null;
};

type GasLessonPlanUploadResponse = {
  ok?: boolean;
  requestId?: string;
  lessonPlan: LessonPlan;
};

type LessonDraft = {
  grade: string;
  title: string;
  objective: string;
  samplePlanUrl: string;
  durationMinutes: number | "";
};

type BulkLessonRow = LessonDraft & {
  id: string;
};

const lessonGrades = Array.from({ length: 12 }, (_, index) => `Khá»‘i ${index + 1}`);
const lessonDurations = [45, 90];
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

const adminTabs: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
  { id: "dashboard", label: "Tá»•ng quan", icon: LayoutDashboard },
  { id: "assignment", label: "Giao lá»‹ch", icon: Send },
  { id: "calendar", label: "Lá»‹ch tá»•ng", icon: CalendarDays },
  { id: "teachers", label: "GiÃ¡o viÃªn", icon: Users },
  { id: "lessons", label: "BÃ i há»c", icon: BookOpen },
  { id: "slots", label: "Khung giá»", icon: Clock3 },
  { id: "plans", label: "GiÃ¡o Ã¡n", icon: FileUp },
  { id: "attendance", label: "Äiá»ƒm danh", icon: CheckCircle2 },
  { id: "chat", label: "Chat", icon: MessageSquareText },
  { id: "settings", label: "Cáº¥u hÃ¬nh", icon: Settings2 },
];

const teacherTabs: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
  { id: "calendar", label: "Lá»‹ch cá»§a tÃ´i", icon: CalendarDays },
  { id: "plans", label: "GiÃ¡o Ã¡n", icon: FileUp },
  { id: "attendance", label: "Äiá»ƒm danh", icon: CheckCircle2 },
  { id: "chat", label: "Chat", icon: MessageSquareText },
];

export function LifeSkillApp() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [appUsers, setAppUsers] = useState<User[]>(users);
  const [currentUserId, setCurrentUserId] = useState(users[0].id);
  const [teachers, setTeachers] = useState<Teacher[]>(seedTeachers);
  const [schools, setSchools] = useState<School[]>(seedSchools);
  const [classes, setClasses] = useState<ClassRoom[]>(seedClasses);
  const [lessons, setLessons] = useState<Lesson[]>(seedLessons);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>(seedTimeSlots);
  const [schedules, setSchedules] = useState<Schedule[]>(seedSchedules);
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>(seedLessonPlans);
  const [attendance, setAttendance] = useState<Attendance[]>(seedAttendance);
  const [chatThreads, setChatThreads] = useState<ChatThread[]>(seedThreads);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(seedMessages);
  const [notifications, setNotifications] = useState<Notification[]>(seedNotifications);
  const [dataStatus, setDataStatus] = useState<"loading" | "connected" | "offline">("loading");
  const [authStatus, setAuthStatus] = useState<"checking" | "signed-in" | "signed-out">("checking");
  const [saveError, setSaveError] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [lessonSearchTerm, setLessonSearchTerm] = useState("");
  const [lessonGradeFilter, setLessonGradeFilter] = useState("all");
  const [selectedThreadId, setSelectedThreadId] = useState(seedThreads[0]?.id ?? "");
  const [chatDraft, setChatDraft] = useState("");
  const [draftSchedule, setDraftSchedule] = useState<DraftSchedule>({
    date: "2026-05-23",
    schoolId: seedSchools[0].id,
    classId: seedClasses[0].id,
    lessonId: seedLessons[0].id,
    timeSlotId: seedTimeSlots[0].id,
    teacherIds: [seedTeachers[0].id],
  });
  const [teacherDraft, setTeacherDraft] = useState({
    name: "",
    email: "",
    phone: "",
    specialty: "",
    role: "teacher" as Role,
  });
  const [bulkLessonRows, setBulkLessonRows] = useState<BulkLessonRow[]>(() => [createBulkLessonRow()]);
  const [bulkLessonErrors, setBulkLessonErrors] = useState<Record<string, string>>({});
  const [editingLessonId, setEditingLessonId] = useState("");
  const [lessonEditDraft, setLessonEditDraft] = useState<LessonDraft>({
    grade: "Khá»‘i 1",
    title: "",
    objective: "",
    samplePlanUrl: "",
    durationMinutes: 45,
  });
  const [lessonDeleteTarget, setLessonDeleteTarget] = useState<Lesson | null>(null);
  const [reassignTarget, setReassignTarget] = useState<Schedule | null>(null);
  const [reassignTeacherId, setReassignTeacherId] = useState("");
  const [slotDraft, setSlotDraft] = useState({
    label: "",
    start: "07:30",
    end: "08:05",
  });
  const [schoolDraft, setSchoolDraft] = useState({
    name: "",
    district: "",
  });
  const [classDraft, setClassDraft] = useState({
    schoolId: seedSchools[0]?.id ?? "",
    name: "",
    grade: "Khá»‘i 1",
  });

  const activeUsers = useMemo(() => appUsers.filter((user) => user.isActive !== false), [appUsers]);
  const currentUser =
    activeUsers.find((user) => user.id === currentUserId) ??
    activeUsers.find((user) => user.role === "admin") ??
    users[0];
  const role = currentUser.role;
  const currentTeacherId = currentUser.teacherId ?? "";
  const activeTeachers = useMemo(() => teachers.filter((teacher) => teacher.active !== false), [teachers]);
  const activeLessons = useMemo(() => lessons.filter((lesson) => lesson.active !== false), [lessons]);
  const filteredLessons = useMemo(() => {
    const term = lessonSearchTerm.trim().toLowerCase();
    return activeLessons.filter((lesson) => {
      const matchesGrade = lessonGradeFilter === "all" || lesson.grade === lessonGradeFilter;
      const matchesTerm =
        !term ||
        [lesson.title, lesson.objective]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term);
      return matchesGrade && matchesTerm;
    });
  }, [activeLessons, lessonGradeFilter, lessonSearchTerm]);
  const isBusy = Boolean(pendingAction);

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
          setCurrentUserId(sessionUser.id);
          setAuthStatus("signed-in");
        } else {
          setAuthStatus("signed-out");
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setAuthStatus("signed-out");
        }
      }
    }

    async function loadAppData() {
      try {
        const data = await apiRequest<AppData>("/api/app-data");
        if (cancelled) {
          return;
        }

        setAppUsers(data.users);
        setTeachers(data.teachers);
        setSchools(data.schools);
        setClasses(data.classes);
        setLessons(data.lessons);
        setTimeSlots(data.timeSlots);
        setSchedules(data.schedules);
        setLessonPlans(data.lessonPlans);
        setAttendance(data.attendance);
        setChatThreads(data.chatThreads);
        setChatMessages(data.chatMessages);
        setNotifications(data.notifications);
        setDataStatus("connected");
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setDataStatus("offline");
        }
      }
    }

    loadSession();
    loadAppData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeUsers.some((user) => user.id === currentUserId)) {
      setCurrentUserId(activeUsers[0]?.id ?? users[0].id);
    }
  }, [activeUsers, currentUserId]);

  useEffect(() => {
    const allowedTabs = role === "admin" ? adminTabs : teacherTabs;
    if (!allowedTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(role === "admin" ? "dashboard" : "calendar");
    }
  }, [activeTab, role]);

  useEffect(() => {
    if (activeLessons.length > 0 && !activeLessons.some((lesson) => lesson.id === draftSchedule.lessonId)) {
      setDraftSchedule((current) => ({ ...current, lessonId: activeLessons[0].id }));
    }
  }, [activeLessons, draftSchedule.lessonId]);

  useEffect(() => {
    if (schools.length === 0 || classes.length === 0) {
      return;
    }

    setDraftSchedule((current) => {
      const nextSchoolId = schools.some((school) => school.id === current.schoolId)
        ? current.schoolId
        : schools[0].id;
      const classesInSchool = classes.filter((item) => item.schoolId === nextSchoolId);
      const nextClassId = classesInSchool.some((item) => item.id === current.classId)
        ? current.classId
        : classesInSchool[0]?.id ?? current.classId;
      if (nextSchoolId === current.schoolId && nextClassId === current.classId) {
        return current;
      }
      return { ...current, schoolId: nextSchoolId, classId: nextClassId };
    });
  }, [schools, classes]);

  useEffect(() => {
    if (schools.length === 0) {
      return;
    }
    if (!schools.some((school) => school.id === classDraft.schoolId)) {
      setClassDraft((current) => ({ ...current, schoolId: schools[0].id }));
    }
  }, [schools, classDraft.schoolId]);

  const visibleSchedules = useMemo(() => {
    const scoped =
      role === "admin"
        ? schedules
        : schedules.filter((schedule) => schedule.teacherId === currentTeacherId);

    if (!searchTerm.trim()) {
      return scoped;
    }

    const term = searchTerm.trim().toLowerCase();
    return scoped.filter((schedule) => {
      const teacher = teachers.find((item) => item.id === schedule.teacherId);
      const school = schools.find((item) => item.id === schedule.schoolId);
      const classRoom = classes.find((item) => item.id === schedule.classId);
      const lesson = lessons.find((item) => item.id === schedule.lessonId);
      return [teacher?.name, school?.name, classRoom?.name, lesson?.title, schedule.date]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [classes, currentTeacherId, lessons, role, schedules, schools, searchTerm, teachers]);

  const draftSchedulePreview = useMemo<Schedule[]>(
    () =>
      draftSchedule.teacherIds.map((teacherId) => ({
        id: `preview-${teacherId}`,
        date: draftSchedule.date,
        teacherId,
        schoolId: draftSchedule.schoolId,
        classId: draftSchedule.classId,
        lessonId: draftSchedule.lessonId,
        timeSlotId: draftSchedule.timeSlotId,
        status: "sent",
      })),
    [draftSchedule],
  );

  const unreadNotifications = notifications.filter(
    (item) => !item.read && (item.role === role || item.role === "all"),
  ).length;

  function lookupSchedule(schedule: Schedule) {
    return {
      teacher: teachers.find((item) => item.id === schedule.teacherId),
      school: schools.find((item) => item.id === schedule.schoolId),
      classRoom: classes.find((item) => item.id === schedule.classId),
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

  function addNotification(title: string, body: string, targetRole: Role | "all" = "admin") {
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
  }

  function handleSaveError(error: unknown) {
    const message = error instanceof Error ? error.message : "KhÃ´ng thá»ƒ ghi dá»¯ liá»‡u vÃ o Google Sheet.";
    console.error(error);
    setDataStatus("offline");
    setSaveError(message);
    addNotification("KhÃ´ng lÆ°u Ä‘Æ°á»£c dá»¯ liá»‡u", message, "admin");
  }

  async function saveRequest<T>(label: string, url: string, init?: RequestInit) {
    setPendingAction(label);
    try {
      return await apiRequest<T>(url, init);
    } finally {
      setPendingAction("");
    }
  }

  async function createSchedules() {
    if (draftSchedule.teacherIds.length === 0) {
      addNotification("ChÆ°a chá»n giÃ¡o viÃªn", "HÃ£y chá»n Ã­t nháº¥t má»™t giÃ¡o viÃªn Ä‘á»ƒ gá»­i lá»‹ch.", "admin");
      return;
    }

    let created: Schedule[];
    try {
      const response = await saveRequest<ScheduleCreateResponse>("Äang táº¡o lá»‹ch dáº¡y...", "/api/schedules", {
        method: "POST",
        body: JSON.stringify({ ...draftSchedule, createdBy: currentUser.id }),
      });
      created = response.schedules;
      if (response.chatThreads?.length) {
        setChatThreads((items) => [
          ...response.chatThreads!.filter((thread) => !items.some((item) => item.id === thread.id)),
          ...items,
        ]);
      }
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
  }

  async function confirmSchedule(scheduleId: string) {
    let response: ScheduleUpdateResponse;
    try {
      response = await saveRequest<ScheduleUpdateResponse>(`Äang xÃ¡c nháº­n lá»‹ch...`, `/api/schedules/${scheduleId}`, {
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
  }

  async function uploadLessonPlans(schedule: Schedule, selectedFiles: FileList | null) {
    if (!selectedFiles || selectedFiles.length === 0) {
      return;
    }

    const files = Array.from(selectedFiles);
    const invalidTypeFile = files.find((file) => !isSupportedLessonPlanFile(file));
    if (invalidTypeFile) {
      handleSaveError(
        new Error(`File ${invalidTypeFile.name} khÃ´ng Ä‘Ãºng Ä‘á»‹nh dáº¡ng. Chá»‰ há»— trá»£ PDF, DOC/DOCX, PPT/PPTX, XLS/XLSX, TXT, CSV.`),
      );
      return;
    }

    const tooLargeFile = files.find((file) => file.size > maxLessonPlanFileBytes);
    if (tooLargeFile) {
      handleSaveError(new Error(`File ${tooLargeFile.name} vÆ°á»£t quÃ¡ 10 MB.`));
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
          ? `${teacherName(schedule.teacherId)} Ä‘Ã£ táº£i lÃªn ${files[0].name}.`
          : `${teacherName(schedule.teacherId)} Ä‘Ã£ táº£i lÃªn ${successCount}/${files.length} file giÃ¡o Ã¡n.`;
      addNotification("GiÃ¡o Ã¡n má»›i", message, "admin");
    }

    if (failures.length > 0) {
      const firstError = failures[0]?.error?.message || "KhÃ´ng thá»ƒ táº£i má»™t sá»‘ file giÃ¡o Ã¡n.";
      handleSaveError(new Error(`${firstError} (${failures.length}/${files.length} file tháº¥t báº¡i)`));
    }
  }

  async function uploadSingleLessonPlan(
    schedule: Schedule,
    file: File,
  ): Promise<{ ok: true } | { ok: false; error: Error }> {
    try {
      const fileData = await fileToBase64(file);
      const response = await saveRequest<GasLessonPlanUploadResponse>("Äang táº£i giÃ¡o Ã¡n qua GAS...", "/api/lesson-plans/upload", {
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
        error: error instanceof Error ? error : new Error("KhÃ´ng thá»ƒ táº£i file giÃ¡o Ã¡n."),
      };
    }
  }

  async function editLessonPlan(plan: LessonPlan) {
    if (!canManageLessonPlan(plan)) {
      handleSaveError(new Error("Báº¡n khÃ´ng cÃ³ quyá»n sá»­a giÃ¡o Ã¡n nÃ y."));
      return;
    }

    const nextFileName = window.prompt("Nháº­p tÃªn giÃ¡o Ã¡n má»›i", plan.fileName)?.trim();
    if (!nextFileName || nextFileName === plan.fileName) {
      return;
    }

    try {
      await saveRequest("Äang cáº­p nháº­t tÃªn giÃ¡o Ã¡n...", `/api/lesson-plans/${plan.id}`, {
        method: "PATCH",
        body: JSON.stringify({ fileName: nextFileName }),
      });
      setDataStatus("connected");
      setSaveError("");
      setLessonPlans((items) =>
        items.map((item) => (item.id === plan.id ? { ...item, fileName: nextFileName } : item)),
      );
      addNotification("Cáº­p nháº­t giÃ¡o Ã¡n", `${teacherName(plan.teacherId)} Ä‘Ã£ Ä‘á»•i tÃªn giÃ¡o Ã¡n.`, "admin");
    } catch (error) {
      handleSaveError(error);
    }
  }

  async function deleteLessonPlan(plan: LessonPlan) {
    if (!canManageLessonPlan(plan)) {
      handleSaveError(new Error("Báº¡n khÃ´ng cÃ³ quyá»n xÃ³a giÃ¡o Ã¡n nÃ y."));
      return;
    }

    const confirmed = window.confirm(`XÃ³a giÃ¡o Ã¡n "${plan.fileName}"?`);
    if (!confirmed) {
      return;
    }

    try {
      await saveRequest("Äang xÃ³a giÃ¡o Ã¡n...", `/api/lesson-plans/${plan.id}`, {
        method: "DELETE",
      });
      setDataStatus("connected");
      setSaveError("");
      setLessonPlans((items) => items.filter((item) => item.id !== plan.id));
      addNotification("XÃ³a giÃ¡o Ã¡n", `${teacherName(plan.teacherId)} Ä‘Ã£ xÃ³a ${plan.fileName}.`, "admin");
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

    try {
      await saveRequest("Äang Ä‘iá»ƒm danh...", "/api/attendance", {
        method: "POST",
        body: JSON.stringify(record),
      });
      await saveRequest("Äang cáº­p nháº­t tráº¡ng thÃ¡i lá»‹ch...", `/api/schedules/${schedule.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "attended" }),
      });
      setDataStatus("connected");
      setSaveError("");
    } catch (error) {
      handleSaveError(error);
      return;
    }

    setAttendance((items) => [
      record,
      ...items,
    ]);
    setSchedules((items) =>
      items.map((item) => (item.id === schedule.id ? { ...item, status: "attended" } : item)),
    );
    addNotification("ÄÃ£ Ä‘iá»ƒm danh", `${teacherName(schedule.teacherId)} Ä‘Ã£ Ä‘iá»ƒm danh tiáº¿t dáº¡y.`, "admin");
  }

  async function cancelSchedule(schedule: Schedule) {
    let response: ScheduleUpdateResponse;
    try {
      response = await saveRequest<ScheduleUpdateResponse>("Äang há»§y lá»‹ch...", `/api/schedules/${schedule.id}`, {
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
      handleSaveError(new Error("KhÃ´ng tÃ¬m tháº¥y giÃ¡o viÃªn thay tháº¿."));
      return;
    }

    let response: ScheduleUpdateResponse;
    try {
      response = await saveRequest<ScheduleUpdateResponse>("Äang chuyá»ƒn lá»‹ch...", `/api/schedules/${reassignTarget.id}`, {
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
    setReassignTarget(null);
    setReassignTeacherId("");
  }

  async function addTeacher() {
    if (!teacherDraft.name || !teacherDraft.email) {
      return;
    }

    const teacher: Teacher = {
      id: createId("t"),
      name: teacherDraft.name,
      email: teacherDraft.email,
      phone: teacherDraft.phone || "ChÆ°a cáº­p nháº­t",
      avatarUrl: "",
      specialty: teacherDraft.specialty || "Ká»¹ nÄƒng sá»‘ng",
      active: true,
    };

    try {
      const savedTeacher = await saveRequest<Teacher>("Äang thÃªm giÃ¡o viÃªn...", "/api/teachers", {
        method: "POST",
        body: JSON.stringify(teacher),
      });
      const savedUser = await saveRequest<User>("Äang táº¡o tÃ i khoáº£n...", "/api/users", {
        method: "POST",
        body: JSON.stringify({
          id: `u-${savedTeacher.id}`,
          name: savedTeacher.name,
          email: savedTeacher.email,
          role: teacherDraft.role,
          teacherId: savedTeacher.id,
          avatarUrl: savedTeacher.avatarUrl,
          isActive: true,
        }),
      });
      setTeachers((items) => [savedTeacher, ...items]);
      setAppUsers((items) => [savedUser, ...items.filter((item) => item.id !== savedUser.id)]);
      setDataStatus("connected");
      setSaveError("");
    } catch (error) {
      handleSaveError(error);
      return;
    }

    setTeacherDraft({ name: "", email: "", phone: "", specialty: "", role: "teacher" });
  }

  async function updateTeacherRole(teacher: Teacher, nextRole: Role) {
    const linkedUser = userForTeacher(teacher.id);

    try {
      const savedUser = linkedUser
        ? await saveRequest<User>("Äang cáº­p nháº­t phÃ¢n quyá»n...", `/api/users/${linkedUser.id}`, {
            method: "PATCH",
            body: JSON.stringify({ role: nextRole }),
          })
        : await saveRequest<User>("Äang táº¡o tÃ i khoáº£n...", "/api/users", {
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

  function userForTeacher(teacherId: string) {
    return appUsers.find((user) => user.teacherId === teacherId);
  }

  async function logout() {
    try {
      await saveRequest("Äang Ä‘Äƒng xuáº¥t...", "/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error(error);
    }
    setAuthStatus("signed-out");
    setCurrentUserId(activeUsers.find((user) => user.role === "admin")?.id ?? users[0].id);
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
    const worksheet = XLSX.utils.aoa_to_sheet([["Khá»‘i", "TÃªn chuyÃªn Ä‘á»", "Má»¥c tiÃªu", "GiÃ¡o Ã¡n máº«u", "Sá»‘ phÃºt"]]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Bai hoc");
    const fileData = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    const blob = new Blob([fileData], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mau-bai-hoc-life-skill.xlsx";
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
      const errors = rows.reduce<Record<string, string>>((record, row, index) => {
        const error = validateLessonDraft(row, `DÃ²ng ${index + 2}`);
        if (error) {
          record[row.id] = error;
        }
        return record;
      }, {});

      setBulkLessonRows(rows.length > 0 ? rows : [createBulkLessonRow()]);
      setBulkLessonErrors(errors);
      if (Object.keys(errors).length > 0) {
        setSaveError("File spreadsheet cÃ²n dÃ²ng thiáº¿u dá»¯ liá»‡u. Vui lÃ²ng sá»­a cÃ¡c dÃ²ng lá»—i trÆ°á»›c khi lÆ°u.");
      } else {
        setSaveError("");
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "KhÃ´ng Ä‘á»c Ä‘Æ°á»£c file spreadsheet.");
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
      setBulkLessonErrors({ [bulkLessonRows[0].id]: "Cáº§n nháº­p Ã­t nháº¥t má»™t bÃ i há»c." });
      return;
    }

    const errors = rowsToSave.reduce<Record<string, string>>((record, row, index) => {
      const error = validateLessonDraft(row, `DÃ²ng ${index + 1}`);
      if (error) {
        record[row.id] = error;
      }
      return record;
    }, {});

    setBulkLessonErrors(errors);
    if (Object.keys(errors).length > 0) {
      setSaveError("Vui lÃ²ng sá»­a cÃ¡c dÃ²ng lá»—i trÆ°á»›c khi lÆ°u hÃ ng loáº¡t.");
      return;
    }

    try {
      const response = await saveRequest<{ lessons: Lesson[] }>("Äang lÆ°u bÃ i há»c hÃ ng loáº¡t...", "/api/lessons", {
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
      title: lesson.title,
      objective: lesson.objective,
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
      const savedLesson = await saveRequest<Lesson>("Äang lÆ°u bÃ i há»c...", `/api/lessons/${lessonId}`, {
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
      const savedLesson = await saveRequest<Lesson>("Äang xÃ³a bÃ i há»c...", `/api/lessons/${lessonId}`, {
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
    if (!slotDraft.label) {
      return;
    }

    const timeSlot = { id: createId("ts"), ...slotDraft };

    try {
      const savedTimeSlot = await saveRequest<TimeSlot>("Äang lÆ°u khung giá»...", "/api/time-slots", {
        method: "POST",
        body: JSON.stringify(timeSlot),
      });
      setTimeSlots((items) => [savedTimeSlot, ...items]);
      setDataStatus("connected");
      setSaveError("");
    } catch (error) {
      handleSaveError(error);
      return;
    }

    setSlotDraft({ label: "", start: "07:30", end: "08:05" });
  }

  async function addSchool() {
    if (!schoolDraft.name.trim()) {
      handleSaveError(new Error("TÃªn trÆ°á»ng lÃ  báº¯t buá»™c."));
      return;
    }

    try {
      const savedSchool = await saveRequest<School>("Äang lÆ°u trÆ°á»ng...", "/api/schools", {
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
    if (!classDraft.schoolId || !classDraft.name.trim() || !classDraft.grade.trim()) {
      handleSaveError(new Error("Thiáº¿u thÃ´ng tin lá»›p cáº§n táº¡o."));
      return;
    }

    try {
      const savedClass = await saveRequest<ClassRoom>("Äang lÆ°u lá»›p...", "/api/classes", {
        method: "POST",
        body: JSON.stringify({
          schoolId: classDraft.schoolId,
          name: classDraft.name.trim(),
          grade: classDraft.grade.trim(),
        }),
      });
      setClasses((items) => [savedClass, ...items.filter((item) => item.id !== savedClass.id)]);
      setDraftSchedule((current) => ({ ...current, schoolId: savedClass.schoolId, classId: savedClass.id }));
      setDataStatus("connected");
      setSaveError("");
    } catch (error) {
      handleSaveError(error);
      return;
    }

    setClassDraft((current) => ({ ...current, name: "", grade: "Khá»‘i 1" }));
  }

  function sendChatMessage() {
    if (!chatDraft.trim() || !selectedThreadId) {
      return;
    }

    setChatMessages((items) => [
      ...items,
      {
        id: createId("m"),
        threadId: selectedThreadId,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderRole: role,
        body: chatDraft.trim(),
        createdAt: new Date().toISOString(),
      },
    ]);
    setChatDraft("");
  }

  function teacherName(teacherId: string) {
    return teachers.find((teacher) => teacher.id === teacherId)?.name ?? "GiÃ¡o viÃªn";
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
    if (activeTab === "slots") {
      return SlotsPanel();
    }
    if (activeTab === "plans") {
      return LessonPlansPanel();
    }
    if (activeTab === "attendance") {
      return AttendancePanel();
    }
    if (activeTab === "chat") {
      return ChatPanel();
    }
    return SettingsPanel();
  }

  const visibleThreads =
    role === "admin"
      ? chatThreads
      : chatThreads.filter((thread) => thread.teacherId === currentTeacherId);

  return (
    <main className="min-h-screen bg-[var(--canvas)]">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="border-r border-[var(--line)] bg-white px-4 py-5 shadow-[12px_0_32px_rgba(25,146,176,0.06)]">
          <div className="flex items-center gap-3 px-2">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--brand)] text-white shadow-lg shadow-cyan-700/20">
              <GraduationCap size={24} />
            </div>
            <div>
              <p className="text-lg font-extrabold tracking-tight text-[var(--brand-dark)]">Life Skill</p>
              <p className="text-xs font-semibold uppercase text-[var(--muted)]">Lá»‹ch dáº¡y</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-cyan-100 bg-cyan-50 p-3">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase text-[var(--brand-dark)]">TÃ i khoáº£n</span>
              <select
                value={currentUser.id}
                onChange={(event) => setCurrentUserId(event.target.value)}
                className="w-full rounded-xl border border-cyan-100 bg-white px-3 py-2 text-sm font-bold text-[var(--brand-dark)] outline-none"
              >
                {activeUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} - {user.role === "admin" ? "Quáº£n trá»‹" : "GiÃ¡o viÃªn"}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-black text-[var(--brand-dark)]">
              {role === "admin" ? "Quyá»n quáº£n trá»‹" : "Quyá»n giÃ¡o viÃªn"}
            </div>
          </div>

          <nav className="mt-5 space-y-1">
            {(role === "admin" ? adminTabs : teacherTabs).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-bold transition ${
                    activeTab === item.id
                      ? "bg-[var(--brand)] text-white shadow-lg shadow-cyan-800/20"
                      : "text-[var(--brand-dark)] hover:bg-cyan-50 hover:text-[var(--brand-dark)]"
                  }`}
                  onClick={() => setActiveTab(item.id)}
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
          <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-white/92 px-4 py-4 backdrop-blur md:px-7">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-sm font-bold text-[var(--brand-dark)]">
                  {role === "admin" ? "BÃ n Ä‘iá»u phá»‘i giÃ¡o vá»¥" : "CÃ´ng viá»‡c cá»§a giÃ¡o viÃªn"}
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
                  Quáº£n lÃ½ lá»‹ch dáº¡y, giÃ¡o Ã¡n vÃ  Ä‘iá»ƒm danh
                </h1>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <span
                  className={`inline-flex h-11 items-center justify-center rounded-2xl px-3 text-xs font-black ${
                    dataStatus === "connected"
                      ? "bg-emerald-50 text-emerald-700"
                      : dataStatus === "loading"
                        ? "bg-cyan-50 text-[var(--brand-dark)]"
                        : "bg-orange-50 text-orange-700"
                  }`}
                >
                  {dataStatus === "connected"
                    ? "ÄÃ£ ná»‘i Google Sheet"
                    : dataStatus === "loading"
                      ? "Äang táº£i dá»¯ liá»‡u"
                      : "DÃ¹ng dá»¯ liá»‡u táº¡m"}
                </span>
                <label className="flex min-w-0 items-center gap-2 rounded-2xl border border-[var(--line)] bg-white px-3 py-2 shadow-sm transition focus-within:border-[var(--brand)]">
                  <Search size={17} className="text-[var(--muted)]" />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="TÃ¬m lá»‹ch, giÃ¡o viÃªn, lá»›p..."
                    className="min-w-0 bg-transparent text-sm text-[var(--brand-dark)] outline-none placeholder:text-slate-400"
                  />
                </label>
                <div className="flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-white px-3 py-2 shadow-sm">
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
                {authStatus === "signed-in" ? (
                  <button
                    onClick={logout}
                    className="h-11 rounded-2xl border border-[var(--line)] bg-white px-3 text-xs font-black text-[var(--brand-dark)] shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50"
                  >
                    ÄÄƒng xuáº¥t
                  </button>
                ) : (
                  <a
                    href="/api/auth/google"
                    className="inline-flex h-11 items-center rounded-2xl bg-[var(--brand)] px-3 text-xs font-black text-white shadow-lg shadow-cyan-700/20 transition hover:bg-[var(--brand-dark)]"
                  >
                    Google Login
                  </a>
                )}
                <button className="relative grid h-11 w-11 place-items-center rounded-2xl bg-[var(--accent)] text-white shadow-lg shadow-orange-500/20">
                  <Bell size={18} />
                  {unreadNotifications > 0 ? (
                    <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[11px] font-black">
                      {unreadNotifications}
                    </span>
                  ) : null}
                </button>
              </div>
            </div>
          </header>

          <div className="p-4 md:p-7">{renderMain()}</div>
          {pendingAction ? (
            <div className="fixed right-5 top-5 z-50 flex items-center gap-3 rounded-2xl border border-cyan-100 bg-white/95 px-4 py-3 text-sm font-black text-[var(--brand-dark)] shadow-2xl shadow-cyan-900/10 backdrop-blur">
              <LoaderCircle className="animate-spin text-[var(--brand)]" size={20} />
              {pendingAction}
            </div>
          ) : null}
          {lessonDeleteTarget ? (
            <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-3xl border border-rose-100 bg-white p-5 shadow-2xl">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-rose-700">
                  <Trash2 size={22} />
                </div>
                <h2 className="mt-4 text-xl font-black text-[var(--brand-dark)]">XÃ¡c nháº­n xÃ³a bÃ i há»c</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  BÃ i â€œ{lessonDeleteTarget.title}â€ sáº½ bá»‹ áº©n khá»i thÆ° viá»‡n vÃ  khÃ´ng cÃ²n hiá»‡n khi giao lá»‹ch má»›i.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    onClick={() => setLessonDeleteTarget(null)}
                    disabled={isBusy}
                    className="inline-flex h-11 items-center rounded-xl border border-[var(--line)] bg-white px-4 text-sm font-black text-[var(--brand-dark)] transition hover:bg-cyan-50 disabled:opacity-60"
                  >
                    Há»§y
                  </button>
                  <button
                    onClick={() => deleteLesson(lessonDeleteTarget.id)}
                    disabled={isBusy}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-black text-white shadow-lg shadow-rose-700/20 transition hover:bg-rose-700 disabled:opacity-60"
                  >
                    {isBusy ? <LoaderCircle className="animate-spin" size={17} /> : <Trash2 size={17} />}
                    XÃ³a bÃ i há»c
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {reassignTarget ? (
            <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-3xl border border-cyan-100 bg-white p-5 shadow-2xl">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-50 text-[var(--brand-dark)]">
                  <RefreshCcw size={22} />
                </div>
                <h2 className="mt-4 text-xl font-black text-[var(--brand-dark)]">Chuyá»ƒn lá»‹ch dáº¡y</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Chá»n giÃ¡o viÃªn má»›i cho lá»‹ch ngÃ y {formatDate(reassignTarget.date)}. Há»‡ thá»‘ng sáº½ cáº­p nháº­t Google Sheet
                  vÃ  gá»­i email xÃ¡c nháº­n cho giÃ¡o viÃªn má»›i.
                </p>
                <div className="mt-5 grid gap-2">
                  <span className="text-xs font-black uppercase text-[var(--brand-dark)]">GiÃ¡o viÃªn thay tháº¿</span>
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
                    Há»§y
                  </button>
                  <button
                    onClick={submitReassignSchedule}
                    disabled={isBusy || !reassignTeacherId}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--brand)] px-4 text-sm font-black text-white shadow-lg shadow-cyan-700/20 transition hover:bg-[var(--brand-dark)] disabled:opacity-60"
                  >
                    {isBusy ? <LoaderCircle className="animate-spin" size={17} /> : <RefreshCcw size={17} />}
                    Chuyá»ƒn lá»‹ch
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {saveError ? (
            <div className="fixed bottom-5 right-5 z-50 max-w-md rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm font-bold text-orange-800 shadow-2xl">
              <p className="font-black">KhÃ´ng ghi Ä‘Æ°á»£c Google Sheet</p>
              <p className="mt-1 leading-6">{saveError}</p>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );

  function Dashboard() {
    const confirmed = schedules.filter((item) => item.status === "confirmed").length;
    const uploaded = lessonPlans.length;
    const attended = attendance.length;

    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Stat icon={CalendarDays} label="Lá»‹ch trong há»‡ thá»‘ng" value={schedules.length} tone="cyan" />
          <Stat icon={CheckCircle2} label="ÄÃ£ nháº­n lá»‹ch" value={confirmed} tone="emerald" />
          <Stat icon={UploadCloud} label="GiÃ¡o Ã¡n Ä‘Ã£ ná»™p" value={uploaded} tone="blue" />
          <Stat icon={ShieldCheck} label="ÄÃ£ Ä‘iá»ƒm danh" value={attended} tone="orange" />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.5fr_0.85fr]">
          <Panel title="Lá»‹ch dáº¡y gáº§n nháº¥t" action="Xem theo tuáº§n">
            <ScheduleList items={visibleSchedules.slice(0, 5)} compact />
          </Panel>
          <Panel title="ThÃ´ng bÃ¡o váº­n hÃ nh" action={`${unreadNotifications} má»›i`}>
            <div className="space-y-3">
              {notifications
                .filter((item) => item.role === role || item.role === "all")
                .slice(0, 5)
                .map((item) => (
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
    const filteredClasses = classes.filter((item) => item.schoolId === draftSchedule.schoolId);

    return (
      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.35fr]">
        <Panel title="Táº¡o lá»‹ch dáº¡y má»›i" action="Email xÃ¡c nháº­n">
          <div className="grid gap-4">
            <Field label="NgÃ y dáº¡y">
              <input
                type="date"
                value={draftSchedule.date}
                onChange={(event) => setDraftSchedule({ ...draftSchedule, date: event.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="TrÆ°á»ng">
              <select
                value={draftSchedule.schoolId}
                onChange={(event) => {
                  const firstClass = classes.find((item) => item.schoolId === event.target.value);
                  setDraftSchedule({
                    ...draftSchedule,
                    schoolId: event.target.value,
                    classId: firstClass?.id ?? draftSchedule.classId,
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
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Lá»›p">
                <select
                  value={draftSchedule.classId}
                  onChange={(event) => setDraftSchedule({ ...draftSchedule, classId: event.target.value })}
                  className={inputClass}
                >
                  {filteredClasses.map((classRoom) => (
                    <option key={classRoom.id} value={classRoom.id}>
                      {classRoom.name} - {classRoom.grade}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Khung giá»">
                <select
                  value={draftSchedule.timeSlotId}
                  onChange={(event) =>
                    setDraftSchedule({ ...draftSchedule, timeSlotId: event.target.value })
                  }
                  className={inputClass}
                >
                  {timeSlots.map((slot) => (
                    <option key={slot.id} value={slot.id}>
                      {slot.label} ({slot.start}-{slot.end})
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="BÃ i há»c vÃ  má»¥c tiÃªu">
              <select
                value={draftSchedule.lessonId}
                onChange={(event) => setDraftSchedule({ ...draftSchedule, lessonId: event.target.value })}
                className={inputClass}
              >
                {activeLessons.map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>
                    {lesson.grade} - {lesson.title}
                  </option>
                ))}
              </select>
            </Field>
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
              <p className="text-sm font-extrabold text-[var(--brand-dark)]">Chá»n giÃ¡o viÃªn</p>
              <div className="mt-3 grid gap-2">
                {activeTeachers.map((teacher) => (
                  <label
                    key={teacher.id}
                    className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 text-sm font-semibold shadow-sm"
                  >
                    <input
                      type="checkbox"
                      checked={draftSchedule.teacherIds.includes(teacher.id)}
                      onChange={(event) => {
                        setDraftSchedule((current) => ({
                          ...current,
                          teacherIds: event.target.checked
                            ? [...current.teacherIds, teacher.id]
                            : current.teacherIds.filter((id) => id !== teacher.id),
                        }));
                      }}
                    />
                    <img alt="" src={teacher.avatarUrl} className="h-8 w-8 rounded-full object-cover" />
                    <span>{teacher.name}</span>
                    <span className="ml-auto text-xs text-[var(--muted)]">{teacher.specialty}</span>
                  </label>
                ))}
              </div>
            </div>
            <button
              onClick={createSchedules}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] px-5 py-3 text-sm font-black text-white shadow-lg shadow-cyan-700/20 transition hover:-translate-y-0.5 hover:bg-[var(--brand-dark)]"
            >
              <Send size={18} />
              Gá»­i lá»‹ch vÃ  email thÃ´ng bÃ¡o
            </button>
          </div>
        </Panel>

        <Panel title="Xem trÆ°á»›c lá»‹ch sáº¯p gá»­i" action={`Sáº½ táº¡o ${draftSchedulePreview.length} lá»‹ch`}>
          <ScheduleList items={draftSchedulePreview} compact />
        </Panel>
      </div>
    );
  }

  function CalendarPanel() {
    return (
      <Panel title={role === "admin" ? "Lá»‹ch tá»•ng quan" : "Lá»‹ch dáº¡y cá»§a tÃ´i"} action="NgÃ y / tuáº§n / thÃ¡ng">
        <ScheduleList items={visibleSchedules} />
      </Panel>
    );
  }

  function TeachersPanel() {
    return (
      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.3fr]">
        <Panel title="ThÃªm giÃ¡o viÃªn" action="PhÃ¢n quyá»n">
          <div className="grid gap-3">
            <input
              value={teacherDraft.name}
              onChange={(event) => setTeacherDraft({ ...teacherDraft, name: event.target.value })}
              placeholder="Há» tÃªn"
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
              placeholder="Sá»‘ Ä‘iá»‡n thoáº¡i"
              className={inputClass}
            />
            <input
              value={teacherDraft.specialty}
              onChange={(event) => setTeacherDraft({ ...teacherDraft, specialty: event.target.value })}
              placeholder="ChuyÃªn mÃ´n"
              className={inputClass}
            />
            <select
              value={teacherDraft.role}
              onChange={(event) => setTeacherDraft({ ...teacherDraft, role: event.target.value as Role })}
              className={inputClass}
            >
              <option value="teacher">Quyá»n giÃ¡o viÃªn</option>
              <option value="admin">Quyá»n quáº£n trá»‹</option>
            </select>
            <button onClick={addTeacher} className={primaryButtonClass}>
              <UserPlus size={18} />
              ThÃªm giÃ¡o viÃªn
            </button>
          </div>
        </Panel>
        <Panel title="Danh sÃ¡ch giÃ¡o viÃªn" action={`${teachers.length} ngÆ°á»i`}>
          <div className="grid gap-3 md:grid-cols-2">
            {teachers.map((teacher) => (
              <TeacherCard
                key={teacher.id}
                teacher={teacher}
                user={userForTeacher(teacher.id)}
                onRoleChange={updateTeacherRole}
              />
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  function LessonsPanel() {
    return (
      <div className="space-y-5">
        <Panel title="Nháº­p máº«u bÃ i há»c" action="Spreadsheet / hÃ ng loáº¡t">
          <div className="grid gap-4">
            <div className="app-scrollbar overflow-x-auto">
              <div className="min-w-[920px]">
                <div className="grid grid-cols-[130px_210px_1fr_220px_120px_48px] gap-2 px-2 pb-2 text-xs font-black uppercase text-[var(--brand-dark)]">
                  <span>Khá»‘i</span>
                  <span>TÃªn chuyÃªn Ä‘á»</span>
                  <span>Má»¥c tiÃªu</span>
                  <span>GiÃ¡o Ã¡n máº«u</span>
                  <span>Sá»‘ phÃºt</span>
                  <span />
                </div>
                <div className="space-y-2">
                  {bulkLessonRows.map((row) => (
                    <div key={row.id}>
                      <div className="grid grid-cols-[130px_210px_1fr_220px_120px_48px] items-start gap-2">
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
                          placeholder="TÃªn chuyÃªn Ä‘á»"
                          className={compactInputClass}
                        />
                        <textarea
                          value={row.objective}
                          onChange={(event) => updateBulkLessonRow(row.id, { objective: event.target.value })}
                          onPaste={(event) => pasteBulkLessons(row.id, event)}
                          placeholder="Má»—i má»¥c tiÃªu má»™t dÃ²ng"
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
                          <option value="">Chá»n</option>
                          {lessonDurations.map((minutes) => (
                            <option key={minutes} value={minutes}>
                              {minutes}
                            </option>
                          ))}
                        </select>
                        <button
                          title="XÃ³a dÃ²ng"
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
                    Táº£i máº«u spreadsheet
                  </button>
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-cyan-100 bg-white px-3 py-2 text-xs font-black text-[var(--brand-dark)] transition hover:bg-cyan-50">
                    <FileSpreadsheet size={16} />
                    Nháº­p tá»« spreadsheet
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
                    ThÃªm dÃ²ng
                  </button>
                  <button onClick={saveBulkLessons} disabled={isBusy} className={primaryButtonClass}>
                    {isBusy ? <LoaderCircle className="animate-spin" size={17} /> : <Save size={17} />}
                    {isBusy ? "Äang lÆ°u..." : "LÆ°u hÃ ng loáº¡t"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="ThÆ° viá»‡n bÃ i há»c" action={`${filteredLessons.length}/${activeLessons.length} bÃ i`}>
          <div className="mb-4 grid gap-3 md:grid-cols-[1fr_180px]">
            <label className="flex min-w-0 items-center gap-2 rounded-2xl border border-[var(--line)] bg-white px-3 py-2 shadow-sm transition focus-within:border-[var(--brand)]">
              <Search size={17} className="text-[var(--muted)]" />
              <input
                value={lessonSearchTerm}
                onChange={(event) => setLessonSearchTerm(event.target.value)}
                placeholder="TÃ¬m chuyÃªn Ä‘á», má»¥c tiÃªu..."
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--brand-dark)] outline-none placeholder:text-slate-400"
              />
            </label>
            <select
              value={lessonGradeFilter}
              onChange={(event) => setLessonGradeFilter(event.target.value)}
              className={compactInputClass}
            >
              <option value="all">Táº¥t cáº£ khá»‘i</option>
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
                          <option value="">Chá»n</option>
                          {lessonDurations.map((minutes) => (
                            <option key={minutes} value={minutes}>
                              {minutes} phÃºt
                            </option>
                          ))}
                        </select>
                      </div>
                      <textarea
                        value={lessonEditDraft.objective}
                        onChange={(event) => setLessonEditDraft({ ...lessonEditDraft, objective: event.target.value })}
                        className={`${compactInputClass} min-h-28 resize-y whitespace-pre-line`}
                      />
                      <input
                        value={lessonEditDraft.samplePlanUrl}
                        onChange={(event) =>
                          setLessonEditDraft({ ...lessonEditDraft, samplePlanUrl: event.target.value })
                        }
                        placeholder="Link giÃ¡o Ã¡n máº«u trÃªn Google Drive/PDF"
                        className={compactInputClass}
                      />
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          onClick={() => setEditingLessonId("")}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-black text-[var(--brand-dark)] transition hover:bg-cyan-50"
                        >
                          <X size={16} />
                          Há»§y
                        </button>
                        <button onClick={() => saveLessonEdit(lesson.id)} disabled={isBusy} className={primaryButtonClass}>
                          {isBusy ? <LoaderCircle className="animate-spin" size={17} /> : <Save size={17} />}
                          {isBusy ? "Äang lÆ°u..." : "LÆ°u"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase text-[var(--brand)]">{lesson.grade}</p>
                          <h3 className="mt-1 text-base font-black text-[var(--brand-dark)]">{lesson.title}</h3>
                          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[var(--muted)]">
                            {lesson.objective}
                          </p>
                          {lesson.samplePlanUrl ? (
                            <a
                              href={lesson.samplePlanUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700 transition hover:bg-blue-100"
                            >
                              <FileSpreadsheet size={14} />
                              GiÃ¡o Ã¡n máº«u
                            </a>
                          ) : null}
                        </div>
                        <span className="shrink-0 rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-700">
                          {lesson.durationMinutes} phÃºt
                        </span>
                      </div>
                      <div className="mt-4 flex justify-end gap-2">
                        <button
                          title="Sá»­a bÃ i há»c"
                          onClick={() => startEditLesson(lesson)}
                          className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-50 text-[var(--brand-dark)] transition hover:bg-cyan-100"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          title="XÃ³a bÃ i há»c"
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
    return (
      <div className="grid gap-5 xl:grid-cols-[0.75fr_1.35fr]">
        <Panel title="ThÃªm khung giá»" action="Chá»n nhanh khi giao lá»‹ch">
          <div className="grid gap-3">
            <input
              value={slotDraft.label}
              onChange={(event) => setSlotDraft({ ...slotDraft, label: event.target.value })}
              placeholder="VÃ­ dá»¥: Tiáº¿t 5"
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
            <button onClick={addSlot} className={primaryButtonClass}>
              <Clock3 size={18} />
              LÆ°u khung giá»
            </button>
          </div>
        </Panel>
        <Panel title="Khung giá» lÃ m viá»‡c" action={`${timeSlots.length} khung`}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {timeSlots.map((slot) => (
              <div key={slot.id} className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
                <p className="text-sm font-black text-[var(--brand-dark)]">{slot.label}</p>
                <p className="mt-2 text-2xl font-black text-[var(--brand)]">
                  {slot.start}
                  <span className="text-[var(--muted)]"> - </span>
                  {slot.end}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  function LessonPlansPanel() {
    const scopedSchedules =
      role === "admin" ? schedules : schedules.filter((item) => item.teacherId === currentTeacherId);

    return (
      <Panel title="Trung tÃ¢m giÃ¡o Ã¡n" action="Sáºµn sÃ ng Google Drive">
        <div className="space-y-3">
          {scopedSchedules.map((schedule) => {
            const meta = lookupSchedule(schedule);
            return (
              <div
                key={schedule.id}
                className="grid gap-4 rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm lg:grid-cols-[1fr_auto]"
              >
                <div>
                  <p className="text-sm font-black text-[var(--brand-dark)]">{meta.lesson?.title}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {meta.teacher?.name} - {meta.school?.name} - Lá»›p {meta.classRoom?.name} -{" "}
                    {formatDate(schedule.date)}
                  </p>
                  {meta.plans.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {meta.plans.map((plan) => (
                        <div key={plan.id} className="flex items-center justify-between gap-2">
                          <a
                            href={plan.driveUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-w-0 items-center gap-2 rounded-xl bg-cyan-50 px-3 py-2 text-sm font-bold text-[var(--brand-dark)]"
                          >
                            <UploadCloud size={16} />
                            <span className="truncate">{plan.fileName}</span>
                          </a>
                          {canManageLessonPlan(plan) ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                title="Sá»­a tÃªn giÃ¡o Ã¡n"
                                onClick={() => editLessonPlan(plan)}
                                className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-50 text-[var(--brand-dark)] transition hover:bg-cyan-100"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                title="XÃ³a giÃ¡o Ã¡n"
                                onClick={() => deleteLessonPlan(plan)}
                                className="grid h-8 w-8 place-items-center rounded-lg bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm font-semibold text-orange-700">ChÆ°a cÃ³ giÃ¡o Ã¡n</p>
                  )}
                </div>
                {role === "teacher" || role === "admin" ? (
                  <label className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 text-sm font-black text-white shadow-lg shadow-orange-500/20 transition hover:-translate-y-0.5">
                    <FileUp size={17} />
                    Táº£i lÃªn
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
                ) : null}
              </div>
            );
          })}
        </div>
      </Panel>
    );
  }

  function AttendancePanel() {
    const scopedSchedules =
      role === "admin" ? schedules : schedules.filter((item) => item.teacherId === currentTeacherId);

    return (
      <Panel title="Äiá»ƒm danh tá»«ng tiáº¿t" action="LÆ°u thá»i gian báº¥m">
        <div className="space-y-3">
          {scopedSchedules.map((schedule) => {
            const meta = lookupSchedule(schedule);
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
                    {meta.teacher?.name} táº¡i {meta.school?.name}, lá»›p {meta.classRoom?.name}
                  </p>
                  {meta.checkIn ? (
                    <p className="mt-2 text-sm font-bold text-emerald-700">
                      ÄÃ£ Ä‘iá»ƒm danh lÃºc {formatDateTime(meta.checkIn.checkedInAt)}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm font-bold text-orange-700">ChÆ°a Ä‘iá»ƒm danh</p>
                  )}
                </div>
                <button
                  onClick={() => checkIn(schedule)}
                  disabled={Boolean(meta.checkIn) || schedule.status === "cancelled"}
                  className={primaryButtonClass}
                >
                  <CheckCircle2 size={18} />
                  Äiá»ƒm danh
                </button>
              </div>
            );
          })}
        </div>
      </Panel>
    );
  }

  function ChatPanel() {
    const selectedThread = visibleThreads.find((thread) => thread.id === selectedThreadId) ?? visibleThreads[0];
    const selectedMessages = selectedThread
      ? chatMessages.filter((message) => message.threadId === selectedThread.id)
      : [];

    return (
      <div className="grid min-h-[620px] gap-5 xl:grid-cols-[340px_1fr]">
        <Panel title="KÃªnh trao Ä‘á»•i" action="Theo giÃ¡o viÃªn vÃ  tá»«ng tiáº¿t">
          <div className="space-y-2">
            {visibleThreads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => setSelectedThreadId(thread.id)}
                className={`w-full rounded-2xl border p-3 text-left transition ${
                  selectedThread?.id === thread.id
                    ? "border-[var(--brand)] bg-cyan-50"
                    : "border-[var(--line)] bg-white hover:border-cyan-200"
                }`}
              >
                <p className="text-sm font-black text-[var(--brand-dark)]">{thread.title}</p>
                <p className="mt-1 text-xs font-bold uppercase text-[var(--muted)]">
                  {thread.type === "teacher" ? "Theo giÃ¡o viÃªn" : "Theo tiáº¿t dáº¡y"}
                </p>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title={selectedThread?.title ?? "Chat"} action="Cáº­p nháº­t Ä‘á»‹nh ká»³">
          <div className="flex min-h-[510px] flex-col">
            <div className="app-scrollbar flex-1 space-y-3 overflow-y-auto pr-2">
              {selectedMessages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[82%] rounded-2xl p-3 ${
                    message.senderRole === role
                      ? "ml-auto bg-[var(--brand)] text-white"
                      : "bg-cyan-50 text-[var(--brand-dark)]"
                  }`}
                >
                  <p className="text-xs font-black opacity-80">{message.senderName}</p>
                  <p className="mt-1 text-sm leading-6">{message.body}</p>
                  <p className="mt-2 text-[11px] font-bold opacity-70">{formatDateTime(message.createdAt)}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <input
                value={chatDraft}
                onChange={(event) => setChatDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    sendChatMessage();
                  }
                }}
                placeholder="Nháº­p tin nháº¯n..."
                className={inputClass}
              />
              <button onClick={sendChatMessage} className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--brand)] text-white">
                <Send size={18} />
              </button>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  function SettingsPanel() {
    const sheets = [
      "Users",
      "Teachers",
      "Schools",
      "Classes",
      "Lessons",
      "TimeSlots",
      "Schedules",
      "LessonPlans",
      "Attendance",
      "ChatThreads",
      "ChatMessages",
      "Notifications",
      "AuditLogs",
    ];

    return (
      <div className="space-y-5">
        <Panel title="Thiết lập Trường và Lớp" action={`${schools.length} trường • ${classes.length} lớp`}>
          <div className="grid gap-5 lg:grid-cols-2">
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
                {schools.slice(0, 6).map((school) => (
                  <div key={school.id} className="rounded-xl bg-cyan-50 px-3 py-2 text-sm font-semibold text-[var(--brand-dark)]">
                    {school.name}
                    <span className="ml-2 text-xs font-bold text-[var(--muted)]">{school.district}</span>
                  </div>
                ))}
              </div>
            </div>
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
                  placeholder="Tên lớp (ví dụ: 1A)"
                  className={inputClass}
                />
                <input
                  value={classDraft.grade}
                  onChange={(event) => setClassDraft({ ...classDraft, grade: event.target.value })}
                  placeholder="Khối (ví dụ: Khối 1)"
                  className={inputClass}
                />
                <button onClick={addClassRoom} className={primaryButtonClass}>
                  <Plus size={18} />
                  Lưu lớp
                </button>
              </div>
              <div className="mt-4 space-y-2">
                {classes.slice(0, 6).map((classRoom) => (
                  <div key={classRoom.id} className="rounded-xl bg-cyan-50 px-3 py-2 text-sm font-semibold text-[var(--brand-dark)]">
                    {classRoom.name} - {classRoom.grade}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Cấu hình Google Workspace" action="Sẵn sàng nối API">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <School2 className="text-[var(--brand)]" />
                <h3 className="text-base font-black text-[var(--brand-dark)]">
                  Google Sheets là cơ sở dữ liệu chính
                </h3>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                Tạo spreadsheet với các tab đúng tên bên dưới, cấp quyền cho service account, sau đó điền
                GOOGLE_SHEETS_SPREADSHEET_ID vào .env.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {sheets.map((sheet) => (
                  <span key={sheet} className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-[var(--brand-dark)]">
                    {sheet}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <Mail className="text-[var(--accent)]" />
                <h3 className="text-base font-black text-[var(--brand-dark)]">Email và Google Drive</h3>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                Email thông báo dùng GAS hoặc Resend. Giáo án tải lên sẽ lưu trên Google Drive và gắn metadata vào
                tab LessonPlans.
              </p>
              <div className="mt-4 rounded-2xl bg-orange-50 p-4 text-sm font-bold text-orange-800">
                Sau khi thêm hoặc sửa env trên server, cần redeploy để API route nhận biến môi trường mới.
              </div>
            </div>
          </div>
        </Panel>
      </div>
    );
  }
  function ScheduleList({ items, compact = false }: { items: Schedule[]; compact?: boolean }) {
    if (items.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-cyan-200 bg-cyan-50 p-8 text-center">
          <p className="font-black text-[var(--brand-dark)]">ChÆ°a cÃ³ lá»‹ch phÃ¹ há»£p</p>
          <p className="mt-2 text-sm text-[var(--muted)]">HÃ£y táº¡o lá»‹ch má»›i hoáº·c Ä‘á»•i bá»™ lá»c tÃ¬m kiáº¿m.</p>
        </div>
      );
    }

    return (
      <div className="app-scrollbar overflow-x-auto">
        <div className="min-w-[860px] space-y-3">
          {items.map((schedule) => {
            const meta = lookupSchedule(schedule);
            return (
              <div
                key={schedule.id}
                className="grid grid-cols-[130px_1fr_160px_170px] items-center gap-4 rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-lg"
              >
                <div>
                  <p className="text-sm font-black text-[var(--brand-dark)]">{formatDate(schedule.date)}</p>
                  <p className="mt-1 text-xs font-bold text-[var(--muted)]">
                    {meta.slot?.label} {meta.slot?.start}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-[var(--brand-dark)]">{meta.lesson?.title}</p>
                  <p className="mt-1 truncate text-sm text-[var(--muted)]">
                    {meta.school?.name} - Lá»›p {meta.classRoom?.name} - {meta.lesson?.objective}
                  </p>
                </div>
                <TeacherHover teacher={meta.teacher} />
                <div className="flex items-center justify-end gap-2">
                  <StatusChip status={schedule.status} />
                  {!compact && role === "admin" ? (
                    <div className="flex gap-1">
                      <button
                        title="Chuyá»ƒn lá»‹ch"
                        onClick={() => reassignSchedule(schedule)}
                        className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-50 text-[var(--brand-dark)] transition hover:bg-cyan-100"
                      >
                        <RefreshCcw size={16} />
                      </button>
                      <button
                        title="Há»§y lá»‹ch"
                        onClick={() => cancelSchedule(schedule)}
                        className="grid h-9 w-9 place-items-center rounded-xl bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ) : null}
                  {!compact && role === "teacher" && ["sent", "reassigned"].includes(schedule.status) ? (
                    <button
                      onClick={() => confirmSchedule(schedule.id)}
                      className="rounded-xl bg-[var(--brand)] px-3 py-2 text-xs font-black text-white"
                    >
                      XÃ¡c nháº­n
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-[var(--line)] bg-white p-5 shadow-[0_18px_48px_rgba(20,33,43,0.06)]">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-lg font-black tracking-tight text-[var(--brand-dark)]">{title}</h2>
        {action ? (
          <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-[var(--brand-dark)]">
            {action}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  tone: "cyan" | "emerald" | "blue" | "orange";
}) {
  const toneClass = {
    cyan: "bg-cyan-50 text-[var(--brand)]",
    emerald: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    orange: "bg-orange-50 text-orange-700",
  }[tone];

  return (
    <div className="rounded-3xl border border-[var(--line)] bg-white p-5 shadow-[0_18px_48px_rgba(20,33,43,0.06)]">
      <div className={`grid h-12 w-12 place-items-center rounded-2xl ${toneClass}`}>
        <Icon size={22} />
      </div>
      <p className="mt-5 text-3xl font-black tracking-tight text-[var(--brand-dark)]">{value}</p>
      <p className="mt-1 text-sm font-bold text-[var(--muted)]">{label}</p>
    </div>
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

function TeacherCard({
  teacher,
  user,
  onRoleChange,
}: {
  teacher: Teacher;
  user?: User;
  onRoleChange: (teacher: Teacher, role: Role) => void;
}) {
  const role = user?.role ?? "teacher";

  return (
    <div className="group relative rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-lg">
      <div className="flex items-center gap-3">
        <img alt={teacher.name} src={teacher.avatarUrl} className="h-12 w-12 rounded-2xl object-cover" />
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-[var(--brand-dark)]">{teacher.name}</p>
          <p className="truncate text-xs font-bold text-[var(--muted)]">{teacher.specialty}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
        <span className="rounded-full bg-cyan-50 px-3 py-1 text-[var(--brand-dark)]">{teacher.email}</span>
        <span className="rounded-full bg-orange-50 px-3 py-1 text-orange-700">{teacher.phone}</span>
      </div>
      <div className="mt-4 grid gap-2">
        <span className="text-xs font-black uppercase text-[var(--brand-dark)]">PhÃ¢n quyá»n</span>
        <select
          value={role}
          onChange={(event) => onRoleChange(teacher, event.target.value as Role)}
          className="w-full rounded-xl border border-[var(--line)] bg-cyan-50 px-3 py-2 text-sm font-black text-[var(--brand-dark)] outline-none transition focus:border-[var(--brand)]"
        >
          <option value="teacher">GiÃ¡o viÃªn</option>
          <option value="admin">Quáº£n trá»‹</option>
        </select>
      </div>
    </div>
  );
}

function TeacherHover({ teacher }: { teacher?: Teacher }) {
  if (!teacher) {
    return <span className="text-sm font-bold text-[var(--muted)]">ChÆ°a rÃµ</span>;
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

function StatusChip({ status }: { status: Schedule["status"] }) {
  return (
    <span className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-black ${statusStyles[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

function createEmptyLessonDraft(): LessonDraft {
  return {
    grade: "Khá»‘i 1",
    title: "",
    objective: "",
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
  return Boolean(row.title.trim() || row.objective.trim() || row.samplePlanUrl.trim());
}

function stripBulkLessonId(row: BulkLessonRow): LessonDraft {
  return {
    grade: row.grade,
    title: row.title,
    objective: row.objective,
    samplePlanUrl: row.samplePlanUrl,
    durationMinutes: row.durationMinutes,
  };
}

function validateLessonDraft(row: LessonDraft, label = "BÃ i há»c") {
  if (!lessonGrades.includes(row.grade)) {
    return `${label}: Khá»‘i pháº£i náº±m trong Khá»‘i 1 Ä‘áº¿n Khá»‘i 12.`;
  }

  if (!row.title.trim()) {
    return `${label}: TÃªn chuyÃªn Ä‘á» lÃ  báº¯t buá»™c.`;
  }

  if (!row.objective.trim()) {
    return `${label}: Má»¥c tiÃªu lÃ  báº¯t buá»™c.`;
  }

  if (row.durationMinutes === "") {
    return `${label}: Sá»‘ phÃºt lÃ  báº¯t buá»™c.`;
  }

  if (row.samplePlanUrl.trim() && !/^https?:\/\//i.test(row.samplePlanUrl.trim())) {
    return `${label}: GiÃ¡o Ã¡n máº«u pháº£i lÃ  link http hoáº·c https.`;
  }

  if (!lessonDurations.includes(Number(row.durationMinutes))) {
    return `${label}: Sá»‘ phÃºt chá»‰ Ä‘Æ°á»£c lÃ  45 hoáº·c 90.`;
  }

  return "";
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
      title: cells[1]?.trim() ?? "",
      objective: cells[2]?.trim() ?? "",
      samplePlanUrl: cells.length >= 5 ? cells[3]?.trim() ?? "" : "",
      durationMinutes: normalizeDuration(cells.length >= 5 ? cells[4] : cells[3]),
    }));
}

function parseLessonSpreadsheet(text: string): BulkLessonRow[] {
  const cleanedText = text.replace(/^\uFEFF/, "").trim();
  if (!cleanedText) {
    throw new Error("File spreadsheet Ä‘ang trá»‘ng.");
  }

  const delimiter = cleanedText.includes("\t") ? "\t" : ",";
  return parseLessonSpreadsheetRows(parseDelimitedRows(cleanedText, delimiter));
}

async function parseLessonWorkbook(file: File): Promise<BulkLessonRow[]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("File Excel khÃ´ng cÃ³ sheet dá»¯ liá»‡u.");
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
    throw new Error("File spreadsheet cáº§n cÃ³ dÃ²ng tiÃªu Ä‘á» vÃ  Ã­t nháº¥t má»™t dÃ²ng bÃ i há»c.");
  }

  const headerMap = createLessonHeaderMap(headers);
  return dataRows.map((cells) => ({
    id: createId("bulk-lesson"),
    grade: normalizeGrade(cells[headerMap.grade]),
    title: cells[headerMap.title]?.trim() ?? "",
    objective: cells[headerMap.objective]?.trim() ?? "",
    samplePlanUrl: cells[headerMap.samplePlanUrl]?.trim() ?? "",
    durationMinutes: normalizeDuration(cells[headerMap.durationMinutes]),
  }));
}

function createLessonHeaderMap(headers: string[]) {
  const normalized = headers.map(normalizeHeader);
  const headerMap = {
    grade: findHeaderIndex(normalized, ["khoi", "grade"]),
    title: findHeaderIndex(normalized, ["tenchuyende", "tenbaihoc", "title"]),
    objective: findHeaderIndex(normalized, ["muctieu", "objective"]),
    samplePlanUrl: findHeaderIndex(normalized, ["giaoanmau", "sampleplanurl", "sampleplan", "pdf"]),
    durationMinutes: findHeaderIndex(normalized, ["sophut", "durationminutes", "duration"]),
  };

  const missingHeaders = Object.entries(headerMap)
    .filter(([, index]) => index === -1)
    .map(([key]) => {
      const labels: Record<string, string> = {
        grade: "Khá»‘i",
        title: "TÃªn chuyÃªn Ä‘á»",
        objective: "Má»¥c tiÃªu",
        samplePlanUrl: "GiÃ¡o Ã¡n máº«u",
        durationMinutes: "Sá»‘ phÃºt",
      };
      return labels[key] ?? key;
    });

  if (missingHeaders.length > 0) {
    throw new Error(`File spreadsheet thiáº¿u cá»™t: ${missingHeaders.join(", ")}.`);
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
    .replace(/Ä‘/g, "d")
    .replace(/Ä/g, "d")
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
  const grade = matchedNumber ? `Khá»‘i ${Number(matchedNumber)}` : text;
  return lessonGrades.includes(grade) ? grade : "Khá»‘i 1";
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

const inputClass =
  "w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--brand-dark)] outline-none transition placeholder:text-slate-400 focus:border-[var(--brand)] focus:ring-4 focus:ring-cyan-100";

const compactInputClass =
  "w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-[var(--brand-dark)] outline-none transition placeholder:text-slate-400 focus:border-[var(--brand)] focus:ring-4 focus:ring-cyan-100";

const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] px-4 py-3 text-sm font-black text-white shadow-lg shadow-cyan-700/20 transition hover:-translate-y-0.5 hover:bg-[var(--brand-dark)]";

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const response = await fetch(url, {
    ...init,
    headers: isFormData
      ? init?.headers
      : {
          "Content-Type": "application/json",
          ...init?.headers,
        },
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
    reader.onerror = () => reject(new Error("KhÃ´ng Ä‘á»c Ä‘Æ°á»£c file giÃ¡o Ã¡n."));
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}


