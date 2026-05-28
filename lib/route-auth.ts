import { cookies } from "next/headers";
import { findAuthorizedUserFromHint, findAuthorizedUserFromSession } from "@/lib/auth-users";
import { sessionCookieName, verifySessionToken } from "@/lib/auth-session";
import { forbiddenError, unauthorizedError } from "@/lib/app-error";
import type { Role, User } from "@/lib/types";

export type AuthMode = "shadow" | "enforce";
export type AuthSource = "session" | "header" | "system" | "email-token";
export type PermissionDecision = "allow" | "would_block" | "deny";

export type SessionAuthResult = {
  user: User;
  source: AuthSource;
  authMode: AuthMode;
};

type EvaluatePermissionInput = {
  allowed: boolean;
  reason: string;
};

export function getAuthEnforcementMode(): AuthMode {
  return process.env.AUTH_ENFORCEMENT_MODE === "enforce" ? "enforce" : "shadow";
}

type RequireSessionUserOptions = {
  allowHeaderFallback?: boolean;
};

export async function requireSessionUser(
  request: Request,
  options: RequireSessionUserOptions = {},
): Promise<SessionAuthResult> {
  const authMode = getAuthEnforcementMode();
  const allowHeaderFallback = options.allowHeaderFallback ?? true;
  const cookieStore = await cookies();
  const session = verifySessionToken(cookieStore.get(sessionCookieName)?.value);

  if (session) {
    const userFromSession = await findAuthorizedUserFromSession(session.userId, session.email);
    if (userFromSession) {
      return { user: userFromSession, source: "session", authMode };
    }
  }

  if (allowHeaderFallback && authMode === "shadow") {
    const userFromHeader = await findAuthorizedUserFromHint(
      request.headers.get("x-app-user-id"),
      request.headers.get("x-app-user-email"),
    );
    if (userFromHeader) {
      return { user: userFromHeader, source: "header", authMode };
    }
  }

  throw unauthorizedError();
}

export function requireRole(user: User, role: Role | Role[]) {
  const allowedRoles = Array.isArray(role) ? role : [role];
  if (!allowedRoles.includes(user.role)) {
    throw forbiddenError();
  }
}

export function assertTeacherOwnsResource(user: User, resourceTeacherId: string) {
  if (user.role === "admin") {
    return;
  }
  if (!resourceTeacherId || user.teacherId !== resourceTeacherId) {
    throw forbiddenError();
  }
}

export function evaluatePermission(input: EvaluatePermissionInput): {
  allowed: boolean;
  decision: PermissionDecision;
  reason: string;
  authMode: AuthMode;
} {
  const authMode = getAuthEnforcementMode();
  if (input.allowed) {
    return { allowed: true, decision: "allow", reason: "", authMode };
  }

  if (authMode === "shadow") {
    return { allowed: true, decision: "would_block", reason: input.reason, authMode };
  }

  return { allowed: false, decision: "deny", reason: input.reason, authMode };
}

export function evaluateRolePermission(user: User, role: Role | Role[], reason: string) {
  const allowedRoles = Array.isArray(role) ? role : [role];
  return evaluatePermission({ allowed: allowedRoles.includes(user.role), reason });
}
