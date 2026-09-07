import { NextResponse } from "next/server";
import { apiError, createRequestId } from "@/lib/api";
import { requireSessionUser } from "@/lib/route-auth";
import { schoolGuide } from "@/lib/school-guide-data";

export async function GET(request: Request) {
  const requestId = createRequestId("school-guide");
  try {
    await requireSessionUser(request, { allowHeaderFallback: false });
    return NextResponse.json(schoolGuide, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return apiError(error, requestId);
  }
}
