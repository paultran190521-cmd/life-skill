import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { ErrorCodes } from "@/lib/error-codes";
import { readSheetRows, readSheetRowsCached } from "@/lib/google-sheets";
import { getTeacherPaySetupFromHrm, hrmIntegrationCredentialsConfigured, setTeacherPayAssignmentInHrm } from "@/lib/hrm-integration";
import { requireSessionUser } from "@/lib/route-auth";

export async function GET(request: Request) {
  const requestId = createRequestId("teacher-pay-read");
  try {
    const auth = await requireSessionUser(request, { allowHeaderFallback: false });
    if (auth.user.role !== "admin") return apiFailure(403, "Chỉ quản trị viên được xem bậc đơn giá.", undefined, requestId);
    if (!hrmIntegrationCredentialsConfigured()) return apiFailure(503, "Kết nối HRM chưa được cấu hình.", undefined, requestId);
    const teachers = await readSheetRowsCached("Teachers", { ttlMs: 30_000 });
    const profiles = [] as Awaited<ReturnType<typeof getTeacherPaySetupFromHrm>>["profiles"];
    const people = [] as Awaited<ReturnType<typeof getTeacherPaySetupFromHrm>>["people"];
    for (let offset = 0; offset < teachers.length; offset += 500) {
      const result = await getTeacherPaySetupFromHrm(teachers.slice(offset, offset + 500).map((teacher) => ({
        id: String(teacher.id || ""), email: String(teacher.email || "").trim().toLowerCase(), name: String(teacher.name || "").trim(),
      })));
      if (!profiles.length) profiles.push(...result.profiles);
      people.push(...result.people);
    }
    if (!teachers.length) {
      const result = await getTeacherPaySetupFromHrm([]);
      profiles.push(...result.profiles);
    }
    return NextResponse.json({ profiles, people }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId, { route: "/api/hrm-integration/teacher-pay", method: "GET" });
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId("teacher-pay-write");
  try {
    const auth = await requireSessionUser(request, { allowHeaderFallback: false });
    if (auth.user.role !== "admin") return apiFailure(403, "Chỉ quản trị viên được gán bậc đơn giá.", undefined, requestId);
    if (!hrmIntegrationCredentialsConfigured()) return apiFailure(503, "Kết nối HRM chưa được cấu hình.", undefined, requestId);
    const body = await request.json() as Record<string, unknown>;
    const teacherId = String(body.teacherId || "").trim();
    const teachers = await readSheetRows("Teachers");
    const teacher = teachers.find((row) => String(row.id || "") === teacherId);
    if (!teacher?.email) return apiFailure(404, "Không tìm thấy giáo viên METTASOUL.", undefined, requestId);
    const users = await readSheetRows("Users");
    const linkedUser = users.find((row) => String(row.teacherId || "") === teacherId);
    if (!linkedUser || !["teacher", "assistant"].includes(String(linkedUser.role || ""))) {
      return apiFailure(409, "Giáo viên cần có tài khoản giáo viên hoặc trợ giảng METTASOUL.", undefined, requestId);
    }
    const email = String(teacher.email).trim().toLowerCase();
    if (String(linkedUser.email || "").trim().toLowerCase() !== email) {
      return apiFailure(409, "Email giáo viên và tài khoản METTASOUL chưa khớp.", undefined, requestId);
    }
    const defaultProfileCode = String(body.defaultProfileCode || "").trim().toUpperCase();
    const assistantProfileCode = String(body.assistantProfileCode || "").trim().toUpperCase();
    if (!defaultProfileCode && !assistantProfileCode) return apiFailure(400, "Hãy chọn ít nhất một bậc đơn giá.", undefined, requestId);
    const workerCategory = String(body.workerCategory || "PROFESSIONAL_TEACHER").trim().toUpperCase();
    if (!["PROFESSIONAL_TEACHER", "STUDENT_ASSISTANT"].includes(workerCategory)) {
      return apiFailure(400, "Nhóm người không hợp lệ.", undefined, requestId);
    }
    const eventId = createId("PAY_ASSIGN");
    const result = await setTeacherPayAssignmentInHrm({
      eventId,
      idempotencyKey: `PAY_ASSIGN:${eventId}`,
      teacherId,
      userEmail: email,
      defaultProfileCode,
      assistantProfileCode,
      workerCategory,
      confirmExistingHrmAccount: body.confirmExistingHrmAccount === true,
      actorEmail: auth.user.email,
    });
    await appendAuditLog({ requestId, actor: auth.user, action: "teacher.pay_profile.assign", entityType: "Teacher", entityId: teacherId,
      route: "/api/hrm-integration/teacher-pay", method: "POST", authMode: auth.authMode, decision: "allow", reason: "admin", source: auth.source,
      after: { userEmail: email, defaultProfileCode, assistantProfileCode, workerCategory, eventId },
    });
    return NextResponse.json({ assignment: result.assignment, code: result.code }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if ((error as { code?: string }).code === "HRM_WRITE_UNCONFIRMED") {
      return apiFailure(502, error instanceof Error ? error.message : "Chưa xác nhận được kết quả lưu từ HRM.", ErrorCodes.externalService, requestId);
    }
    return apiError(error, requestId, { route: "/api/hrm-integration/teacher-pay", method: "POST" });
  }
}
