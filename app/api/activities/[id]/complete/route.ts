import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { requireSessionUser } from "@/lib/route-auth";

export async function POST(request: Request) {
  const requestId = createRequestId("activity-complete-retired");
  try {
    await requireSessionUser(request, { allowHeaderFallback: false });
    return apiFailure(410, "Công việc và MCP nay do quản trị viên chấm công. Vui lòng chờ kết quả trong mục Công việc & MCP.", undefined, requestId);
  } catch (error) {
    return apiError(error, requestId, { route: "/api/activities/[id]/complete", method: "POST" });
  }
}
