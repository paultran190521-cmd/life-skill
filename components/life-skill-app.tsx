"use client";

import {
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileUp,
  GraduationCap,
  LayoutDashboard,
  Mail,
  MessageSquareText,
  Phone,
  Plus,
  RefreshCcw,
  School2,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserPlus,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
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

const today = "2026-05-19";

const adminTabs: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
  { id: "dashboard", label: "Tong quan", icon: LayoutDashboard },
  { id: "assignment", label: "Giao lich", icon: Send },
  { id: "calendar", label: "Lich tong", icon: CalendarDays },
  { id: "teachers", label: "Giao vien", icon: Users },
  { id: "lessons", label: "Bai hoc", icon: BookOpen },
  { id: "slots", label: "Khung gio", icon: Clock3 },
  { id: "plans", label: "Giao an", icon: FileUp },
  { id: "attendance", label: "Diem danh", icon: CheckCircle2 },
  { id: "chat", label: "Chat", icon: MessageSquareText },
  { id: "settings", label: "Cau hinh", icon: Settings2 },
];

const teacherTabs: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
  { id: "calendar", label: "Lich cua toi", icon: CalendarDays },
  { id: "plans", label: "Giao an", icon: FileUp },
  { id: "attendance", label: "Diem danh", icon: CheckCircle2 },
  { id: "chat", label: "Chat", icon: MessageSquareText },
];

