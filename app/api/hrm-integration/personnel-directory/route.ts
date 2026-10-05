import { NextResponse } from "next/server";
import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { readSheetRowsCached } from "@/lib/google-sheets";
import { cooperationYearsFromPersonnelCode } from "@/lib/hrm-personnel";
import { hrmIntegrationCredentialsConfigured } from "@/lib/hrm-integration";
import { readPersonnelDirectory } from "@/lib/hrm-personnel-directory-cache";
import { requireSessionUser } from "@/lib/route-auth";

/** Resolves only personnel codes for teachers already stored in METTASOUL. */
export async function GET(request: Request) {
  const requestId = createRequestId("hrm-personnel-directory");
  try {
    const auth = await requireSessionUser(request, { allowHeaderFallback: false });
    if (auth.user.role !== "admin") {
      return apiFailure(403, "Chỉ quản trị viên được xem mã nhân sự HRM.", undefined, requestId);
    }
    if (!hrmIntegrationCredentialsConfigured()) {
      return apiFailure(503, "Kết nối HRM chưa được cấu hình trên máy chủ METTASOUL.", undefined, requestId);
    }

    const teachers = await readSheetRowsCached("Teachers", { ttlMs: 30_000 });
    const directory = await readPersonnelDirectory(
      teachers.map((teacher) => ({ id: String(teacher.id || ""), email: String(teacher.email || "").trim().toLowerCase(), name: String(teacher.name || "").trim() })),
    );
    const allowedTeacherIds = new Set(teachers.map((teacher) => String(teacher.id || "")));
    const personnelByTeacherId = Object.fromEntries(
      directory.people
        .filter((person) => allowedTeacherIds.has(person.teacherId) && person.organizationStaffCode)
        .map((person) => [person.teacherId, {
          mnv: person.organizationStaffCode,
          cooperationYears: cooperationYearsFromPersonnelCode(person.organizationStaffCode),
        }]),
    );

    return NextResponse.json({ personnelByTeacherId }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return apiError(error, requestId, { route: "/api/hrm-integration/personnel-directory", method: "GET" });
  }
}
