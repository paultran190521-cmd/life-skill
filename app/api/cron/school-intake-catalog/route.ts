import { NextResponse } from "next/server";
import { syncSchoolIntakeCatalog } from "@/lib/school-intake-catalog-sync";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = String(process.env.CRON_SECRET || "").trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await syncSchoolIntakeCatalog());
  } catch (error) {
    console.error("School intake catalog sync failed", error);
    return NextResponse.json({ error: "Không đồng bộ được danh mục trường, lớp, khung giờ." }, { status: 500 });
  }
}
