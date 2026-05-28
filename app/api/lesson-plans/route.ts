import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { apiError, createId } from "@/lib/api";
import { findAuthorizedUserFromSession } from "@/lib/auth-users";
import { sessionCookieName, verifySessionToken } from "@/lib/auth-session";
import { appendSheetRowWithHeaders, ensureSheetHeaders, readSheetRowById, updateSheetRowById } from "@/lib/google-sheets";
import type { User } from "@/lib/types";

export const runtime = "nodejs";

const lessonPlanHeaders = [
  "id",
  "scheduleId",
  "teacherId",
  "fileName",
  "driveFileId",
  "driveUrl",
  "source",
  "uploadedAt",
  "createdAt",
  "updatedAt",
];

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const scheduleId = String(body.scheduleId || "").trim();
    const teacherId = String(body.teacherId || "").trim();
    const fileName = String(body.fileName || "").trim();
    const driveFileId = String(body.driveFileId || "").trim();
    const driveUrl = normalizeExternalUrl(body.driveUrl);
    const source = String(body.source || "").trim() === "external_link" ? "external_link" : "upload";

    if (!scheduleId || !teacherId) {
      throw new Error("Missing scheduleId or teacherId.");
    }
    const schedule = await readSheetRowById("Schedules", scheduleId);
    if (!schedule) {
      return NextResponse.json({ error: "Cannot find schedule." }, { status: 404 });
    }
    if (!canManageLessonPlan(user, schedule.teacherId || "")) {
      return NextResponse.json({ error: "Permission denied." }, { status: 403 });
    }
    if (teacherId !== String(schedule.teacherId || "").trim()) {
      return NextResponse.json({ error: "Teacher does not match this schedule." }, { status: 400 });
    }
    if (!fileName || !driveUrl) {
      throw new Error("Missing lesson plan name or link.");
    }
    if (source === "upload" && !driveFileId) {
      throw new Error("Missing Google Drive file metadata.");
    }

    const now = new Date().toISOString();
    const lessonPlan = {
      id: createId("lp"),
      scheduleId,
      teacherId,
      fileName,
      driveFileId: source === "external_link" ? "" : driveFileId,
      driveUrl,
      source,
      uploadedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await ensureSheetHeaders("LessonPlans", lessonPlanHeaders);
    await appendSheetRowWithHeaders("LessonPlans", lessonPlanHeaders, lessonPlan);
    if (schedule.status !== "attended") {
      await updateSheetRowById("Schedules", scheduleId, { status: "lesson_plan_uploaded", updatedAt: now });
    }
    return NextResponse.json(lessonPlan);
  } catch (error) {
    if (error instanceof RouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return apiError(error);
  }
}

async function requireUser() {
  const cookieStore = await cookies();
  const session = verifySessionToken(cookieStore.get(sessionCookieName)?.value);
  if (!session) {
    throw new RouteError(401, "Unauthorized");
  }

  const user = await findAuthorizedUserFromSession(session.userId, session.email);
  if (!user) {
    throw new RouteError(401, "Unauthorized");
  }
  return user;
}

function canManageLessonPlan(user: User, teacherId: string) {
  if (user.role === "admin") {
    return true;
  }
  return user.teacherId === teacherId;
}

function normalizeExternalUrl(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Link giáo án không hợp lệ.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Link giáo án phải bắt đầu bằng http hoặc https.");
  }

  return url.toString();
}

class RouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
