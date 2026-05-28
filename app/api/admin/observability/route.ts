import { NextResponse } from "next/server";
import { apiError, createRequestId } from "@/lib/api";
import { checkEmailProviderHealth, checkGasMailHealth, checkSheetsHealth, summarizeHealthStatus } from "@/lib/admin-health";
import { forbiddenError } from "@/lib/app-error";
import { readSheetRows } from "@/lib/google-sheets";
import { evaluateRolePermission, requireSessionUser } from "@/lib/route-auth";

type ParsedAuditEvent = {
  action: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export async function GET(request: Request) {
  const requestId = createRequestId("obs");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_observability");
    if (!permission.allowed) {
      throw forbiddenError();
    }

    const url = new URL(request.url);
    const windowHours = normalizeWindowHours(url.searchParams.get("windowHours"));
    const cutoff = Date.now() - windowHours * 60 * 60 * 1000;
    const cutoff1h = Date.now() - 60 * 60 * 1000;

    const rows = await readSheetRows("AuditLogs");
    const events = rows
      .map(parseAuditEvent)
      .filter((item): item is ParsedAuditEvent => Boolean(item))
      .filter((item) => Date.parse(item.createdAt) >= cutoff);

    const decisions = {
      allow: 0,
      deny: 0,
      would_block: 0,
    };
    const byRoute = new Map<string, { total: number; denied: number }>();
    const byReason = new Map<string, number>();
    const byCode = new Map<string, number>();
    const byAction = new Map<string, number>();

    for (const event of events) {
      const route = String(event.metadata.route || "unknown");
      const decision = String(event.metadata.decision || "");
      const reason = String(event.metadata.reason || "");
      const code = String(event.metadata.code || "");

      const routeStats = byRoute.get(route) || { total: 0, denied: 0 };
      routeStats.total += 1;
      if (decision === "deny") {
        routeStats.denied += 1;
      }
      byRoute.set(route, routeStats);

      if (decision === "allow") {
        decisions.allow += 1;
      } else if (decision === "deny") {
        decisions.deny += 1;
      } else if (decision === "would_block") {
        decisions.would_block += 1;
      }

      if (reason) {
        byReason.set(reason, (byReason.get(reason) || 0) + 1);
      }
      if (event.action === "api.error" && code) {
        byCode.set(code, (byCode.get(code) || 0) + 1);
      }
      byAction.set(event.action, (byAction.get(event.action) || 0) + 1);
    }

    const recent1h = events.filter((event) => Date.parse(event.createdAt) >= cutoff1h);
    const deny1h = recent1h.filter((event) => String(event.metadata.decision || "") === "deny").length;
    const apiError1h = recent1h.filter((event) => event.action === "api.error").length;

    const [sheets, gasMail, emailProvider] = await Promise.all([
      checkSheetsHealth(),
      checkGasMailHealth(),
      checkEmailProviderHealth(),
    ]);
    const healthStatus = summarizeHealthStatus([sheets, gasMail, emailProvider]);

    const denyAlertThreshold = readNumberEnv("OBS_ALERT_DENY_1H", 20);
    const errorAlertThreshold = readNumberEnv("OBS_ALERT_ERROR_1H", 10);
    const alerts: Array<{ level: "warning" | "critical"; message: string }> = [];
    if (deny1h >= denyAlertThreshold) {
      alerts.push({
        level: "warning",
        message: `Số lượt deny trong 1 giờ gần nhất là ${deny1h}, vượt ngưỡng ${denyAlertThreshold}.`,
      });
    }
    if (apiError1h >= errorAlertThreshold) {
      alerts.push({
        level: "critical",
        message: `Số lỗi API trong 1 giờ gần nhất là ${apiError1h}, vượt ngưỡng ${errorAlertThreshold}.`,
      });
    }
    if (healthStatus !== "ok") {
      alerts.push({
        level: healthStatus === "down" ? "critical" : "warning",
        message: `Health check đang ở trạng thái ${healthStatus}.`,
      });
    }

    return NextResponse.json({
      requestId,
      checkedAt: new Date().toISOString(),
      windowHours,
      summary: {
        totalEvents: events.length,
        decisions,
        apiErrors: events.filter((event) => event.action === "api.error").length,
        deny1h,
        apiError1h,
      },
      topRoutes: sortMap(byRoute, 8).map(([route, value]) => ({ route, ...value })),
      topReasons: sortMap(byReason, 8).map(([reason, count]) => ({ reason, count })),
      topCodes: sortMap(byCode, 8).map(([code, count]) => ({ code, count })),
      topActions: sortMap(byAction, 8).map(([action, count]) => ({ action, count })),
      health: {
        status: healthStatus,
        services: {
          sheets,
          gas_mail: gasMail,
          email_provider: emailProvider,
        },
      },
      alerts,
    });
  } catch (error) {
    return apiError(error, requestId);
  }
}

function parseAuditEvent(row: Record<string, string>): ParsedAuditEvent | null {
  const createdAt = String(row.createdAt || "").trim();
  if (!createdAt) {
    return null;
  }

  const metadataRaw = String(row.metadata || "").trim();
  let metadata: Record<string, unknown> = {};
  if (metadataRaw) {
    try {
      const parsed = JSON.parse(metadataRaw) as Record<string, unknown>;
      metadata = parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      metadata = {};
    }
  }

  return {
    action: String(row.action || "").trim() || "unknown",
    createdAt,
    metadata,
  };
}

function sortMap<T>(map: Map<string, T>, limit: number) {
  return Array.from(map.entries()).sort((a, b) => {
    const valueA = typeof a[1] === "number" ? (a[1] as number) : Number((a[1] as { total?: number }).total || 0);
    const valueB = typeof b[1] === "number" ? (b[1] as number) : Number((b[1] as { total?: number }).total || 0);
    return valueB - valueA;
  }).slice(0, limit);
}

function normalizeWindowHours(rawValue: string | null) {
  const value = Number(rawValue || 48);
  if (!Number.isFinite(value)) {
    return 48;
  }
  return Math.min(720, Math.max(1, Math.floor(value)));
}

function readNumberEnv(key: string, fallback: number) {
  const value = Number(process.env[key] || fallback);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return value;
}
