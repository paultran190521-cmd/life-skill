import { NextResponse } from "next/server";
import { ErrorCodes } from "@/lib/error-codes";
import type { ErrorCode } from "@/lib/error-codes";
import { isAppError } from "@/lib/app-error";
import { queueApiErrorEvent } from "@/lib/audit";

type ApiEventContext = {
  route?: string;
  method?: string;
  actorId?: string;
  actorEmail?: string;
};

export function apiError(error: unknown, requestId = createRequestId("req"), context?: ApiEventContext) {
  if (isAppError(error)) {
    queueApiErrorEvent({
      requestId,
      code: error.code,
      status: error.status,
      message: error.message,
      route: context?.route,
      method: context?.method,
      actorId: context?.actorId,
      actorEmail: context?.actorEmail,
    });
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        requestId,
      },
      { status: error.status },
    );
  }

  const message = error instanceof Error ? error.message : "Lỗi hệ thống không xác định.";
  console.error(`[api-error][${requestId}]`, message, error);
  queueApiErrorEvent({
    requestId,
    code: ErrorCodes.internal,
    status: 500,
    message,
    route: context?.route,
    method: context?.method,
    actorId: context?.actorId,
    actorEmail: context?.actorEmail,
  });

  return NextResponse.json(
    {
      error: "Hệ thống đang bận, vui lòng thử lại.",
      code: ErrorCodes.internal,
      requestId,
    },
    { status: 500 },
  );
}

export function apiFailure(
  status: number,
  error: string,
  code: ErrorCode = ErrorCodes.validation,
  requestId = createRequestId("req"),
  context?: ApiEventContext,
) {
  queueApiErrorEvent({
    requestId,
    code,
    status,
    message: error,
    route: context?.route,
    method: context?.method,
    actorId: context?.actorId,
    actorEmail: context?.actorEmail,
  });
  return NextResponse.json({ error, code, requestId }, { status });
}

export function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function createRequestId(prefix = "req") {
  return `${prefix}-${crypto.randomUUID().slice(0, 12)}`;
}
