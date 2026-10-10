import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { appNeedDiffersFromEffective } from "@/lib/school-intake-bidirectional";
import { sendScheduleCancellationEmail } from "@/lib/email";
import { appendSheetRows, ensureSheetHeaders, readSheetRowsBatch, schoolTeachingNeedHeaders, updateSheetRowsById } from "@/lib/google-sheets";
import { buildSchoolNeedTemplateCatalog } from "@/lib/school-need-template";
import { appendIntakeRows, intakeFingerprint, intakeInputFirstDataRow, intakeInputLastRow, intakeSettingsOwner, parseIntakeBatch, parseIntakeSourceRow, readIntakeSettings, readIntakeTab, readIntakeWeekLocks, setIntakeWeekLock, snapshotSourceRow, weekStartOf, writeIntakeRanges, type IntakeSettings, type IntakeSourceRow } from "@/lib/school-intake-storage";
import { normalizeSchoolNeedInput, planSchoolNeedImport, schoolNeedIdentity, schoolNeedRequiresReview, schoolNeedRevision, type NormalizedNeedInput } from "@/lib/school-teaching-needs";
import { isDoubleTeachingTimeSlot, isTimeSlotAllowedForSchool } from "@/lib/time-slots";
import type { Attendance, ClassRoom, LessonPlan, Schedule, School, SchoolTeachingNeed, TeachingWorkLog, TimeSlot } from "@/lib/types";

type IntakeRow = IntakeSourceRow;

type IntakeBody = {
  mode?: "preview" | "submit" | "apply" | "reject" | "mailSent" | "lockWeek" | "unlockWeek";
  school?: string;
  weekStart?: string;
  batchId?: string;
  note?: string;
};

async function selectedRows(school: string, weekStart: string, options: { eligibleOnly?: boolean; rowIds?: Set<string> } = {}) {
  const raw = await readIntakeTab("Nhập lịch", "T", intakeInputLastRow);
  const rows = raw.slice(intakeInputFirstDataRow - 1).map((values, index) => parseIntakeSourceRow(values, index + intakeInputFirstDataRow))
    .filter((row) => {
      const values = raw[row.number - 1] || [];
      if (options.rowIds) return options.rowIds.has(row.rowId);
      if ((weekStart && weekStartOf(row.date || "") !== weekStart) || (school !== "Tất cả" && row.school !== school)) return false;
      return !options.eligibleOnly || !["Chờ duyệt vòng 2", "Chờ Nguyễn Phương duyệt", "Đã đồng bộ", "Đã xóa trong app"].includes(values[16] || "");
    });
  const missingIds = rows.filter((row) => !row.rowId);
  if (missingIds.length) {
    const updates = missingIds.map((row) => {
      row.rowId = createId("intake");
      return { range: `'Nhập lịch'!A${row.number}`, values: [[row.rowId]] };
    });
    await writeIntakeRanges(updates);
  }
  return rows;
}

async function loadBatch(batchId: string) {
  const batches = await readIntakeTab("Đợt duyệt", "R", 1000);
  return batches.slice(1).map((row, index) => parseIntakeBatch(row, index + 2)).find((batch) => batch.id === batchId);
}

async function snapshotRows(batchId: string) {
  const history = await readIntakeTab("Lịch sử", "R", 3000);
  return history.slice(1).filter((row) => row[0] === batchId).map(snapshotSourceRow);
}

