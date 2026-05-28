export const ErrorCodes = {
  unauthorized: "UNAUTHORIZED",
  forbidden: "FORBIDDEN",
  validation: "VALIDATION_ERROR",
  externalService: "EXTERNAL_SERVICE_ERROR",
  notFound: "NOT_FOUND",
  conflict: "CONFLICT",
  internal: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
