import { NextResponse } from "next/server";
import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { readSheetRows } from "@/lib/google-sheets";
import { hrmIntegrationCredentialsConfigured, provisionMettasoulTeacherInHrm } from "@/lib/hrm-integration";
import { requireSessionUser } from "@/lib/route-auth";

export async function POST(request: Request) {
  const requestId = createRequestId("teacher-provision-retry");
  try {
    const auth = await requireSessionUser(request, { allowHeaderFallback: false });
    if (auth.user.role !== "admin") return apiFailure(403, "Chỉ quản trị viên được đồng bộ nhân sự HRM.", undefined, requestId);
    if (!hrmIntegrationCredentialsConfigured()) return apiFailure(503, "Kết nối HRM chưa được cấu hình.", undefined, requestId);
    const body = await request.json() as Record<string, unknown>;
    const teacherId = String(body.teacherId || "").trim();
    const teachers = await readSheetRows("Teachers");
    const teacher = teachers.find((row) => String(row.id || "") === teacherId);
    const users = await readSheetRows("Users");
    const user = users.find((row) => String(row.teacherId || "") === teacherId);
    if (!teacher?.email || !user?.id || !["teacher", "assistant"].includes(String(user.role || ""))) {
      return apiFailure(409, "Cần có giáo viên và tài khoản giáo viên/trợ giảng liên kết trước khi đồng bộ HRM.", undefined, requestId);
    }
    const email = String(teacher.email).trim().toLowerCase();
    if (String(user.email || "").trim().toLowerCase() !== email) {
      return apiFailure(409, "Email giáo viên và tài khoản METTASOUL chưa khớp.", undefined, requestId);
    }
    const eventId = `MTS_IDENTITY_${user.id}_${email}_${user.role}`;
    const result = await provisionMettasoulTeacherInHrm({
      source: "METTASOUL", action: "PROVISION_WORKER", eventId,
      idempotencyKey: `PROVISION:${user.id}:${email}:${user.role}`,
      userId: String(user.id), teacherId, name: String(teacher.name || ""), userEmail: email,
      role: user.role as "teacher" | "assistant", avatarUrl: String(user.avatarUrl || teacher.avatarUrl || ""),
    });
    await appendAuditLog({ requestId, actor: auth.user, action: "teacher.hrm_provision.retry", entityType: "Teacher", entityId: teacherId,
      route: "/api/hrm-integration/teacher-provision", method: "POST", authMode: auth.authMode,
      decision: "allow", source: auth.source, after: { userEmail: email, eventId, idempotent: Boolean(result.idempotent) } });
    return NextResponse.json({ status: "CONFIRMED", idempotent: Boolean(result.idempotent) });
  } catch (error) {
    return apiError(error, requestId, { route: "/api/hrm-integration/teacher-provision", method: "POST" });
  }
}