async function actorFromGoogleToken(request: Request, settings: IntakeSettings) {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") || "");
  if (!match) return null;
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${match[1]}` },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  const profile = await response.json() as { email?: string; email_verified?: boolean };
  const email = String(profile.email || "").trim().toLowerCase();
  if (!profile.email_verified || ![settings.submitter, settings.reviewer, intakeSettingsOwner].includes(email)) return null;
  return { id: `school-intake:${email}`, email };
}

async function loadContext() {
  await ensureSheetHeaders("SchoolTeachingNeeds", schoolTeachingNeedHeaders);
  const rows = await readSheetRowsBatch(["SchoolTeachingNeeds", "Schools", "Classes", "TimeSlots", "Schedules", "Attendance", "TeachingWorkLogs", "LessonPlans", "AuditLogs"] as const);
  return {
    needs: rows.SchoolTeachingNeeds as unknown as SchoolTeachingNeed[],
    schools: rows.Schools as unknown as School[],
    classes: rows.Classes as unknown as ClassRoom[],
    slots: rows.TimeSlots as unknown as TimeSlot[],
    schedules: rows.Schedules as unknown as Schedule[],
    attendance: rows.Attendance as unknown as Attendance[],
    workLogs: rows.TeachingWorkLogs as unknown as TeachingWorkLog[],
    lessonPlans: rows.LessonPlans as unknown as LessonPlan[],
    auditLogs: rows.AuditLogs,
  };
}

export async function GET(request: Request) {
  const requestId = createRequestId("school-intake-catalog");
  try {
    const settings = await readIntakeSettings();
    const actor = await actorFromGoogleToken(request, settings);
    if (!actor) return apiFailure(401, "Tài khoản Google chưa được phép dùng bảng nhập lịch.", undefined, requestId);
    const catalogRows = await readSheetRowsBatch(["Schools", "Classes", "TimeSlots"] as const);
    const schools = catalogRows.Schools as unknown as School[];
    const classes = catalogRows.Classes as unknown as ClassRoom[];
    const slots = catalogRows.TimeSlots as unknown as TimeSlot[];
    const catalog = buildSchoolNeedTemplateCatalog(schools, classes, slots, isTimeSlotAllowedForSchool, isDoubleTeachingTimeSlot, { includeDouble: true });
    return NextResponse.json({
      schools: schools.filter((row) => row.id && row.name).map((row) => ({ id: row.id, name: row.name })),
      classes: classes.filter((row) => row.id && row.schoolId && row.name && row.grade).map((row) => ({ id: row.id, schoolId: row.schoolId, name: row.name, grade: row.grade })),
      periods: catalog.periods,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error, requestId); }
}

export async function POST(request: Request) {
  const requestId = createRequestId("school-intake-sync");
  try {
    const settings = await readIntakeSettings();
    const actor = await actorFromGoogleToken(request, settings);
    if (!actor) return apiFailure(401, "Tài khoản Google chưa được phép dùng bảng nhập lịch.", undefined, requestId);
    const body = await request.json() as IntakeBody;
    if (!body.mode || !["preview", "submit", "apply", "reject", "mailSent", "lockWeek", "unlockWeek"].includes(body.mode)) return apiFailure(400, "Thao tác không hợp lệ.", undefined, requestId);
    if (["apply", "reject", "mailSent", "lockWeek", "unlockWeek"].includes(body.mode) && actor.email !== settings.reviewer) return apiFailure(403, "Chỉ email được chỉ định cho vòng 2 mới có thể duyệt hoặc khóa tuần.", undefined, requestId);
    if (body.mode === "submit" && actor.email !== settings.submitter) return apiFailure(403, "Chỉ email được chỉ định cho vòng 1 mới có thể gửi lịch.", undefined, requestId);
    if (["apply", "reject", "mailSent"].includes(body.mode) && !/^[a-zA-Z0-9_-]{12,100}$/.test(body.batchId || "")) return apiFailure(400, "Mã đợt xác nhận không hợp lệ.", undefined, requestId);

    const weekLocks = await readIntakeWeekLocks();
    if (body.mode === "lockWeek" || body.mode === "unlockWeek") {
      const week = String(body.weekStart || "").trim();
      if (!week || weekStartOf(week) !== week) return apiFailure(400, "Hãy chọn đúng ngày thứ Hai của tuần.", undefined, requestId);
      const current = weekLocks.get(week)?.locked || false;
      if ((body.mode === "lockWeek") === current) return apiFailure(409, current ? "Tuần này đã khóa." : "Tuần này chưa khóa.", undefined, requestId);
      if (body.mode === "lockWeek") {
        const weekEnd = new Date(`${week}T00:00:00+07:00`).getTime() + 7 * 24 * 60 * 60 * 1000;
        if (Date.now() < weekEnd) return apiFailure(400, "Chỉ khóa sau khi tuần dạy đã kết thúc.", undefined, requestId);
        const batches = (await readIntakeTab("Đợt duyệt", "R", 1000)).slice(1).map((row, index) => parseIntakeBatch(row, index + 2));
        if (batches.some((item) => item.weekStart === week && item.status === "WAITING_REVIEW")) return apiFailure(409, "Tuần này còn lịch chờ duyệt vòng 2.", undefined, requestId);
      }
      await setIntakeWeekLock(week, body.mode === "lockWeek", actor.email);
      await appendAuditLog({ requestId, actor, action: body.mode === "lockWeek" ? "school_intake.lock_week" : "school_intake.unlock_week", entityType: "SchoolIntakeWeek", entityId: week, route: "/api/school-intake", method: "POST", authMode: "enforce", decision: "allow", source: "email-token" });
      return NextResponse.json({ status: body.mode === "lockWeek" ? "LOCKED" : "UNLOCKED", weekStart: week });
    }
    const batch = body.batchId && ["preview", "apply", "reject", "mailSent"].includes(body.mode) ? await loadBatch(body.batchId) : undefined;
    if (body.mode === "mailSent") {
      if (!batch || batch.status !== "SYNCED") return apiFailure(409, "Đợt lịch chưa đồng bộ nên chưa thể đánh dấu đã báo Sunny.", undefined, requestId);
      if (!batch.raw[16]) await writeIntakeRanges([{ range: `'Đợt duyệt'!Q${batch.number}`, values: [[new Date().toISOString()]] }]);
      return NextResponse.json({ batchId: batch.id, status: "NOTIFIED" });
    }
    if (["apply", "reject"].includes(body.mode) && (!batch || batch.status !== "WAITING_REVIEW" || !batch.submittedBy)) return apiFailure(409, "Đợt lịch không còn chờ duyệt vòng 2.", undefined, requestId);
    if (body.mode === "reject") {
      const note = String(body.note || "").trim().slice(0, 500);
      if (!note) return apiFailure(400, "Cần ghi lý do trả lại người nhập lịch.", undefined, requestId);
      const next = [...batch!.raw]; next[4] = "RETURNED"; next[12] = actor.email; next[13] = new Date().toISOString(); next[14] = note;
      await writeIntakeRanges([{ range: `'Đợt duyệt'!A${batch!.number}:R${batch!.number}`, values: [next] }]);
      const input = await readIntakeTab("Nhập lịch", "T", intakeInputLastRow);
      const numbers = new Map(input.slice(intakeInputFirstDataRow - 1).map((row, index) => [row[0], index + intakeInputFirstDataRow]));
      const rowUpdates = (await snapshotRows(batch!.id)).flatMap((row) => {
        const number = numbers.get(row.rowId);
        return number ? [{ range: `'Nhập lịch'!Q${number}`, values: [[`Trả lại: ${note}`]] }] : [];
      });
      await writeIntakeRanges(rowUpdates);
      return NextResponse.json({ batchId: batch!.id, status: "RETURNED", note });
    }

    let rows: IntakeRow[];
    let school: string;
    let weekStart: string;
    if (body.mode === "apply" || (body.mode === "preview" && batch)) {
      school = batch!.school;
      weekStart = batch!.weekStart;
      rows = await snapshotRows(batch!.id);
      if (rows.length !== batch!.count || intakeFingerprint(rows) !== batch!.fingerprint) return apiFailure(409, "Bản lưu chờ duyệt đã thay đổi. Không thể xác nhận.", undefined, requestId);
      const current = await selectedRows(school, weekStart, { rowIds: new Set(rows.map((row) => row.rowId)) });
      if (intakeFingerprint(current) !== batch!.fingerprint) return apiFailure(409, "Dữ liệu đã được sửa sau vòng 1. Người nhập lịch cần gửi lại để duyệt.", undefined, requestId);
    } else {
      school = String(body.school || "").trim();
      weekStart = String(body.weekStart || "").trim();
      if (!school || (weekStart && (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || weekStartOf(weekStart) !== weekStart))) return apiFailure(400, "Hãy chọn trường; tuần chỉ dùng để lọc khi kiểm tra.", undefined, requestId);
      rows = await selectedRows(school, weekStart, { eligibleOnly: true });
    }
    const lockedRowWeeks = [...new Set(rows.map((row) => weekStartOf(row.date || "")).filter((week) => week && weekLocks.get(week)?.locked))];
    if (lockedRowWeeks.length && body.mode !== "preview") return apiFailure(423, `Có ${lockedRowWeeks.length} tuần đã khóa trong phạm vi gửi. Người duyệt vòng 2 cần mở khóa trước khi sửa hoặc duyệt lịch.`, undefined, requestId);
    if (rows.length < 1 || rows.length > 2000) return apiFailure(400, "Phạm vi gửi cần từ 1 đến 2.000 tiết hợp lệ.", undefined, requestId);
    if (body.mode === "submit") {
      const pending = (await readIntakeTab("Đợt duyệt", "R", 1000)).slice(1).map((row, index) => parseIntakeBatch(row, index + 2))
        .filter((item) => item.status === "WAITING_REVIEW");
      const rowIds = new Set(rows.map((row) => row.rowId));
      const pendingIds = new Set(pending.map((item) => item.id));
      const history = await readIntakeTab("Lịch sử", "R", 3000);
      const overlap = history.slice(1).some((row) => pendingIds.has(row[0]) && rowIds.has(row[1]));
      if (overlap) return apiFailure(409, "Có dòng trong phạm vi này đang chờ duyệt vòng 2. Hãy xử lý đợt đó trước khi gửi lại.", undefined, requestId);
    }

    const context = await loadContext();
    const revision = schoolNeedRevision(context.needs);
    const alreadyApplied = Boolean(body.mode === "apply" && context.auditLogs.some((row) => row.action === "school_intake.apply" && row.entityId === batch!.id));
    if ((body.mode === "apply" || body.mode === "preview" && batch) && batch!.revision !== revision && !alreadyApplied) return apiFailure(409, "Lịch trong app đã thay đổi từ sau vòng 1. Người nhập lịch cần gửi lại bản kiểm tra.", undefined, requestId);

    const effectiveRows = await readIntakeTab("Lịch hiệu lực", "O", 1000);
    const effectiveByRowId = new Map(effectiveRows.slice(1).filter((row) => row[0]).map((row) => [row[0], row]));
    const appById = new Map(context.needs.map((need) => [need.id, need]));
    const outOfSync = rows.flatMap((source, index) => {
      if (!source.id) return [];
      const effective = effectiveByRowId.get(source.rowId);
      const current = appById.get(source.id);
      if (!effective || effective[12] !== source.id || !current || appNeedDiffersFromEffective(current, effective, context.schools, context.classes)) {
        return [{ rowId: source.rowId, index: (source as IntakeRow & { number?: number }).number || index + intakeInputFirstDataRow,
          message: "Lịch trong app và bản đã duyệt trên Sheet khác nhau. Cần đối chiếu trước khi gửi lại; hệ thống chưa ghi đè." }];
      }
      return [];
    });
    if (outOfSync.length && !alreadyApplied) {
      if (body.mode !== "apply" && !batch) await writeIntakeRanges(outOfSync.filter((item) => item.index >= intakeInputFirstDataRow).map((item) => ({ range: `'Nhập lịch'!P${item.index}`, values: [[item.message]] })));
      return NextResponse.json({ error: "Có lịch đã thay đổi trong app. Vui lòng đối chiếu trước khi gửi duyệt.", errors: outOfSync }, { status: 409 });
    }

    const catalog = buildSchoolNeedTemplateCatalog(context.schools, context.classes, context.slots, isTimeSlotAllowedForSchool, isDoubleTeachingTimeSlot, { includeDouble: true });
    const normalized: Array<{ source: IntakeRow; row: NormalizedNeedInput }> = [];
    const cancelled: Array<{ source: IntakeRow; target?: SchoolTeachingNeed }> = [];
    const errors: Array<{ rowId: string; index: number; message: string }> = [];
    const seenIds = new Set<string>();
    for (const [index, source] of rows.entries()) {
      try {
        if (!source || typeof source !== "object" || !source.rowId || seenIds.has(source.rowId)) throw new Error("Mã dòng thiếu hoặc bị trùng.");
        seenIds.add(source.rowId);
        if (source.intakeStatus !== "Dạy" && source.intakeStatus !== "Trường hủy tiết") throw new Error("Tình trạng phải là Dạy hoặc Trường hủy tiết.");
        const row = normalizeSchoolNeedInput(source, context.schools, context.classes);
        const period = catalog.periods.find((item) => item.school === context.schools.find((school) => school.id === row.schoolId)?.name && item.session === source.session && item.label === row.periodLabel && item.start === row.start && item.end === row.end);
        if (!period) throw new Error("Tiết hoặc khung giờ không khớp cấu hình hiện tại của trường.");
        if (source.intakeStatus === "Trường hủy tiết") {
          const target = row.id ? context.needs.find((item) => item.id === row.id) : context.needs.find((item) => schoolNeedIdentity(item) === schoolNeedIdentity(row));
          if (row.id && !target) throw new Error("Không tìm thấy tiết cũ để hủy.");
          if (target && schoolNeedIdentity(target) !== schoolNeedIdentity(row)) throw new Error("Dòng hủy đã đổi ngày, lớp hoặc giờ. Hãy giữ thông tin tiết cũ khi chọn hủy.");
          if (target?.scheduleId) {
            const assigned = context.schedules.find((item) => item.id === target.scheduleId && item.status !== "cancelled");
            if (assigned?.mergedPeriodGroupId) throw new Error("Tiết đã gộp và giao giáo viên; cần xử lý lịch gộp trong app trước khi hủy.");
            if (assigned && (context.attendance.some((item) => item.scheduleId === assigned.id) || context.workLogs.some((item) => item.scheduleId === assigned.id) || context.lessonPlans.some((item) => item.scheduleId === assigned.id))) throw new Error("Tiết đã có điểm danh, công hoặc giáo án; cần xử lý trong app trước khi hủy.");
            if (assigned) {
              const slot = context.slots.find((item) => item.id === assigned.timeSlotId);
              if (!slot || new Date(`${assigned.date}T${slot.start}:00+07:00`).getTime() <= Date.now()) throw new Error("Tiết đã bắt đầu hoặc qua giờ; không tự hủy lịch đã giao.");
            }
          }
          cancelled.push({ source, target });
        } else {
          normalized.push({ source, row });
        }
      } catch (error) {
        errors.push({ rowId: String(source?.rowId || ""), index: (source as IntakeRow & { number?: number })?.number || index + intakeInputFirstDataRow, message: error instanceof Error ? error.message : "Dòng không hợp lệ." });
      }
    }
    if (errors.length) {
      if (body.mode !== "apply" && !batch) await writeIntakeRanges(errors.filter((item) => item.index >= intakeInputFirstDataRow).map((item) => ({ range: `'Nhập lịch'!P${item.index}:Q${item.index}`, values: [[item.message, "Có lỗi · chưa gửi"]] })));
      return NextResponse.json({ error: "Có dòng cần sửa trước khi gửi duyệt.", errors }, { status: 422 });
    }

    let plan: ReturnType<typeof planSchoolNeedImport>;
    try { plan = planSchoolNeedImport(normalized.map((item) => item.row), context.needs); }
    catch (error) {
      const message = error instanceof Error ? error.message : "Lịch bị trùng hoặc sai mã dòng.";
      const index = Number(/Dòng\s+(\d+)/.exec(message)?.[1] || 0) - 2;
      const source = normalized[index]?.source as IntakeRow & { number?: number } | undefined;
      if (body.mode !== "apply" && !batch && source?.number) await writeIntakeRanges([{ range: `'Nhập lịch'!P${source.number}:Q${source.number}`, values: [[message, "Có lỗi · chưa gửi"]] }]);
      return apiFailure(400, message, undefined, requestId);
    }
    const reactivated = new Set(plan.filter((item) => item.action === "SAME" && item.target?.status === "CANCELLED").map((item) => item.target!.id));
    const summary = {
      schoolCount: new Set(rows.map((row) => row.school).filter(Boolean)).size,
      schools: [...new Set(rows.map((row) => row.school).filter(Boolean))].sort(),
      rowCount: rows.length,
      newCount: plan.filter((item) => item.action === "NEW").length,
      changedCount: plan.filter((item) => item.action === "CHANGED").length + reactivated.size,
      duplicateCount: plan.filter((item) => item.action === "SAME" && !reactivated.has(item.target?.id || "")).length,
      cancelledCount: cancelled.length,
      reviewCount: plan.filter((item) => item.action === "CHANGED" && item.target && schoolNeedRequiresReview(item.target, item.row)).length,
    };
    const changes = [
      ...plan.map((item, index) => ({ rowId: normalized[index].source.rowId, action: reactivated.has(item.target?.id || "") ? "CHANGED" as const : item.action, before: item.target || null, after: item.row,
        description: `${normalized[index].source.date} · ${normalized[index].source.school} · ${normalized[index].source.className} · ${normalized[index].source.start}–${normalized[index].source.end}`,
        previous: item.target ? `${item.target.date} · ${context.classes.find((row) => row.id === item.target!.classId)?.name || item.target.classId} · ${item.target.start}–${item.target.end}` : "",
      })),
      ...cancelled.map((item) => ({ rowId: item.source.rowId, action: "CANCELLED" as const, before: item.target || null, after: null,
        description: `${item.source.date} · ${item.source.school} · ${item.source.className} · ${item.source.start}–${item.source.end}`,
        previous: item.target ? `${item.target.date} · ${context.classes.find((row) => row.id === item.target!.classId)?.name || item.target.classId} · ${item.target.start}–${item.target.end}` : "",
      })),
    ];
    if (body.mode === "preview") return NextResponse.json({ revision, summary, changes, fingerprint: intakeFingerprint(rows), batchId: batch?.id || "" });

    if (body.mode === "submit") {
      const now = new Date().toISOString();
      const batchId = createId("batch");
      const fingerprint = intakeFingerprint(rows);
      const changeByRow = new Map(changes.map((change) => [change.rowId, change]));
      const batchValues = [batchId, school === "Tất cả" ? `${summary.schoolCount} trường` : school, weekStart, fingerprint, "WAITING_REVIEW", String(rows.length), String(summary.newCount), String(summary.changedCount), String(summary.duplicateCount), String(summary.cancelledCount), actor.email, now, "", "", "", "", "", revision];
      const snapshots = rows.map((row) => {
        const change = changeByRow.get(row.rowId);
        return [batchId, row.rowId, row.date || "", row.school || "", row.grade || "", row.className || "", row.session || "", row.periodLabel || "", row.start || "", row.end || "", row.environment || "", row.intakeStatus, row.sourceNote || "", row.id || "", change?.action || "", now, actor.email, change?.before ? JSON.stringify(change.before) : ""];
      });
      await appendIntakeRows("Lịch sử", "R", snapshots);
      await appendIntakeRows("Đợt duyệt", "R", [batchValues]);
      const inputUpdates = (rows as Array<IntakeRow & { number?: number }>).flatMap((row) => row.number ? [
        { range: `'Nhập lịch'!O${row.number}:Q${row.number}`, values: [[changeByRow.get(row.rowId)?.action || "", "", "Chờ duyệt vòng 2"]] },
        { range: `'Nhập lịch'!T${row.number}`, values: [[batchId]] },
      ] : []);
      await writeIntakeRanges(inputUpdates);
      await appendAuditLog({ requestId, actor, action: "school_intake.submit", entityType: "SchoolIntakeBatch", entityId: batchId, route: "/api/school-intake", method: "POST", authMode: "enforce", decision: "allow", source: "email-token", after: { school, weekStart, fingerprint, summary } });
      return NextResponse.json({ batchId, status: "WAITING_REVIEW", revision, summary, changes });
    }

    const now = new Date().toISOString();
    const newRows: SchoolTeachingNeed[] = plan.filter((item) => item.action === "NEW").map((item) => ({
      ...item.row, id: createId("need"), scheduleId: "", status: "OPEN", createdAt: now, updatedAt: now,
    }));
    const updates = plan.filter((item) => (item.action === "CHANGED" || reactivated.has(item.target?.id || "")) && item.target).map((item) => ({
      id: item.target!.id,
      patch: { ...item.row, id: item.target!.id, status: schoolNeedRequiresReview(item.target!, item.row) ? "REVIEW" : item.target!.scheduleId ? "ASSIGNED" : "OPEN", updatedAt: now, lastEditedAt: now, lastEditedBy: `${actor.email} (Google Sheet)` },
    }));
    const cancellationUpdates = cancelled.filter((item) => item.target).map((item) => ({ id: item.target!.id, patch: { status: "CANCELLED" as const, updatedAt: now, lastEditedAt: now, lastEditedBy: `${actor.email} (Google Sheet)` } }));
    const scheduleCancellations = cancelled.flatMap((item) => {
      const schedule = context.schedules.find((row) => row.id === item.target?.scheduleId && row.status !== "cancelled");
      return schedule ? [{ id: schedule.id, patch: { status: "cancelled" as const, cancelledAt: now, updatedAt: now } }] : [];
    });
    if (!alreadyApplied) {
      if (newRows.length) await appendSheetRows("SchoolTeachingNeeds", newRows);
      if (updates.length || cancellationUpdates.length) await updateSheetRowsById("SchoolTeachingNeeds", [...updates, ...cancellationUpdates]);
      if (scheduleCancellations.length) await updateSheetRowsById("Schedules", scheduleCancellations);
    }

    const newByIdentity = new Map(newRows.map((row) => [schoolNeedIdentity(row), row]));
    const mappings = rows.map((source) => {
      const activeIndex = normalized.findIndex((item) => item.source.rowId === source.rowId);
      if (activeIndex >= 0) {
        const item = plan[activeIndex];
        return { rowId: source.rowId, appNeedId: item.target?.id || newByIdentity.get(schoolNeedIdentity(item.row))?.id || "", action: reactivated.has(item.target?.id || "") ? "CHANGED" : item.action };
      }
      const item = cancelled.find((row) => row.source.rowId === source.rowId);
      return { rowId: source.rowId, appNeedId: item?.target?.id || "", action: "CANCELLED" };
    });
    if (!alreadyApplied) await appendAuditLog({ requestId, actor, action: "school_intake.apply", entityType: "SchoolIntakeBatch", entityId: body.batchId!, route: "/api/school-intake", method: "POST", authMode: "enforce", decision: "allow", source: "email-token", after: { summary, mappings } });

    const cancellationEmails = await Promise.all((alreadyApplied ? [] : scheduleCancellations).map(async ({ id }) => {
      const schedule = context.schedules.find((item) => item.id === id)!;
      const teacher = (await readSheetRowsBatch(["Teachers"] as const)).Teachers.find((item) => item.id === schedule.teacherId);
      const slot = context.slots.find((item) => item.id === schedule.timeSlotId);
      if (!slot) return { sent: false, reason: "Không tìm thấy khung giờ của lịch đã hủy." };
      try {
        return await sendScheduleCancellationEmail({ teacher: { name: teacher?.name, email: teacher?.email }, schedules: [schedule], schoolName: context.schools.find((item) => item.id === schedule.schoolId)?.name || "", classNames: [context.classes.find((item) => item.id === schedule.classId)?.name || schedule.classId], slot });
      } catch (error) { return { sent: false, reason: error instanceof Error ? error.message : "Không gửi được email hủy lịch." }; }
    }));
    const mappingByRow = new Map(mappings.map((item) => [item.rowId, item]));
    if (alreadyApplied) {
      summary.newCount = Number(batch!.raw[6] || 0);
      summary.changedCount = Number(batch!.raw[7] || 0);
      summary.duplicateCount = Number(batch!.raw[8] || 0);
      summary.cancelledCount = Number(batch!.raw[9] || 0);
    }
    const effective = await readIntakeTab("Lịch hiệu lực", "O", 1000);
    const effectiveByRow = new Map(effective.slice(1).map((values, index) => [values[0], index + 2]));
    const effectiveUpdates: Array<{ range: string; values: string[][] }> = [];
    const effectiveAppends: string[][] = [];
    for (const row of rows) {
      const value = [row.rowId, row.date || "", row.school || "", row.grade || "", row.className || "", row.session || "", row.periodLabel || "", row.start || "", row.end || "", row.environment || "", row.intakeStatus, row.sourceNote || "", mappingByRow.get(row.rowId)?.appNeedId || "", batch!.id, now];
      const existingNumber = effectiveByRow.get(row.rowId);
      if (existingNumber) effectiveUpdates.push({ range: `'Lịch hiệu lực'!A${existingNumber}:O${existingNumber}`, values: [value] });
      else effectiveAppends.push(value);
    }
    await writeIntakeRanges(effectiveUpdates);
    await appendIntakeRows("Lịch hiệu lực", "O", effectiveAppends);
    const input = await readIntakeTab("Nhập lịch", "T", intakeInputLastRow);
    const inputNumberById = new Map(input.slice(intakeInputFirstDataRow - 1).map((values, index) => [values[0], index + intakeInputFirstDataRow]));
    const rowUpdates = rows.flatMap((row) => {
      const number = inputNumberById.get(row.rowId);
      if (!number) return [];
      return [
        { range: `'Nhập lịch'!Q${number}:R${number}`, values: [["Đã đồng bộ", mappingByRow.get(row.rowId)?.appNeedId || ""]] },
        { range: `'Nhập lịch'!T${number}`, values: [[batch!.id]] },
      ];
    });
    const updatedBatch = [...batch!.raw];
    updatedBatch[4] = "SYNCED";
    updatedBatch[12] = actor.email;
    updatedBatch[13] = now;
    updatedBatch[15] = now;
    await writeIntakeRanges([...rowUpdates, { range: `'Đợt duyệt'!A${batch!.number}:R${batch!.number}`, values: [updatedBatch] }]);
    return NextResponse.json({ batchId: batch!.id, status: "SYNCED", revision, summary, mappings, cancellationEmails });
  } catch (error) { return apiError(error, requestId); }
}
