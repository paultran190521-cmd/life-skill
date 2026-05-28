import { NextResponse } from "next/server";
import { ErrorCodes } from "@/lib/error-codes";
import type { ErrorCode } from "@/lib/error-codes";
import { isAppError } from "@/lib/app-error";

export function apiError(error: unknown, requestId = createRequestId("req")) {
  if (isAppError(error)) {
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
) {
  return NextResponse.json({ error, code, requestId }, { status });
}

export function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function createRequestId(prefix = "req") {
  return `${prefix}-${crypto.randomUUID().slice(0, 12)}`;
}
