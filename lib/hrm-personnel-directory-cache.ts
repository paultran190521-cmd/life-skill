import { revalidateTag, unstable_cache } from "next/cache";
import { getMettasoulPersonnelDirectoryFromHrm } from "@/lib/hrm-integration";

const personnelDirectoryTag = "hrm-personnel-directory";
type TeacherIdentity = { id: string; email: string; name: string };

// A successful HRM lookup can serve subsequent admin views across requests.
// The roster is part of the key, so newly added teachers are fetched afresh.
const readCachedPersonnelDirectory = unstable_cache(
  (teachers: TeacherIdentity[]) => getMettasoulPersonnelDirectoryFromHrm(teachers),
  ["hrm-personnel-directory-v1"],
  { revalidate: 120, tags: [personnelDirectoryTag] },
);

export function readPersonnelDirectory(teachers: TeacherIdentity[]) {
  return readCachedPersonnelDirectory(teachers);
}

export function invalidatePersonnelDirectory() {
  revalidateTag(personnelDirectoryTag, { expire: 0 });
}
