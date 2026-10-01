import { NextResponse } from "next/server";
import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { sendScheduleCancellationEmail, sendScheduleDigestEmail } from "@/lib/email";
import { readSheetRowsBatch, updateSheetRowsById } from "@/lib/google-sheets";
import { requireSessionUser } from "@/lib/route-auth";
import { invalidateScheduleConflictIndex } from "@/lib/schedule-conflict-index";
import { findConfiguredSchoolNeedMergeSlot } from "@/lib/school-need-merge";
import { isTimeSlotAllowedForSchool } from "@/lib/time-slots";
import type { ClassRoom, Schedule, School, SchoolTeachingNeed, TimeSlot } from "@/lib/types";

/** Resolves a changed school row only after checking the already-sent assignment. */
export async function POST(request: Request) {
  const requestId = createRequestId("school-need-reconcile");
  try {
    const { user, source } = await requireSessionUser(request, { allowHeaderFallback: false });
    if (user.role !== "admin") return apiFailure(403, "Chỉ quản trị được xử lý lịch đã giao.", undefined, requestId);
    const { id } = await request.json() as { id?: string };
    const rows = await readSheetRowsBatch(["SchoolTeachingNeeds", "Schedules", "TimeSlots", "Schools", "Classes", "Teachers", "Lessons", "Attendance", "TeachingWorkLogs", "LessonPlans"] as const);
    const needs = rows.SchoolTeachingNeeds as unknown as SchoolTeachingNeed[];
    const schedules = rows.Schedules as unknown as Schedule[];
    const slots = rows.TimeSlots as unknown as TimeSlot[];
    const schools = rows.Schools as unknown as School[];
    const classes = rows.Classes as unknown as ClassRoom[];
    const target = needs.find((row) => row.id === id);
    if (!target || target.status !== "REVIEW" || !target.scheduleId) return apiFailure(409, "Dòng này không còn cần đối chiếu. Hãy tải lại lịch trường.", undefined, requestId);
    const assigned = schedules.find((row) => row.id === target.scheduleId);
    if (!assigned || assigned.status === "cancelled") return apiFailure(409, "Lịch cũ đã thay đổi. Hãy tải lại trước khi xử lý.", undefined, requestId);
    const group = assigned.mergedPeriodGroupId
      ? schedules.filter((row) => row.mergedPeriodGroupId === assigned.mergedPeriodGroupId && row.status !== "cancelled")
      : [assigned];
    const groupIds = new Set(group.map((row) => row.id));
    const groupNeeds = group.map((row) => needs.find((need) => need.scheduleId === row.id));
    if (groupNeeds.some((need) => !need) || group.length > 2) return apiFailure(409, "Không đủ dữ liệu của cụm tiết để xử lý an toàn.", undefined, requestId);
    const completeNeeds = groupNeeds as SchoolTeachingNeed[];
    const protectedRows = [...rows.Attendance, ...rows.TeachingWorkLogs, ...rows.LessonPlans].some((row) => groupIds.has(String(row.scheduleId || "")));
    if (protectedRows) return apiFailure(409, "Lịch đã có điểm danh, công hoặc giáo án. Cần xử lý hồ sơ liên quan trước khi đổi lịch.", undefined, requestId);
    const oldSlot = slots.find((slot) => slot.id === assigned.timeSlotId);
    if (!oldSlot) return apiFailure(409, "Khung giờ của lịch cũ không còn tồn tại.", undefined, requestId);
    const now = new Date();
    if (new Date(`${assigned.date}T${oldSlot.start}:00+07:00`).getTime() <= now.getTime()) {
      return apiFailure(409, "Tiết đã bắt đầu hoặc qua giờ; không tự thay lịch đã giao.", undefined, requestId);
    }

    const nextSchool = schools.find((school) => school.id === target.schoolId);
    const orderedNeeds = completeNeeds.slice().sort((a, b) => a.start.localeCompare(b.start));
    const validMerge = group.length === 2 && nextSchool
      ? findConfiguredSchoolNeedMergeSlot(orderedNeeds[0], orderedNeeds[1], slots, nextSchool.name)?.id === assigned.timeSlotId
      : false;
    const unchangedPeriodTimes = completeNeeds.every((need) =>
      (!need.assignedDate || need.date === need.assignedDate) &&
      (!need.assignedStart || need.start === need.assignedStart) &&
      (!need.assignedEnd || need.end === need.assignedEnd));
    const sameTime = unchangedPeriodTimes && (group.length === 1
      ? target.date === assigned.date && target.start === oldSlot.start && target.end === oldSlot.end
      : validMerge && orderedNeeds.every((need) => need.date === assigned.date));
    const sameSchool = completeNeeds.every((need) => need.schoolId === assigned.schoolId);
    const sameClass = completeNeeds.every((need) => need.classId === target.classId);
    const sameEnvironment = completeNeeds.every((need) => need.teachingEnvironment === target.teachingEnvironment) && target.teachingEnvironment === assigned.teachingEnvironment;
    const oldClass = classes.find((row) => row.id === assigned.classId);
    const newClass = classes.find((row) => row.id === target.classId);
    const gradeCompatible = target.teachingEnvironment !== "in_class" || (oldClass?.grade === newClass?.grade);
    const keepTeacher = Boolean(sameTime && sameSchool && sameClass && sameEnvironment && gradeCompatible && nextSchool && isTimeSlotAllowedForSchool(oldSlot, nextSchool.name));

    if (keepTeacher) {
      const conflicts = schedules.some((other) => {
        if (groupIds.has(other.id) || other.status === "cancelled" || other.date !== assigned.date) return false;
        const otherSlot = slots.find((slot) => slot.id === other.timeSlotId);
        if (!otherSlot || oldSlot.start >= otherSlot.end || otherSlot.start >= oldSlot.end) return false;
        return group.some((row) => other.teacherId === row.teacherId || (other.schoolId === target.schoolId && other.classId === target.classId));
      });
      if (conflicts) return apiFailure(409, "Lớp hoặc giáo viên bị trùng giờ sau khi sửa; cần điều chỉnh lịch trước.", undefined, requestId);
      await updateSheetRowsById("Schedules", group.map((row) => ({ id: row.id, patch: { classId: target.classId, participantClassIds: target.classId, teachingEnvironment: target.teachingEnvironment, updatedAt: now.toISOString() } })));
      await updateSheetRowsById("SchoolTeachingNeeds", completeNeeds.map((need) => ({ id: need.id, patch: { status: "ASSIGNED", updatedAt: now.toISOString() } })));
    } else {
      await updateSheetRowsById("Schedules", group.map((row) => ({ id: row.id, patch: { status: "cancelled", cancelledAt: now.toISOString(), updatedAt: now.toISOString() } })));
      await updateSheetRowsById("SchoolTeachingNeeds", completeNeeds.map((need) => ({ id: need.id, patch: { scheduleId: "", assignedDate: "", assignedStart: "", assignedEnd: "", status: "OPEN", updatedAt: now.toISOString() } })));
    }
    invalidateScheduleConflictIndex();
    const updateEmails = !keepTeacher ? [] : await Promise.all(Array.from(new Set(group.map((row) => row.teacherId))).map(async (teacherId) => {
      const teacher = rows.Teachers.find((row) => row.id === teacherId);
      const revised = group.filter((row) => row.teacherId === teacherId).map((row) => ({ ...row, classId: target.classId, participantClassIds: target.classId, teachingEnvironment: target.teachingEnvironment }));
      try {
        return { teacherId, ...await sendScheduleDigestEmail({ teacher: { name: teacher?.name, email: teacher?.email }, schedules: revised, rows: revised.map((schedule) => ({ schedule, school: nextSchool, classRoom: newClass, participantClassNames: [newClass?.name || target.classId], lesson: rows.Lessons.find((row) => row.id === schedule.lessonId), slot: oldSlot })) }) };
      } catch (error) { return { teacherId, sent: false, reason: error instanceof Error ? error.message : "Không gửi được email cập nhật lịch." }; }
    }));
    const cancellationEmails = keepTeacher ? [] : await Promise.all(Array.from(new Set(group.map((row) => row.teacherId))).map(async (teacherId) => {
      const teacher = rows.Teachers.find((row) => row.id === teacherId);
      try {
        return { teacherId, ...await sendScheduleCancellationEmail({ teacher: { name: teacher?.name, email: teacher?.email }, schedules: group.filter((row) => row.teacherId === teacherId), schoolName: schools.find((row) => row.id === assigned.schoolId)?.name || "", classNames: Array.from(new Set(group.map((row) => classes.find((item) => item.id === row.classId)?.name || row.classId))), slot: oldSlot }) };
      } catch (error) { return { teacherId, sent: false, reason: error instanceof Error ? error.message : "Không gửi được email thay đổi lịch." }; }
    }));
    await appendAuditLog({ requestId, actor: user, action: keepTeacher ? "school_need.reconcile_keep_teacher" : "school_need.reconcile_reassign", entityType: "SchoolTeachingNeed", entityId: target.id, route: "/api/school-teaching-needs/reconcile", method: "POST", authMode: "enforce", decision: "allow", reason: "admin", source, before: { schedules: group, needs: completeNeeds }, after: { keepTeacher, scheduleIds: group.map((row) => row.id) } });
    return NextResponse.json({ outcome: keepTeacher ? "KEPT" : "REASSIGN", scheduleIds: group.map((row) => row.id), needIds: completeNeeds.map((need) => need.id), cancellationEmails, updateEmails });
  } catch (error) { return apiError(error, requestId); }
}
