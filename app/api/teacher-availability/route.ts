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
import { isTeacherAvailabilityLocked, selectTeacherAvailabilityRowsForChange } from "@/lib/teacher-availability";
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
    const body = (await request.json()) as Record<string, unknown>;
    const operation = String(body.operation || "").trim();
    if (operation && !["create", "update", "delete"].includes(operation)) {
      return apiFailure(400, "Thao tác đăng ký không hợp lệ.", undefined, requestId);
    }
    const requestedTeacherId = String(body.teacherId || "").trim();
    if (requestedTeacherId && auth.user.role !== "admin") {
      return apiFailure(403, "Chỉ quản trị viên mới được thao tác lịch trống của giáo viên khác.", undefined, requestId);
    }
    const adminDelete = operation === "delete" && auth.user.role === "admin" && Boolean(requestedTeacherId);
    const permission = adminDelete
      ? evaluateRolePermission(auth.user, "admin", "admin_delete_locked_teacher_availability")
      : evaluateRolePermission(auth.user, ["teacher", "assistant"], "teacher_only_availability_write");
    if (permission.decision === "would_block") {
      console.warn(`[auth-shadow][${requestId}] teacherAvailability.replace ${permission.reason}`);
    }
    if (!permission.allowed) {
      return apiFailure(403, adminDelete ? "Chỉ quản trị viên được xóa lịch trống của người khác." : "Chỉ giáo viên được đăng ký lịch trống.", undefined, requestId);
    }

    const teacherId = adminDelete ? requestedTeacherId : String(auth.user.teacherId || "").trim();
    if (!teacherId) {
      return apiFailure(400, adminDelete ? "Thiếu giáo viên cần xóa lịch trống." : "Tài khoản chưa được liên kết với hồ sơ giáo viên.", undefined, requestId);
    }

    const targetRegistrationId = String(body.registrationId || "").trim();
    const rawEntries = Array.isArray(body.entries) ? body.entries : null;
    const rawScope = String(body.scope || "").trim();
    const isWithdraw = operation === "delete" || (rawEntries === null && rawScope === "none");
    const parsedEntries = rawEntries?.map(parseAvailabilityInput) ?? null;
    if (parsedEntries?.some((entry) => entry === null)) {
      return apiFailure(400, "Có ngày hoặc lựa chọn thời gian không hợp lệ.", undefined, requestId);
    }
    const entries = parsedEntries
      ? (parsedEntries as AvailabilityInput[])
      : isWithdraw
        ? []
        : parseLegacyAvailabilityInputs(body);
    const dates = isWithdraw ? parseDates(body.dates) : rawEntries === null ? parseDates(body.dates) : entries.map((entry) => entry.date);
    if (dates.length === 0 || dates.length > 62) {
      return apiFailure(400, "Hãy chọn từ 1 đến 62 ngày để đăng ký.", undefined, requestId);
    }
    if (new Set(dates).size !== dates.length) {
      return apiFailure(400, "Mỗi ngày chỉ được thiết lập một lựa chọn thời gian.", undefined, requestId);
    }
    if (["update", "delete"].includes(operation) && (dates.length !== 1 || !targetRegistrationId)) {
      return apiFailure(400, "Hãy chọn đúng một lượt đăng ký để sửa hoặc xóa.", undefined, requestId);
    }
    const today = currentVietnamDateKey();
    if (dates.some((date) => date < today)) {
      return apiFailure(400, "Không thể đăng ký hoặc thay đổi ngày trong quá khứ.", undefined, requestId);
    }
    if (!isWithdraw && entries.length !== dates.length) {
      return apiFailure(400, "Lựa chọn thời gian đăng ký không hợp lệ.", undefined, requestId);
    }
    if (entries.some((entry) => entry.scope === "time_slots")) {
      return apiFailure(400, "Ứng dụng chỉ nhận đăng ký Cả ngày, Buổi sáng hoặc Buổi chiều.", undefined, requestId);
    }

    await ensureSheetHeaders("TeacherAvailability", teacherAvailabilityHeaders);
    const existingRows = await readSheetRows("TeacherAvailability");

    const rowsToWithdraw = selectTeacherAvailabilityRowsForChange(
      existingRows.map((row) => ({
        ...row,
        id: String(row.id || ""),
        teacherId: String(row.teacherId || ""),
        date: String(row.date || ""),
        registrationId: String(row.registrationId || "") || undefined,
        createdAt: String(row.createdAt || ""),
        status: String(row.status || "available") === "withdrawn" ? "withdrawn" as const : "available" as const,
      })),
      teacherId,
      dates,
      operation,
      targetRegistrationId,
    );
    if (["update", "delete"].includes(operation) && rowsToWithdraw.length === 0) {
      return apiFailure(404, "Lượt đăng ký không còn tồn tại. Vui lòng tải lại danh sách.", undefined, requestId);
    }
    const nowDate = new Date();
    const lockedDates = dates.filter((date) => {
      const dateRows = rowsToWithdraw
        .filter((row) => String(row.date || "") === date)
        .map((row) => ({ createdAt: String(row.createdAt || "") }));
      return isTeacherAvailabilityLocked(dateRows, nowDate.getTime());
    });
    if (!adminDelete && lockedDates.length > 0) {
      return apiFailure(
        409,
        `Lịch trống ngày ${lockedDates.join(", ")} đã khóa sau 24 giờ và không thể sửa hoặc xóa.`,
        "CONFLICT",
        requestId,
      );
    }
    const now = nowDate.toISOString();
    const newRegistrationIds = new Map(dates.map((date) => [date, createId("availability-registration")]));
    const originalCreatedAtByDate = new Map<string, string>();
    for (const row of rowsToWithdraw) {
      const date = String(row.date || "");
      const createdAt = String(row.createdAt || "");
      const current = originalCreatedAtByDate.get(date);
      if (!current || Date.parse(createdAt) < Date.parse(current)) {
        originalCreatedAtByDate.set(date, createdAt);
      }
    }
    await Promise.all(
      rowsToWithdraw.map((row) => updateSheetRowById("TeacherAvailability", row.id, { status: "withdrawn", updatedAt: now })),
    );

    const rowsToCreate: TeacherAvailability[] = isWithdraw
      ? []
      : entries.map((entry) => ({
            id: createId("availability"),
            registrationId: operation === "update" && !targetRegistrationId.startsWith("legacy:")
              ? targetRegistrationId
              : newRegistrationIds.get(entry.date),
            teacherId,
            date: entry.date,
            scope: entry.scope,
            status: "available" as const,
            note: String(body.note || "").trim() || undefined,
            createdBy: auth.user.id,
            createdAt: originalCreatedAtByDate.get(entry.date) || now,
            updatedAt: now,
          }));
    await appendSheetRows("TeacherAvailability", rowsToCreate);

    await appendAuditLog({
      requestId,
      actor: auth.user,
      action: adminDelete ? "teacherAvailability.admin_withdraw" : isWithdraw ? "teacherAvailability.withdraw" : operation === "create" ? "teacherAvailability.create" : "teacherAvailability.replace",
      entityType: "TeacherAvailability",
      entityId: teacherId,
      route: "/api/teacher-availability",
      method: "POST",
      authMode: permission.authMode,
      decision: permission.decision,
      reason: permission.reason,
      source: auth.source,
      before: { activeRows: rowsToWithdraw.length },
      after: { dates, registrationId: targetRegistrationId || undefined, scope: isWithdraw ? "none" : "per_date", entries, createdRows: rowsToCreate.length },
    });

    const withdrawnIds = new Set(rowsToWithdraw.map((row) => String(row.id || "")));
    const untouched = existingRows.filter((row) =>
      (adminDelete || String(row.teacherId || "") === teacherId) &&
      !withdrawnIds.has(String(row.id || "")) &&
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

function parseAvailabilityInput(value: unknown): AvailabilityInput | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const date = String(row.date || "").trim();
  const scope = String(row.scope || "").trim() as TeacherAvailabilityScope;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !availabilityScopes.includes(scope)) return null;
  return { date, scope, timeSlotIds: [] };
}

function parseLegacyAvailabilityInputs(body: Record<string, unknown>): AvailabilityInput[] {
  const dates = parseDates(body.dates);
  const scope = String(body.scope || "").trim() as TeacherAvailabilityScope;
  if (!availabilityScopes.includes(scope)) return [];
  return dates.map((date) => ({ date, scope, timeSlotIds: [] }));
}

function currentVietnamDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
