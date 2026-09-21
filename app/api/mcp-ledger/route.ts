import { NextResponse } from "next/server";
import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { ErrorCodes } from "@/lib/error-codes";
import { getMcpLedgerFromHrm, hrmIntegrationCredentialsConfigured } from "@/lib/hrm-integration";
import { requireSessionUser } from "@/lib/route-auth";

/** A teacher may read only their own HRM-authoritative MCP ledger. */
export async function GET(request: Request) {
  const requestId = createRequestId("mcp-ledger");
  try {
    const auth = await requireSessionUser(request, { allowHeaderFallback: false });
    if (!hrmIntegrationCredentialsConfigured()) {
      return apiFailure(503, "Kết nối HRM chưa được cấu hình trên máy chủ METTASOUL.", ErrorCodes.externalService, requestId);
    }
    const result = await getMcpLedgerFromHrm(auth.user.email.trim().toLowerCase());
    return NextResponse.json({ entries: result.entries ?? [] });
  } catch (error) {
    return apiError(error, requestId, { route: "/api/mcp-ledger", method: "GET" });
  }
}