export function LifeSkillApp() {
  const [role, setRole] = useState<Role>("admin");
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [teachers, setTeachers] = useState<Teacher[]>(seedTeachers);
  const [schools] = useState<School[]>(seedSchools);
  const [classes] = useState<ClassRoom[]>(seedClasses);
  const [lessons, setLessons] = useState<Lesson[]>(seedLessons);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>(seedTimeSlots);
  const [schedules, setSchedules] = useState<Schedule[]>(seedSchedules);
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>(seedLessonPlans);
  const [attendance, setAttendance] = useState<Attendance[]>(seedAttendance);
  const [chatThreads, setChatThreads] = useState<ChatThread[]>(seedThreads);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(seedMessages);
  const [notifications, setNotifications] = useState<Notification[]>(seedNotifications);
  const [searchTerm, setSearchTerm] = useState("");
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
  });
  const [lessonDraft, setLessonDraft] = useState({
    grade: "Khoi 1",
    title: "",
    objective: "",
    durationMinutes: 35,
  });
  const [slotDraft, setSlotDraft] = useState({
    label: "",
    start: "07:30",
    end: "08:05",
  });

  const currentUser = role === "admin" ? users[0] : users[1];
  const currentTeacherId = currentUser.teacherId ?? "t1";

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
      plan: lessonPlans.find((item) => item.scheduleId === schedule.id),
      checkIn: attendance.find((item) => item.scheduleId === schedule.id),
    };
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

  function createSchedules() {
    if (draftSchedule.teacherIds.length === 0) {
      addNotification("Chua chon giao vien", "Hay chon it nhat mot giao vien de gui lich.", "admin");
      return;
    }

    const created = draftSchedule.teacherIds.map<Schedule>((teacherId) => ({
      id: createId("sch"),
      date: draftSchedule.date,
      teacherId,
      schoolId: draftSchedule.schoolId,
      classId: draftSchedule.classId,
      lessonId: draftSchedule.lessonId,
      timeSlotId: draftSchedule.timeSlotId,
      status: "sent",
      sentAt: new Date().toISOString(),
    }));

    setSchedules((items) => [...created, ...items]);
    created.forEach((schedule) => ensureScheduleThread(schedule));
    addNotification(
      "Da gui lich day",
      `${created.length} lich moi da duoc tao va san sang gui email CTA xac nhan.`,
      "admin",
    );
    addNotification("Ban co lich day moi", "Vui long mo lich ca nhan de xac nhan.", "teacher");
  }

  function ensureScheduleThread(schedule: Schedule) {
    setChatThreads((items) => {
      if (items.some((thread) => thread.scheduleId === schedule.id)) {
        return items;
      }

      const classRoom = classes.find((item) => item.id === schedule.classId);
      const slot = timeSlots.find((item) => item.id === schedule.timeSlotId);
      return [
        ...items,
        {
          id: `thread-${schedule.id}`,
          type: "schedule",
          teacherId: schedule.teacherId,
          scheduleId: schedule.id,
          title: `${slot?.label ?? "Tiet"} - Lop ${classRoom?.name ?? ""}`,
        },
      ];
    });
  }

  function confirmSchedule(scheduleId: string) {
    setSchedules((items) =>
      items.map((item) =>
        item.id === scheduleId
          ? { ...item, status: "confirmed", confirmedAt: new Date().toISOString() }
          : item,
      ),
    );
    addNotification("Giao vien da nhan lich", "Mot lich day vua duoc xac nhan.", "admin");
  }

  function uploadLessonPlan(schedule: Schedule, fileName: string) {
    const safeName = fileName || `giao-an-${schedule.id}.pdf`;
    const plan: LessonPlan = {
      id: createId("lp"),
      scheduleId: schedule.id,
      teacherId: schedule.teacherId,
      fileName: safeName,
      driveUrl: `https://drive.google.com/life-skill/${schedule.id}/${encodeURIComponent(safeName)}`,
      uploadedAt: new Date().toISOString(),
    };

    setLessonPlans((items) => [plan, ...items.filter((item) => item.scheduleId !== schedule.id)]);
    setSchedules((items) =>
      items.map((item) =>
        item.id === schedule.id && item.status !== "attended"
          ? { ...item, status: "lesson_plan_uploaded" }
          : item,
      ),
    );
    addNotification("Giao an moi", `${teacherName(schedule.teacherId)} da upload ${safeName}.`, "admin");
  }

  function checkIn(schedule: Schedule) {
    if (attendance.some((item) => item.scheduleId === schedule.id)) {
      return;
    }

    setAttendance((items) => [
      {
        id: createId("att"),
        scheduleId: schedule.id,
        teacherId: schedule.teacherId,
        checkedInAt: new Date().toISOString(),
      },
      ...items,
    ]);
    setSchedules((items) =>
      items.map((item) => (item.id === schedule.id ? { ...item, status: "attended" } : item)),
    );
    addNotification("Da diem danh", `${teacherName(schedule.teacherId)} da diem danh tiet day.`, "admin");
  }

  function cancelSchedule(schedule: Schedule) {
    setSchedules((items) =>
      items.map((item) => (item.id === schedule.id ? { ...item, status: "cancelled" } : item)),
    );
    addNotification("Lich da huy", `${teacherName(schedule.teacherId)} khong con lich ${schedule.date}.`, "all");
  }

  function reassignSchedule(schedule: Schedule) {
    const replacement = teachers.find((teacher) => teacher.id !== schedule.teacherId && teacher.active);
    if (!replacement) {
      return;
    }

    setSchedules((items) =>
      items.map((item) =>
        item.id === schedule.id
          ? {
              ...item,
              teacherId: replacement.id,
              status: "reassigned",
              reassignedFrom: schedule.teacherId,
              sentAt: new Date().toISOString(),
            }
          : item,
      ),
    );
    addNotification(
      "Da chuyen lich",
      `Lich cua ${teacherName(schedule.teacherId)} da chuyen sang ${replacement.name}.`,
      "admin",
    );
  }

  function addTeacher() {
    if (!teacherDraft.name || !teacherDraft.email) {
      return;
    }

    setTeachers((items) => [
      {
        id: createId("t"),
        name: teacherDraft.name,
        email: teacherDraft.email,
        phone: teacherDraft.phone || "Chua cap nhat",
        avatarUrl:
          "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=160&q=80",
        specialty: teacherDraft.specialty || "Ky nang song",
        active: true,
      },
      ...items,
    ]);
    setTeacherDraft({ name: "", email: "", phone: "", specialty: "" });
  }

  function addLesson() {
    if (!lessonDraft.title || !lessonDraft.objective) {
      return;
    }

    setLessons((items) => [{ id: createId("l"), ...lessonDraft }, ...items]);
    setLessonDraft({ grade: "Khoi 1", title: "", objective: "", durationMinutes: 35 });
  }

  function addSlot() {
    if (!slotDraft.label) {
      return;
    }

    setTimeSlots((items) => [{ id: createId("ts"), ...slotDraft }, ...items]);
    setSlotDraft({ label: "", start: "07:30", end: "08:05" });
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
    return teachers.find((teacher) => teacher.id === teacherId)?.name ?? "Giao vien";
  }

  function renderMain() {
    if (activeTab === "dashboard") {
      return <Dashboard />;
    }
    if (activeTab === "assignment") {
      return <AssignmentPanel />;
    }
    if (activeTab === "calendar") {
      return <CalendarPanel />;
    }
    if (activeTab === "teachers") {
      return <TeachersPanel />;
    }
    if (activeTab === "lessons") {
      return <LessonsPanel />;
    }
    if (activeTab === "slots") {
      return <SlotsPanel />;
    }
    if (activeTab === "plans") {
      return <LessonPlansPanel />;
    }
    if (activeTab === "attendance") {
      return <AttendancePanel />;
    }
    if (activeTab === "chat") {
      return <ChatPanel />;
    }
    return <SettingsPanel />;
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
              <p className="text-lg font-extrabold tracking-tight">Life Skill</p>
              <p className="text-xs font-semibold uppercase text-[var(--muted)]">Scheduler</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-cyan-100 bg-cyan-50 p-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
                  role === "admin" ? "bg-white text-[var(--brand-dark)] shadow-sm" : "text-cyan-800"
                }`}
                onClick={() => {
                  setRole("admin");
                  setActiveTab("dashboard");
                }}
              >
                Admin
              </button>
              <button
                className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
                  role === "teacher" ? "bg-white text-[var(--brand-dark)] shadow-sm" : "text-cyan-800"
                }`}
                onClick={() => {
                  setRole("teacher");
                  setActiveTab("calendar");
                }}
              >
                Giao vien
              </button>
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
                      : "text-slate-600 hover:bg-cyan-50 hover:text-[var(--brand-dark)]"
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
                  {role === "admin" ? "Ban dieu phoi giao vu" : "Cong viec cua giao vien"}
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
                  Quan ly lich day, giao an va diem danh
                </h1>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="flex min-w-0 items-center gap-2 rounded-2xl border border-[var(--line)] bg-white px-3 py-2 shadow-sm transition focus-within:border-[var(--brand)]">
                  <Search size={17} className="text-[var(--muted)]" />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Tim lich, giao vien, lop..."
                    className="min-w-0 bg-transparent text-sm outline-none"
                  />
                </label>
                <div className="flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-white px-3 py-2 shadow-sm">
                  <img
                    alt={currentUser.name}
                    src={currentUser.avatarUrl}
                    className="h-9 w-9 rounded-full object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold">{currentUser.name}</p>
                    <p className="truncate text-xs text-[var(--muted)]">{currentUser.email}</p>
                  </div>
                </div>
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
          <Stat icon={CalendarDays} label="Lich trong he thong" value={schedules.length} tone="cyan" />
          <Stat icon={CheckCircle2} label="Da nhan lich" value={confirmed} tone="emerald" />
          <Stat icon={UploadCloud} label="Giao an da nop" value={uploaded} tone="blue" />
          <Stat icon={ShieldCheck} label="Da diem danh" value={attended} tone="orange" />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.5fr_0.85fr]">
          <Panel title="Lich day gan nhat" action="Xem theo tuan">
            <ScheduleList items={visibleSchedules.slice(0, 5)} compact />
          </Panel>
          <Panel title="Thong bao van hanh" action={`${unreadNotifications} moi`}>
            <div className="space-y-3">
              {notifications
                .filter((item) => item.role === role || item.role === "all")
                .slice(0, 5)
                .map((item) => (
                  <div key={item.id} className="rounded-2xl border border-[var(--line)] bg-slate-50 p-4">
                    <p className="text-sm font-extrabold">{item.title}</p>
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
        <Panel title="Tao lich day moi" action="Email CTA">
          <div className="grid gap-4">
            <Field label="Ngay day">
              <input
                type="date"
                value={draftSchedule.date}
                onChange={(event) => setDraftSchedule({ ...draftSchedule, date: event.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Truong">
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
              <Field label="Lop">
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
              <Field label="Khung gio">
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
            <Field label="Bai hoc va muc tieu">
              <select
                value={draftSchedule.lessonId}
                onChange={(event) => setDraftSchedule({ ...draftSchedule, lessonId: event.target.value })}
                className={inputClass}
              >
                {lessons.map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>
                    {lesson.grade} - {lesson.title}
                  </option>
                ))}
              </select>
            </Field>
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
              <p className="text-sm font-extrabold text-[var(--brand-dark)]">Chon giao vien</p>
              <div className="mt-3 grid gap-2">
                {teachers.map((teacher) => (
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
              Gui lich va email thong bao
            </button>
          </div>
        </Panel>

        <Panel title="Preview lich sap gui" action="Cho phep trung gio">
          <ScheduleList items={visibleSchedules.slice(0, 7)} compact />
        </Panel>
      </div>
    );
  }

  function CalendarPanel() {
    return (
      <Panel title={role === "admin" ? "Lich tong quan" : "Lich day cua toi"} action="Ngay / tuan / thang">
        <ScheduleList items={visibleSchedules} />
      </Panel>
    );
  }

  function TeachersPanel() {
    return (
      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.3fr]">
        <Panel title="Them giao vien" action="Phan quyen">
          <div className="grid gap-3">
            <input
              value={teacherDraft.name}
              onChange={(event) => setTeacherDraft({ ...teacherDraft, name: event.target.value })}
              placeholder="Ho ten"
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
              placeholder="So dien thoai"
              className={inputClass}
            />
            <input
              value={teacherDraft.specialty}
              onChange={(event) => setTeacherDraft({ ...teacherDraft, specialty: event.target.value })}
              placeholder="Chuyen mon"
              className={inputClass}
            />
            <button onClick={addTeacher} className={primaryButtonClass}>
              <UserPlus size={18} />
              Them giao vien
            </button>
          </div>
        </Panel>
        <Panel title="Danh sach giao vien" action={`${teachers.length} nguoi`}>
          <div className="grid gap-3 md:grid-cols-2">
            {teachers.map((teacher) => (
              <TeacherCard key={teacher.id} teacher={teacher} />
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  function LessonsPanel() {
    return (
      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.3fr]">
        <Panel title="Them bai hoc" action="Theo khoi">
          <div className="grid gap-3">
            <select
              value={lessonDraft.grade}
              onChange={(event) => setLessonDraft({ ...lessonDraft, grade: event.target.value })}
              className={inputClass}
            >
              {["Khoi 1", "Khoi 2", "Khoi 3", "Khoi 4", "Khoi 5"].map((grade) => (
                <option key={grade}>{grade}</option>
              ))}
            </select>
            <input
              value={lessonDraft.title}
              onChange={(event) => setLessonDraft({ ...lessonDraft, title: event.target.value })}
              placeholder="Ten bai hoc"
              className={inputClass}
            />
            <textarea
              value={lessonDraft.objective}
              onChange={(event) => setLessonDraft({ ...lessonDraft, objective: event.target.value })}
              placeholder="Muc tieu giang day"
              className={`${inputClass} min-h-28 resize-none`}
            />
            <button onClick={addLesson} className={primaryButtonClass}>
              <Plus size={18} />
              Them bai hoc
            </button>
          </div>
        </Panel>
        <Panel title="Thu vien bai hoc" action={`${lessons.length} bai`}>
          <div className="space-y-3">
            {lessons.map((lesson) => (
              <div key={lesson.id} className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase text-[var(--brand)]">{lesson.grade}</p>
                    <h3 className="mt-1 text-base font-black">{lesson.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{lesson.objective}</p>
                  </div>
                  <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-700">
                    {lesson.durationMinutes} phut
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  function SlotsPanel() {
    return (
      <div className="grid gap-5 xl:grid-cols-[0.75fr_1.35fr]">
        <Panel title="Them khung gio" action="Chon nhanh khi giao lich">
          <div className="grid gap-3">
            <input
              value={slotDraft.label}
              onChange={(event) => setSlotDraft({ ...slotDraft, label: event.target.value })}
              placeholder="Vi du: Tiet 5"
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
              Luu khung gio
            </button>
          </div>
        </Panel>
        <Panel title="Khung gio lam viec" action={`${timeSlots.length} khung`}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {timeSlots.map((slot) => (
              <div key={slot.id} className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
                <p className="text-sm font-black">{slot.label}</p>
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
      <Panel title="Trung tam giao an" action="Google Drive ready">
        <div className="space-y-3">
          {scopedSchedules.map((schedule) => {
            const meta = lookupSchedule(schedule);
            return (
              <div
                key={schedule.id}
                className="grid gap-4 rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm lg:grid-cols-[1fr_auto]"
              >
                <div>
                  <p className="text-sm font-black">{meta.lesson?.title}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {meta.teacher?.name} - {meta.school?.name} - Lop {meta.classRoom?.name} -{" "}
                    {formatDate(schedule.date)}
                  </p>
                  {meta.plan ? (
                    <a
                      href={meta.plan.driveUrl}
                      className="mt-3 inline-flex items-center gap-2 rounded-xl bg-cyan-50 px-3 py-2 text-sm font-bold text-[var(--brand-dark)]"
                    >
                      <UploadCloud size={16} />
                      {meta.plan.fileName}
                    </a>
                  ) : (
                    <p className="mt-3 text-sm font-semibold text-orange-700">Chua co giao an</p>
                  )}
                </div>
                {role === "teacher" || role === "admin" ? (
                  <label className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 text-sm font-black text-white shadow-lg shadow-orange-500/20 transition hover:-translate-y-0.5">
                    <FileUp size={17} />
                    Upload
                    <input
                      type="file"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        uploadLessonPlan(schedule, file?.name ?? "");
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
      <Panel title="Diem danh tung tiet" action="Luu thoi gian bam">
        <div className="space-y-3">
          {scopedSchedules.map((schedule) => {
            const meta = lookupSchedule(schedule);
            return (
              <div
                key={schedule.id}
                className="grid gap-4 rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm lg:grid-cols-[1fr_auto]"
              >
                <div>
                  <p className="text-sm font-black">
                    {meta.slot?.label} - {meta.lesson?.title}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {meta.teacher?.name} tai {meta.school?.name}, lop {meta.classRoom?.name}
                  </p>
                  {meta.checkIn ? (
                    <p className="mt-2 text-sm font-bold text-emerald-700">
                      Da diem danh luc {formatDateTime(meta.checkIn.checkedInAt)}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm font-bold text-orange-700">Chua diem danh</p>
                  )}
                </div>
                <button
                  onClick={() => checkIn(schedule)}
                  disabled={Boolean(meta.checkIn) || schedule.status === "cancelled"}
                  className={primaryButtonClass}
                >
                  <CheckCircle2 size={18} />
                  Diem danh
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
        <Panel title="Kenh trao doi" action="Theo GV va tung tiet">
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
                <p className="text-sm font-black">{thread.title}</p>
                <p className="mt-1 text-xs font-bold uppercase text-[var(--muted)]">
                  {thread.type === "teacher" ? "Theo giao vien" : "Theo tiet day"}
                </p>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title={selectedThread?.title ?? "Chat"} action="Polling ready">
          <div className="flex min-h-[510px] flex-col">
            <div className="app-scrollbar flex-1 space-y-3 overflow-y-auto pr-2">
              {selectedMessages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[82%] rounded-2xl p-3 ${
                    message.senderRole === role
                      ? "ml-auto bg-[var(--brand)] text-white"
                      : "bg-slate-100 text-slate-800"
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
                placeholder="Nhap tin nhan..."
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
      <Panel title="Cau hinh Google Workspace" action="San sang noi API">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <School2 className="text-[var(--brand)]" />
              <h3 className="text-base font-black">Google Sheets la database chinh</h3>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Tao spreadsheet voi cac tab dung ten ben duoi, cap quyen cho service account, sau do dien
              GOOGLE_SHEETS_SPREADSHEET_ID vao .env.
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
              <h3 className="text-base font-black">Email va Google Drive</h3>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Email thong bao se dung Resend hoac Gmail API. Giao an upload se day vao Drive folder theo cau
              truc nam hoc / truong / khoi / lop / giao vien.
            </p>
            <div className="mt-4 rounded-2xl bg-orange-50 p-4 text-sm font-bold text-orange-800">
              Ban demo hien dang gia lap upload Drive va gui email de co the kiem tra UI truoc khi gan credential.
            </div>
          </div>
        </div>
      </Panel>
    );
  }

  function ScheduleList({ items, compact = false }: { items: Schedule[]; compact?: boolean }) {
    if (items.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-cyan-200 bg-cyan-50 p-8 text-center">
          <p className="font-black text-[var(--brand-dark)]">Chua co lich phu hop</p>
          <p className="mt-2 text-sm text-[var(--muted)]">Hay tao lich moi hoac doi bo loc tim kiem.</p>
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
                  <p className="text-sm font-black">{formatDate(schedule.date)}</p>
                  <p className="mt-1 text-xs font-bold text-[var(--muted)]">
                    {meta.slot?.label} {meta.slot?.start}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">{meta.lesson?.title}</p>
                  <p className="mt-1 truncate text-sm text-[var(--muted)]">
                    {meta.school?.name} - Lop {meta.classRoom?.name} - {meta.lesson?.objective}
                  </p>
                </div>
                <TeacherHover teacher={meta.teacher} />
                <div className="flex items-center justify-end gap-2">
                  <StatusChip status={schedule.status} />
                  {!compact && role === "admin" ? (
                    <div className="flex gap-1">
                      <button
                        title="Chuyen lich"
                        onClick={() => reassignSchedule(schedule)}
                        className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-50 text-[var(--brand-dark)] transition hover:bg-cyan-100"
                      >
                        <RefreshCcw size={16} />
                      </button>
                      <button
                        title="Huy lich"
                        onClick={() => cancelSchedule(schedule)}
                        className="grid h-9 w-9 place-items-center rounded-xl bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ) : null}
                  {!compact && role === "teacher" && schedule.status === "sent" ? (
                    <button
                      onClick={() => confirmSchedule(schedule.id)}
                      className="rounded-xl bg-[var(--brand)] px-3 py-2 text-xs font-black text-white"
                    >
                      Xac nhan
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
        <h2 className="text-lg font-black tracking-tight">{title}</h2>
        {action ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{action}</span>
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
      <p className="mt-5 text-3xl font-black tracking-tight">{value}</p>
      <p className="mt-1 text-sm font-bold text-[var(--muted)]">{label}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black uppercase text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

function TeacherCard({ teacher }: { teacher: Teacher }) {
  return (
    <div className="group relative rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-lg">
      <div className="flex items-center gap-3">
        <img alt={teacher.name} src={teacher.avatarUrl} className="h-12 w-12 rounded-2xl object-cover" />
        <div className="min-w-0">
          <p className="truncate text-sm font-black">{teacher.name}</p>
          <p className="truncate text-xs font-bold text-[var(--muted)]">{teacher.specialty}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
        <span className="rounded-full bg-cyan-50 px-3 py-1 text-[var(--brand-dark)]">{teacher.email}</span>
        <span className="rounded-full bg-orange-50 px-3 py-1 text-orange-700">{teacher.phone}</span>
      </div>
    </div>
  );
}

function TeacherHover({ teacher }: { teacher?: Teacher }) {
  if (!teacher) {
    return <span className="text-sm font-bold text-[var(--muted)]">Chua ro</span>;
  }

  return (
    <div className="group relative">
      <div className="flex items-center gap-3">
        <img alt={teacher.name} src={teacher.avatarUrl} className="h-10 w-10 rounded-full object-cover" />
        <div className="min-w-0">
          <p className="truncate text-sm font-black">{teacher.name}</p>
          <p className="truncate text-xs text-[var(--muted)]">{teacher.phone}</p>
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-full left-0 z-30 mb-3 hidden w-64 rounded-2xl border border-cyan-100 bg-white p-4 shadow-2xl group-hover:block">
        <div className="flex items-center gap-3">
          <img alt={teacher.name} src={teacher.avatarUrl} className="h-14 w-14 rounded-2xl object-cover" />
          <div>
            <p className="font-black">{teacher.name}</p>
            <p className="text-xs font-bold text-[var(--brand)]">{teacher.specialty}</p>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-sm font-bold text-slate-700">
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

const inputClass =
  "w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-cyan-100";

const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] px-4 py-3 text-sm font-black text-white shadow-lg shadow-cyan-700/20 transition hover:-translate-y-0.5 hover:bg-[var(--brand-dark)]";

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
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
