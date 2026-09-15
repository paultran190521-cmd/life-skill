import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { readSheetRows, toAuditLogs } from "@/lib/google-sheets";
import { requireSessionUser } from "@/lib/route-auth";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = createRequestId("schedule-history");
  try {
    const auth = await requireSessionUser(request, { allowHeaderFallback: false });
    if (auth.user.role !== "admin") return apiFailure(403, "Chỉ quản trị viên được xem lịch sử.", undefined, requestId);
    const { id } = await params;
    const rows = await readSheetRows("AuditLogs");
    return Response.json(toAuditLogs(rows.filter((row) => row.entityId === id && row.entityType === "Schedule")), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error, requestId); }
}
