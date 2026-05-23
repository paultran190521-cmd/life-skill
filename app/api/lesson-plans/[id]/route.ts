import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { findAuthorizedUserFromSession } from "@/lib/auth-users";
import { sessionCookieName, verifySessionToken } from "@/lib/auth-session";
import { readSheetRowById, updateSheetRowById } from "@/lib/google-sheets";
import type { User } from "@/lib/types";

type Params = {
  params: Promise<{ id: string }>;
};

const GAS_TIMEOUT_MS = 25_000;

export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const lessonPlan = await readSheetRowById("LessonPlans", id);
    if (!lessonPlan) {
      return NextResponse.json({ error: "Cannot find lesson plan." }, { status: 404 });
    }
    if (!canManageLessonPlan(user, lessonPlan.teacherId || "")) {
      return NextResponse.json({ error: "Permission denied." }, { status: 403 });
    }

    const body = await request.json();
    const fileName = String(body.fileName || "").trim();

    if (!fileName) {
      throw new Error("Missing fileName.");
    }

    const updatedAt = new Date().toISOString();
    await updateSheetRowById("LessonPlans", id, {
      fileName,
      updatedAt,
    });

    return NextResponse.json({
      id,
      fileName,
      updatedAt,
    });
  } catch (error) {
    if (error instanceof RouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return apiError(error);
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const lessonPlan = await readSheetRowById("LessonPlans", id);
    if (!lessonPlan) {
      return NextResponse.json({ error: "Cannot find lesson plan." }, { status: 404 });
    }
    if (!canManageLessonPlan(user, lessonPlan.teacherId || "")) {
      return NextResponse.json({ error: "Permission denied." }, { status: 403 });
    }

    const webhookUrl = process.env.GAS_UPLOAD_WEBHOOK_URL || process.env.GAS_MAIL_WEBHOOK_URL;
    const secret = process.env.GAS_UPLOAD_WEBHOOK_SECRET || process.env.GAS_MAIL_WEBHOOK_SECRET;
    if (!webhookUrl || !secret) {
      return NextResponse.json({ error: "Missing GAS webhook configuration." }, { status: 500 });
    }

    const requestId = `lp-del-${crypto.randomUUID()}`;
    const gasResponse = await fetchWithTimeout(
      webhookUrl,
      {
        method: "POST",
        headers: { "Content-Type": "application/json;charset=utf-8" },
        body: JSON.stringify({
          action: "deleteLessonPlan",
          secret,
          requestId,
          lessonPlanId: id,
        }),
      },
      requestId,
    );

    const rawText = (await gasResponse.text()).trim();
    const parsed = tryParseJson(rawText);
    if (!gasResponse.ok || !parsed || !parsed.ok) {
      const message =
        parsed?.error ||
        parsed?.message ||
        `Cannot delete lesson plan from GAS. Request ID: ${requestId}`;
      return NextResponse.json({ error: message }, { status: 502 });
    }

    return NextResponse.json({ id, deleted: true });
  } catch (error) {
    if (error instanceof RouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return apiError(error);
  }
}

class RouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
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

async function fetchWithTimeout(url: string, init: RequestInit, requestId: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GAS_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new RouteError(504, `GAS delete timeout after ${GAS_TIMEOUT_MS}ms. Request ID: ${requestId}`);
    }
    throw new RouteError(502, `Cannot reach GAS webhook. Request ID: ${requestId}`);
  } finally {
    clearTimeout(timeoutId);
  }
}

function tryParseJson(input: string): { ok?: boolean; error?: string; message?: string } | null {
  if (!input || input.startsWith("<")) {
    return null;
  }
  try {
    return JSON.parse(input) as { ok?: boolean; error?: string; message?: string };
  } catch {
    return null;
  }
}
