import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import {
  appendSheetRows,
  ensureSheetHeaders,
  readSheetRows,
  teacherAvailabilityHeaders,
  updateSheetRowById,
} from "@/lib/google-sheets";
import { evaluateRolePermission, requireSessionUser } from "@/lib/route-auth";
import { availabilityTimeRangeKey } from "@/lib/teacher-availability";
import type { TeacherAvailability, TeacherAvailabilityScope } from "@/lib/types";

const availabilityScopes: TeacherAvailabilityScope[] = ["all_day", "morning", "afternoon", "time_slots"];

type AvailabilityInput = {
  date: string;
  scope: TeacherAvailabilityScope;
  timeSlotIds: string[];
};

export async function GET(request: Request) {
  const requestId = createRequestId("teacher-availability-list");
  try {
    const auth = await requireSessionUser(request, { allowHeaderFallback: false });
    await ensureSheetHeaders("TeacherAvailability", teacherAvailabilityHeaders);
    const { searchParams } = new URL(request.url);
    const dateFrom = String(searchParams.get("dateFrom") || "").trim();
    const dateTo = String(searchParams.get("dateTo") || "").trim();
    const teacherId = String(auth.user.teacherId || "").trim();
    const rows = await readSheetRows("TeacherAvailability");

    const filtered = rows.filter((row) => {
      if (String(row.status || "available") !== "available") return false;
      if (auth.user.role !== "admin" && String(row.teacherId || "") !== teacherId) return false;
      if (dateFrom && String(row.date || "") < dateFrom) return false;
      if (dateTo && String(row.date || "") > dateTo) return false;
      return true;
    });
    return NextResponse.json(filtered);
  } catch (error) {
    return apiError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId("teacher-availability");
  try {
    const auth = await requireSessionUser(request, { allowHeaderFallback: false });
    const permission = evaluateRolePermission(auth.user, ["teacher", "assistant"], "teacher_only_availability_write");
    if (permission.decision === "would_block") {
      console.warn(`[auth-shadow][${requestId}] teacherAvailability.replace ${permission.reason}`);
    }
    if (!permission.allowed) {
      return apiFailure(403, "Chỉ giáo viên được đăng ký lịch trống.", undefined, requestId);
    }

    const teacherId = String(auth.user.teacherId || "").trim();
    if (!teacherId) {
      return apiFailure(400, "Tài khoản chưa được liên kết với hồ sơ giáo viên.", undefined, requestId);
    }

    const body = (await request.json()) as Record<string, unknown>;
    const rawEntries = Array.isArray(body.entries) ? body.entries : null;
    const rawScope = String(body.scope || "").trim();
    const isWithdraw = rawEntries === null && rawScope === "none";
    const parsedEntries = rawEntries?.map(parseAvailabilityInput) ?? null;
    if (parsedEntries?.some((entry) => entry === null)) {
      return apiFailure(400, "Có ngày hoặc lựa chọn thời gian không hợp lệ.", undefined, requestId);
    }
    const entries = parsedEntries
      ? (parsedEntries as AvailabilityInput[])
      : isWithdraw
        ? []
        : parseLegacyAvailabilityInputs(body);
    const dates = rawEntries === null ? parseDates(body.dates) : entries.map((entry) => entry.date);
    if (dates.length === 0 || dates.length > 62) {
      return apiFailure(400, "Hãy chọn từ 1 đến 62 ngày để đăng ký.", undefined, requestId);
    }
    if (new Set(dates).size !== dates.length) {
      return apiFailure(400, "Mỗi ngày chỉ được thiết lập một lựa chọn thời gian.", undefined, requestId);
    }
    const today = currentVietnamDateKey();
    if (dates.some((date) => date < today)) {
      return apiFailure(400, "Không thể đăng ký hoặc thay đổi ngày trong quá khứ.", undefined, requestId);
    }
    if (!isWithdraw && entries.length !== dates.length) {
      return apiFailure(400, "Lựa chọn thời gian đăng ký không hợp lệ.", undefined, requestId);
    }
    if (entries.some((entry) => entry.scope === "time_slots" && entry.timeSlotIds.length === 0)) {
      return apiFailure(400, "Hãy chọn ít nhất một khung giờ cụ thể.", undefined, requestId);
    }

    await ensureSheetHeaders("TeacherAvailability", teacherAvailabilityHeaders);
    const [existingRows, slots] = await Promise.all([
      readSheetRows("TeacherAvailability"),
      readSheetRows("TimeSlots"),
    ]);
    const activeSlots = slots.filter((slot) => String(slot.active || "true").toLowerCase() !== "false");
    const activeSlotIds = new Set(activeSlots.flatMap((slot) => [
      String(slot.id || "").trim(),
      availabilityTimeRangeKey({ start: String(slot.start || "").trim(), end: String(slot.end || "").trim() }),
    ]));
    if (entries.some((entry) => entry.timeSlotIds.some((id) => !activeSlotIds.has(id)))) {
      return apiFailure(400, "Có khung giờ không còn hoạt động. Vui lòng tải lại và chọn lại.", undefined, requestId);
    }

    const selectedDates = new Set(dates);
    const rowsToWithdraw = existingRows.filter(
      (row) =>
        String(row.teacherId || "") === teacherId &&
        selectedDates.has(String(row.date || "")) &&
        String(row.status || "available") === "available",
    );
    const now = new Date().toISOString();
    await Promise.all(
      rowsToWithdraw.map((row) => updateSheetRowById("TeacherAvailability", row.id, { status: "withdrawn", updatedAt: now })),
    );

    const rowsToCreate: TeacherAvailability[] = isWithdraw
      ? []
      : entries.flatMap((entry) => {
          const selectedSlots = entry.scope === "time_slots" ? entry.timeSlotIds : [""];
          return selectedSlots.map((timeSlotId) => ({
            id: createId("availability"),
            teacherId,
            date: entry.date,
            scope: entry.scope,
            timeSlotId: timeSlotId || undefined,
            status: "available" as const,
            note: String(body.note || "").trim() || undefined,
            createdBy: auth.user.id,
            createdAt: now,
            updatedAt: now,
          }));
        });
    await appendSheetRows("TeacherAvailability", rowsToCreate);

    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: isWithdraw ? "teacherAvailability.withdraw" : "teacherAvailability.replace",
      entityType: "TeacherAvailability",
      entityId: teacherId,
      route: "/api/teacher-availability",
      method: "POST",
      authMode: permission.authMode,
      decision: permission.decision,
      reason: permission.reason,
      source: auth.source,
      before: { activeRows: rowsToWithdraw.length },
      after: { dates, scope: isWithdraw ? "none" : "per_date", entries, createdRows: rowsToCreate.length },
    });

    const untouched = existingRows.filter(
      (row) =>
        String(row.teacherId || "") === teacherId &&
        !selectedDates.has(String(row.date || "")) &&
        String(row.status || "available") === "available",
    );
    return NextResponse.json({ availability: [...untouched, ...rowsToCreate] });
  } catch (error) {
    return apiError(error, requestId);
  }
}

function parseDates(value: unknown) {
  const values = Array.isArray(value) ? value : [];
  return Array.from(
    new Set(values.map((date) => String(date || "").trim()).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))),
  ).sort();
}

function parseIds(value: unknown) {
  return Array.from(
    new Set((Array.isArray(value) ? value : []).map((id) => String(id || "").trim()).filter(Boolean)),
  );
}

function parseAvailabilityInput(value: unknown): AvailabilityInput | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const date = String(row.date || "").trim();
  const scope = String(row.scope || "").trim() as TeacherAvailabilityScope;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !availabilityScopes.includes(scope)) return null;
  return { date, scope, timeSlotIds: scope === "time_slots" ? parseIds(row.timeSlotIds) : [] };
}

function parseLegacyAvailabilityInputs(body: Record<string, unknown>): AvailabilityInput[] {
  const dates = parseDates(body.dates);
  const scope = String(body.scope || "").trim() as TeacherAvailabilityScope;
  if (!availabilityScopes.includes(scope)) return [];
  const timeSlotIds = scope === "time_slots" ? parseIds(body.timeSlotIds) : [];
  return dates.map((date) => ({ date, scope, timeSlotIds }));
}

function currentVietnamDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
