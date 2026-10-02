import { appNeedDiffersFromEffective, isIntakeRowDirty, mirrorAppNeedToIntake } from "@/lib/school-intake-bidirectional";
import { ensureSheetHeaders, readSheetRowsBatch, schoolTeachingNeedHeaders } from "@/lib/google-sheets";
import { intakeInputFirstDataRow, intakeInputLastRow, readIntakeTab } from "@/lib/school-intake-storage";
import type { ClassRoom, School, SchoolTeachingNeed } from "@/lib/types";

/** Retry only already-linked, clean rows. Never overwrite a Sheet draft or a pending approval. */
export async function reconcileLinkedSchoolNeeds(limit = 5) {
  await ensureSheetHeaders("SchoolTeachingNeeds", schoolTeachingNeedHeaders);
  const [data, input, effective] = await Promise.all([
    readSheetRowsBatch(["SchoolTeachingNeeds", "Schools", "Classes"] as const),
    readIntakeTab("Nhập lịch", "T", intakeInputLastRow),
    readIntakeTab("Lịch hiệu lực", "O", 1000),
  ]);
  const needs = data.SchoolTeachingNeeds as unknown as SchoolTeachingNeed[];
  const schools = data.Schools as unknown as School[];
  const classes = data.Classes as unknown as ClassRoom[];
  const inputByAppId = new Map(input.slice(intakeInputFirstDataRow - 1).filter((row) => row[17]).map((row) => [row[17], row]));
  const effectiveByAppId = new Map(effective.slice(1).filter((row) => row[12]).map((row) => [row[12], row]));
  let repaired = 0, conflicts = 0, failed = 0;
  for (const need of needs) {
    if (repaired >= limit) break;
    const entered = inputByAppId.get(need.id);
    const approved = effectiveByAppId.get(need.id);
    if (!entered || !approved) continue;
    if (isIntakeRowDirty(entered, approved)) { conflicts++; continue; }
    try {
      if (!appNeedDiffersFromEffective(need, approved, schools, classes)) continue;
      await mirrorAppNeedToIntake(need, need, "system:retry", schools, classes);
      repaired++;
    }
    catch (error) { failed++; console.error("School intake row retry failed", { needId: need.id, error }); }
  }
  return { repaired, conflicts, failed };
}
