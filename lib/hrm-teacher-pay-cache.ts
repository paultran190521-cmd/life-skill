import { revalidateTag, unstable_cache } from "next/cache";
import { getTeacherPaySetupFromHrm } from "@/lib/hrm-integration";

const teacherPayTag = "hrm-teacher-pay-setup";
type TeacherIdentity = { id: string; email: string; name: string };

// Cache only a successful HRM read. The teacher roster is an argument, so a
// newly added teacher gets a different cache key without waiting for the TTL.
const readCachedTeacherPaySetup = unstable_cache(
  (teachers: TeacherIdentity[]) => getTeacherPaySetupFromHrm(teachers),
  ["hrm-teacher-pay-setup-v1"],
  { revalidate: 120, tags: [teacherPayTag] },
);

export async function readTeacherPaySetup(teachers: TeacherIdentity[], fresh = false) {
  if (!fresh) return readCachedTeacherPaySetup(teachers);
  const result = await getTeacherPaySetupFromHrm(teachers);
  // Keep the last good cache entry if a manual refresh cannot reach HRM.
  revalidateTag(teacherPayTag, { expire: 0 });
  return result;
}

export function invalidateTeacherPaySetup() {
  revalidateTag(teacherPayTag, { expire: 0 });
}
