import { NextResponse } from "next/server";
import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { ErrorCodes } from "@/lib/error-codes";
import { readSheetRowsCached } from "@/lib/google-sheets";
import { getMcpLedgerFromHrm, hrmIntegrationCredentialsConfigured } from "@/lib/hrm-integration";
import { requireSessionUser } from "@/lib/route-auth";

/** A teacher may read only their own HRM-authoritative MCP ledger. */
export async function GET(request: Request) {
  const requestId = createRequestId("mcp-ledger");
  try {
    const auth = await requireSessionUser(request, { allowHeaderFallback: false });
    const teacherId = new URL(request.url).searchParams.get("teacherId")?.trim() || "";
    if (teacherId && auth.user.role !== "admin") {
      return apiFailure(403, "Chỉ quản trị viên được xem sổ MCP của giáo viên khác.", ErrorCodes.forbidden, requestId);
    }
    if (!hrmIntegrationCredentialsConfigured()) {
      return apiFailure(503, "Kết nối HRM chưa được cấu hình trên máy chủ METTASOUL.", ErrorCodes.externalService, requestId);
    }
    let userEmail = auth.user.email.trim().toLowerCase();
    if (teacherId) {
      const teachers = await readSheetRowsCached("Teachers", { ttlMs: 60_000 });
      const teacher = teachers.find((item) => item.id === teacherId);
      if (!teacher?.email) {
        return apiFailure(404, "Không tìm thấy email HRM của giáo viên.", ErrorCodes.notFound, requestId);
      }
      userEmail = teacher.email.trim().toLowerCase();
    }
    const result = await getMcpLedgerFromHrm(userEmail);
    return NextResponse.json({ entries: result.entries ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, requestId, { route: "/api/mcp-ledger", method: "GET" });
  }
}
