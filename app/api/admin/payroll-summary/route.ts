import { NextResponse } from "next/server";
import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { ErrorCodes } from "@/lib/error-codes";
import { readSheetRowsBatch } from "@/lib/google-sheets";
import { getMyPayrollSummaryFromHrm, hrmIntegrationCredentialsConfigured } from "@/lib/hrm-integration";
import { requireSessionUser } from "@/lib/route-auth";

/** Admin reads one HRM monthly payroll result for a teacher selected from METTASOUL. */
export async function GET(request: Request) {
  const requestId = createRequestId("admin-payroll-summary");
  try {
    const auth = await requireSessionUser(request, { allowHeaderFallback: false });
    if (auth.user.role !== "admin") {
      return apiFailure(403, "Chỉ quản trị viên được xem bảng lương.", ErrorCodes.forbidden, requestId);
    }
    const params = new URL(request.url).searchParams;
    const month = params.get("month") || "";
    const teacherId = params.get("teacherId") || "";
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !teacherId) {
      return apiFailure(400, "Cần chọn giáo viên và tháng lương hợp lệ.", ErrorCodes.validation, requestId);
    }
    if (!hrmIntegrationCredentialsConfigured()) {
      return apiFailure(503, "Kết nối HRM chưa được cấu hình.", ErrorCodes.externalService, requestId);
    }
    const rows = await readSheetRowsBatch(["Teachers"] as const);
    const teacher = rows.Teachers.find((item) => item.id === teacherId);
    if (!teacher?.email) {
      return apiFailure(404, "Không tìm thấy email HRM của giáo viên.", ErrorCodes.notFound, requestId);
    }
    const result = await getMyPayrollSummaryFromHrm(teacher.email.trim().toLowerCase(), teacher.id, month);
    return NextResponse.json({
      teacherId: teacher.id,
      month: result.month,
      available: result.available,
      status: result.status,
      isPaid: result.isPaid ?? false,
      totalIncome: result.totalIncome ?? 0,
      teachingIncome: result.teachingIncome ?? 0,
      insuranceDeduction: result.insuranceDeduction ?? 0,
      bhxhDeduction: result.bhxhDeduction ?? null,
      fixedDeductionDetails: result.fixedDeductionDetails ?? null,
      otherDeduction: result.otherDeduction ?? 0,
      taxDeduction: result.taxDeduction ?? 0,
      netIncome: result.netIncome ?? 0,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId, { route: "/api/admin/payroll-summary", method: "GET" });
  }
}