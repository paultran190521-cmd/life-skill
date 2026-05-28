import { NextResponse } from "next/server";
import { apiError, apiFailure, createId, createRequestId } from "@/lib/api";
import { appendAuditLog } from "@/lib/audit";
import { appendSheetRow, appendSheetRows, readSheetRows } from "@/lib/google-sheets";
import { evaluateRolePermission, requireSessionUser } from "@/lib/route-auth";

export async function GET() {
  const requestId = createRequestId("classes-list");
  try {
    return NextResponse.json(await readSheetRows("Classes"));
  } catch (error) {
    return apiError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId("class");
  try {
    const auth = await requireSessionUser(request);
    const permission = evaluateRolePermission(auth.user, "admin", "admin_only_classes_write");
    if (permission.decision === "would_block") {
      console.warn(`[auth-shadow][${requestId}] classes.create ${permission.reason}`);
    }
    if (!permission.allowed) {
      return apiFailure(403, "Bạn không có quyền thực hiện thao tác này.", undefined, requestId);
    }

    const body = await request.json();
    const schoolId = String(body.schoolId || "").trim();
    const name = String(body.name || "").trim();
    const namesInput = String(body.names || "").trim();
    const rawNames = namesInput || name;
    const academicYear = String(body.academicYear || "").trim();
    const manualGrade = String(body.grade || "").trim();

    if (!schoolId || !rawNames) {
      return apiFailure(400, "Thiếu thông tin bắt buộc của lớp.", undefined, requestId);
    }

    const schools = await readSheetRows("Schools");
    if (!schools.some((school) => school.id === schoolId)) {
      return apiFailure(400, "Trường đã chọn không tồn tại.", undefined, requestId);
    }

    const names = rawNames
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (names.length === 0) {
      return apiFailure(400, "Vui lòng nhập ít nhất một tên lớp.", undefined, requestId);
    }

    const now = new Date().toISOString();
    const classes: Array<Record<string, unknown>> = names.map((className, index) => ({
      id: index === 0 && body.id ? body.id : createId("c"),
      schoolId,
      name: className,
      grade: inferGradeFromClassName(className, manualGrade),
      academicYear,
      createdAt: now,
      updatedAt: now,
    }));

    if (classes.length === 1) {
      await appendSheetRow("Classes", classes[0]);
      await appendAuditLog({
        requestId,
        actor: auth.user,
        action: "class.create",
        entityType: "Class",
        entityId: String(classes[0].id),
        route: "/api/classes",
        method: "POST",
        authMode: permission.authMode,
        decision: permission.decision,
        reason: permission.reason,
        source: auth.source,
        after: classes[0],
      });
      return NextResponse.json(classes[0]);
    }

    await appendSheetRows("Classes", classes);
    await Promise.all(
      classes.map((classRow: Record<string, unknown>) =>
        appendAuditLog({
          requestId,
          actor: auth.user,
          action: "class.create",
          entityType: "Class",
          entityId: String(classRow.id),
          route: "/api/classes",
          method: "POST",
          authMode: permission.authMode,
          decision: permission.decision,
          reason: permission.reason,
          source: auth.source,
          after: classRow,
        }),
      ),
    );
    return NextResponse.json({ classes });
  } catch (error) {
    return apiError(error, requestId);
  }
}

function inferGradeFromClassName(className: string, fallbackGrade: string) {
  const matched = className.match(/\d{1,2}/);
  if (!matched) {
    return fallbackGrade || "Chưa cập nhật";
  }

  const gradeNumber = Number(matched[0]);
  if (!Number.isFinite(gradeNumber) || gradeNumber <= 0) {
    return fallbackGrade || "Chưa cập nhật";
  }

  return `Khối ${gradeNumber}`;
}
