import { NextResponse } from "next/server";
import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { ErrorCodes } from "@/lib/error-codes";
import { getMyPayrollSummaryFromHrm, hrmIntegrationCredentialsConfigured } from "@/lib/hrm-integration";
import { requireSessionUser } from "@/lib/route-auth";

/** Teacher-only payroll read. Identity always comes from the server session. */
export async function GET(request: Request) {
  const requestId = createRequestId("my-payroll-summary");
  try {
    const auth = await requireSessionUser(request, { allowHeaderFallback: false });
    if (auth.user.role !== "teacher" || !auth.user.teacherId) {
      return apiFailure(403, "Chỉ giáo viên được xem bảng lương của mình.", ErrorCodes.forbidden, requestId);
    }
    const month = new URL(request.url).searchParams.get("month") || "";
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return apiFailure(400, "Tháng lương không hợp lệ.", ErrorCodes.validation, requestId);
    }
    if (!hrmIntegrationCredentialsConfigured()) {
      return apiFailure(503, "Kết nối HRM chưa được cấu hình.", ErrorCodes.externalService, requestId);
    }
    const result = await getMyPayrollSummaryFromHrm(auth.user.email.trim().toLowerCase(), auth.user.teacherId, month);
    return NextResponse.json({
      month: result.month,
      available: result.available,
      status: result.status,
      isPaid: result.isPaid ?? false,
      totalIncome: result.totalIncome ?? 0,
      teachingIncome: result.teachingIncome ?? 0,
      insuranceDeduction: result.insuranceDeduction ?? 0,
      bhxhDeduction: result.bhxhDeduction ?? null,
      otherDeduction: result.otherDeduction ?? 0,
      taxDeduction: result.taxDeduction ?? 0,
      netIncome: result.netIncome ?? 0,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId, { route: "/api/my-payroll-summary", method: "GET" });
  }
}
