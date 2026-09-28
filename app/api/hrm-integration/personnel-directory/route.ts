import { NextResponse } from "next/server";
import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { getAppDataFromSheets } from "@/lib/google-sheets";
import { cooperationYearsFromPersonnelCode } from "@/lib/hrm-personnel";
import {
  getMettasoulPersonnelDirectoryFromHrm,
  hrmIntegrationCredentialsConfigured,
} from "@/lib/hrm-integration";
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

    const { teachers } = await getAppDataFromSheets({ includeHistory: false });
    const directory = await getMettasoulPersonnelDirectoryFromHrm(
      teachers.map((teacher) => ({ id: teacher.id, email: teacher.email, name: teacher.name })),
    );
    const allowedTeacherIds = new Set(teachers.map((teacher) => teacher.id));
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
