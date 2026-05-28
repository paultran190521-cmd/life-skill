import { ErrorCodes, type ErrorCode } from "@/lib/error-codes";

type AppErrorOptions = {
  status: number;
  code: ErrorCode;
  message: string;
  expose?: boolean;
};

export class AppError extends Error {
  status: number;
  code: ErrorCode;
  expose: boolean;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.status = options.status;
    this.code = options.code;
    this.expose = options.expose ?? true;
  }
}

export function unauthorizedError(message = "Bạn chưa đăng nhập.") {
  return new AppError({ status: 401, code: ErrorCodes.unauthorized, message });
}

export function forbiddenError(message = "Bạn không có quyền thực hiện thao tác này.") {
  return new AppError({ status: 403, code: ErrorCodes.forbidden, message });
}

export function validationError(message = "Dữ liệu không hợp lệ.") {
  return new AppError({ status: 400, code: ErrorCodes.validation, message });
}

export function notFoundError(message = "Không tìm thấy dữ liệu.") {
  return new AppError({ status: 404, code: ErrorCodes.notFound, message });
}

export function conflictError(message = "Dữ liệu bị xung đột.") {
  return new AppError({ status: 409, code: ErrorCodes.conflict, message });
}

export function externalServiceError(message = "Dịch vụ tích hợp đang tạm thời gián đoạn.") {
  return new AppError({ status: 502, code: ErrorCodes.externalService, message });
}

export function internalError(message = "Hệ thống đang bận, vui lòng thử lại.") {
  return new AppError({ status: 500, code: ErrorCodes.internal, message, expose: false });
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
