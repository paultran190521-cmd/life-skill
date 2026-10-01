import assert from "node:assert/strict";
import { normalizeSchoolNeedInput, planSchoolNeedImport, schoolNeedRequiresReview, schoolNeedRevision } from "../lib/school-teaching-needs.ts";

const schools = [{ id: "s-nsg", name: "Trường Tiểu học Nam Sài Gòn", district: "" }];
const classes = [{ id: "c-21", schoolId: "s-nsg", name: "2/1", grade: "2" }, { id: "c-22", schoolId: "s-nsg", name: "2/2", grade: "2" }];
const row = { date: "01/10/2026", school: "TRƯỜNG TIỂU HỌC NAM SÀI GÒN", className: "2/1", session: "Sáng", periodLabel: "Tiết 1", start: "7:30", end: "08:05", environment: "Trong lớp" };
const normalized = normalizeSchoolNeedInput(row, schools, classes);
assert.equal(normalized.date, "2026-10-01");
assert.equal(normalizeSchoolNeedInput({ ...row, date: "1/10/2026" }, schools, classes).date, "2026-10-01");
assert.equal(normalized.start, "07:30");
assert.equal(normalized.classId, "c-21");
assert.equal(normalized.teachingEnvironment, "in_class");
assert.throws(() => normalizeSchoolNeedInput({ ...row, className: "3/9" }, schools, classes), /không thuộc/);
assert.throws(() => normalizeSchoolNeedInput({ ...row, session: "Chiều" }, schools, classes), /không khớp/);
assert.throws(() => normalizeSchoolNeedInput({ ...row, date: "31/02/2026" }, schools, classes), /Ngày dạy/);

const existing = [{ ...normalized, id: "need-1", status: "OPEN", scheduleId: "", createdAt: "t1", updatedAt: "t1" }];
assert.equal(planSchoolNeedImport([normalized], existing)[0].action, "SAME");
assert.equal(planSchoolNeedImport([{ ...normalized, id: "need-1", start: "08:10" }], existing)[0].action, "CHANGED");
assert.equal(planSchoolNeedImport([{ ...normalized, classId: "c-22" }], existing)[0].action, "NEW");
assert.throws(() => planSchoolNeedImport([normalized, normalized], existing), /trùng/);
assert.throws(() => planSchoolNeedImport([{ ...normalized, id: "unknown" }], existing), /mã dòng/);
assert.throws(() => planSchoolNeedImport([{ ...normalized, id: "need-1", classId: "c-22" }], [...existing, { ...existing[0], id: "need-2", classId: "c-22" }]), /thuộc một dòng lịch khác/);
const assigned = { ...existing[0], scheduleId: "sch-1", status: "ASSIGNED" };
assert.equal(schoolNeedRequiresReview(assigned, { ...normalized, sourceNote: "Trường xác nhận" }), false);
assert.equal(schoolNeedRequiresReview(assigned, { ...normalized, start: "08:10" }), true);
assert.notEqual(schoolNeedRevision(existing), schoolNeedRevision([{ ...existing[0], updatedAt: "t2" }]));
console.log("School teaching need import checks passed.");
