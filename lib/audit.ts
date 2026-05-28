import { createId } from "@/lib/api";
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
  const now = new Date().toISOString();
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

  await appendSheetRows("AuditLogs", [
    {
      id: createId("audit"),
      actorId: input.actor.id,
      actorEmail: input.actor.email,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: JSON.stringify(metadata),
      createdAt: now,
    },
  ]);
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
