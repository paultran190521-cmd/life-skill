import { NextResponse } from "next/server";
import { apiError, createId } from "@/lib/api";
import { appendSheetRow, readSheetRows } from "@/lib/google-sheets";

export async function GET() {
  try {
    return NextResponse.json(await readSheetRows("Schools"));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const district = String(body.district || "").trim();
    const address = String(body.address || "").trim();
    const contactName = String(body.contactName || "").trim();
    const contactPhone = String(body.contactPhone || "").trim();

    if (!name) {
      return NextResponse.json({ error: "Tên trường là bắt buộc." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const school = {
      id: body.id || createId("s"),
      name,
      district: district || "Chưa cập nhật",
      address,
      contactName,
      contactPhone,
      createdAt: now,
      updatedAt: now,
    };

    await appendSheetRow("Schools", school);
    return NextResponse.json(school);
  } catch (error) {
    return apiError(error);
  }
}
