import { NextResponse } from "next/server";
import { apiError, createRequestId } from "@/lib/api";
import { checkEmailProviderHealth, checkGasMailHealth, checkSheetsHealth, summarizeHealthStatus } from "@/lib/admin-health";
import { forbiddenError } from "@/lib/app-error";
import { evaluateRolePermission, requireSessionUser } from "@/lib/route-auth";

export async function GET(request: Request) {
  const requestId = createRequestId("health");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_healthcheck");
    if (!permission.allowed) {
      throw forbiddenError();
    }

    const [sheets, gasMail, emailProvider] = await Promise.all([
      checkSheetsHealth(),
      checkGasMailHealth(),
      checkEmailProviderHealth(),
    ]);

    return NextResponse.json({
      status: summarizeHealthStatus([sheets, gasMail, emailProvider]),
      checkedAt: new Date().toISOString(),
      requestId,
      services: {
        sheets,
        gas_mail: gasMail,
        email_provider: emailProvider,
      },
    });
  } catch (error) {
    return apiError(error, requestId);
  }
}
