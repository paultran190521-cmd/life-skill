import { appendSheetRows } from "@/lib/google-sheets";
import type { AuthMode, AuthSource, PermissionDecision } from "@/lib/route-auth";
import type { User } from "@/lib/types";

type JsonObject = Record<string, unknown>;

type AuditInput = {
  requestId: string;
  actor: Pick<User, "id" | "email">;
  action: string;
  entityType: string;
  entityId: string;
  route: string;
  method: string;
  authMode: AuthMode;
  decision: PermissionDecision;
  reason?: string;
  source?: AuthSource;
  before?: JsonObject;
  after?: JsonObject;
};

export async function appendAuditLog(input: AuditInput) {
  await appendAuditLogs([input]);
}

export async function appendAuditLogs(inputs: AuditInput[]) {
  if (inputs.length === 0) {
    return;
  }

  const now = new Date().toISOString();
  const rows = inputs.map((input) => {
    const metadata: JsonObject = {
      requestId: input.requestId,
      route: input.route,
      method: input.method,
      authMode: input.authMode,
      decision: input.decision,
      reason: input.reason || "",
      source: input.source || "session",
    };

    if (input.before) {
      metadata.before = input.before;
    }
    if (input.after) {
      metadata.after = input.after;
    }
    if (input.before && input.after) {
      metadata.changedFields = computeChangedFields(input.before, input.after);
    }

    return {
      id: createAuditId(),
      actorId: input.actor.id,
      actorEmail: input.actor.email,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: JSON.stringify(metadata),
      createdAt: now,
    };
  });

  await appendSheetRows("AuditLogs", rows);
}

type ApiErrorEventInput = {
  requestId: string;
  code: string;
  status: number;
  message: string;
  route?: string;
  method?: string;
  actorId?: string;
  actorEmail?: string;
};

export function queueApiErrorEvent(input: ApiErrorEventInput) {
  const now = new Date().toISOString();
  const metadata: JsonObject = {
    requestId: input.requestId,
    code: input.code,
    status: input.status,
    message: input.message,
    route: input.route || "",
    method: input.method || "",
    eventType: "api_error",
  };

  void appendSheetRows("AuditLogs", [
    {
      id: createAuditId(),
      actorId: input.actorId || "system",
      actorEmail: input.actorEmail || "",
      action: "api.error",
      entityType: "API",
      entityId: input.requestId,
      metadata: JSON.stringify(metadata),
      createdAt: now,
    },
  ]).catch((error) => {
    console.error(`[audit-log-failed][${input.requestId}]`, error);
  });
}

function computeChangedFields(before: JsonObject, after: JsonObject) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  for (const key of keys) {
    if (String(before[key] ?? "") !== String(after[key] ?? "")) {
      changed.push(key);
    }
  }
  return changed;
}

function createAuditId() {
  return `audit-${crypto.randomUUID().slice(0, 8)}`;
}
