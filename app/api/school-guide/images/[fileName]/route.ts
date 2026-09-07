import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { apiError, apiFailure, createRequestId } from "@/lib/api";
import { requireSessionUser } from "@/lib/route-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileName: string }> },
) {
  const requestId = createRequestId("school-guide-image");
  try {
    await requireSessionUser(request, { allowHeaderFallback: false });
    const { fileName } = await params;
    if (!/^[a-z0-9-]+\.webp$/.test(fileName)) {
      return apiFailure(404, "Không tìm thấy hình ảnh trường.", undefined, requestId);
    }

    const imagePath = path.join(process.cwd(), "private", "school-guide", fileName);
    let image: Buffer;
    try {
      image = await readFile(imagePath);
    } catch {
      return apiFailure(404, "Không tìm thấy hình ảnh trường.", undefined, requestId);
    }

    return new NextResponse(new Uint8Array(image), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, max-age=3600, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error, requestId);
  }
}
