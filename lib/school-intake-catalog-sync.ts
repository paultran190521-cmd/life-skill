import { after } from "next/server";
import { readSheetRowsBatch } from "@/lib/google-sheets";
import { buildSchoolNeedTemplateCatalog } from "@/lib/school-need-template";
import { replaceIntakeCatalog } from "@/lib/school-intake-storage";
import { isDoubleTeachingTimeSlot, isTimeSlotAllowedForSchool } from "@/lib/time-slots";
import type { ClassRoom, School, TimeSlot } from "@/lib/types";

const environments = ["Trong lớp", "Ngoài sân", "Nhà thi đấu", "Hội trường", "Báo cáo chuyên đề"];
const statuses = ["Dạy", "Trường hủy tiết"];

export async function syncSchoolIntakeCatalog() {
  const data = await readSheetRowsBatch(["Schools", "Classes", "TimeSlots"] as const);
  const schools = (data.Schools as unknown as School[]).filter((row) => row.id && row.name);
  const classes = (data.Classes as unknown as ClassRoom[]).filter((row) => row.id && row.schoolId && row.name && row.grade);
  const slots = data.TimeSlots as unknown as TimeSlot[];
  const catalog = buildSchoolNeedTemplateCatalog(schools, classes, slots, isTimeSlotAllowedForSchool, isDoubleTeachingTimeSlot, { includeDouble: true });
  const periods = catalog.periods;
  const readySchools = schools.filter((school) => classes.some((row) => row.schoolId === school.id) && periods.some((row) => row.school === school.name));
  const readyIds = new Set(readySchools.map((row) => row.id));
  const readyNames = new Set(readySchools.map((row) => row.name));
  const readyClasses = classes.filter((row) => readyIds.has(row.schoolId));
  const readyPeriods = periods.filter((row) => readyNames.has(row.school));
  if (!readySchools.length || !readyClasses.length || !readyPeriods.length) throw new Error("METTASOUL chưa có trường đủ lớp và khung giờ; giữ nguyên danh mục Sheet.");
  const rows = Array.from({ length: Math.max(readySchools.length, readyClasses.length, readyPeriods.length, 5) }, (_, index) => {
    const school = readySchools[index];
    const classroom = readyClasses[index];
    const period = readyPeriods[index];
    return [
      school?.name || "", school?.id || "", "",
      readySchools.find((item) => item.id === classroom?.schoolId)?.name || "", classroom?.grade || "", classroom?.name || "", classroom?.id || "", "",
      period?.school || "", period?.session || "", period?.label || "", period?.start || "", period?.end || "",
      period ? `${period.school}|${period.session}|${period.label}` : "", "",
      environments[index] || "", statuses[index] || "",
    ];
  });
  return replaceIntakeCatalog(rows, readySchools.map((row) => row.name), {
    schools: readySchools.length, classes: readyClasses.length, periods: readyPeriods.length,
  });
}

/** Refresh the intake choices after a successful catalog mutation without slowing the admin response. */
export function queueSchoolIntakeCatalogSync() {
  after(async () => {
    try { await syncSchoolIntakeCatalog(); }
    catch (error) { console.error("School intake catalog sync after update failed", error); }
  });
}
