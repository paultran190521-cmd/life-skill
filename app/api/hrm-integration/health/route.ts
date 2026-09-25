import { NextResponse } from "next/server";
import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { hrmIntegrationCredentialsConfigured, hrmIntegrationConfigured, pingHrmIntegration, getTopicReportPoliciesFromHrm } from "@/lib/hrm-integration";
import { requireSessionUser } from "@/lib/route-auth";

/**
 * A deliberately read-only diagnostics endpoint for administrators. It proves
 * that METTASOUL can reach HRM with the configured shared secret, without
 * creating a payroll, MCP, or integration-event record.
 */
export async function GET(request: Request) {
  const requestId = createRequestId("hrm-health");
  try {
    const auth = await requireSessionUser(request, { allowHeaderFallback: false });
    if (auth.user.role !== "admin") {
      return apiFailure(403, "Chỉ quản trị viên được kiểm tra kết nối HRM.", undefined, requestId);
    }
    if (!hrmIntegrationCredentialsConfigured()) {
      return NextResponse.json({ credentialsConfigured: false, workLogWritesEnabled: false, reachable: false, ready: false });
    }
    try {
      const result = await pingHrmIntegration();
      const policies = new URL(request.url).searchParams.get("topicReport") === "1" ? await getTopicReportPoliciesFromHrm() : undefined;
      return NextResponse.json({
        credentialsConfigured: true,
        workLogWritesEnabled: hrmIntegrationConfigured(),
        reachable: true,
        ready: result.code === "READY",
        schemaVersion: result.schemaVersion,
        policyContracts: result.policyContracts || [],
        cancellationReports: Boolean(result.cancellationReports),
        ...(policies ? { topicReportPolicies: policies.policies.map((row) => ({ code: row.ActivityTypeCode, money: row.CashAmount, mcp: row.McpPoints, status: row.Status })), assistantProfiles: policies.assistants.map((row) => ({ code: row.Code, money: row.BaseRate, status: row.Status })) } : {}),
      });
    } catch (error) {
      const integrationError = error as { code?: string; diagnostic?: unknown };
      const code = String(integrationError?.code || "HRM_UNREACHABLE");
      return NextResponse.json({
        credentialsConfigured: true,
        workLogWritesEnabled: hrmIntegrationConfigured(),
        reachable: false,
        ready: false,
        code,
        ...(["HRM_INVALID_RESPONSE", "HRM_UNREACHABLE"].includes(code) && integrationError?.diagnostic
          ? { diagnostic: integrationError.diagnostic }
          : {}),
      });
    }
  } catch (error) {
    return apiError(error, requestId, { route: "/api/hrm-integration/health", method: "GET" });
  }
}
