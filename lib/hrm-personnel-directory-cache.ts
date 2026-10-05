import { createHash } from "node:crypto";
import { revalidateTag, unstable_cache } from "next/cache";
import { getMettasoulPersonnelDirectoryFromHrm } from "@/lib/hrm-integration";

const personnelDirectoryTag = "hrm-personnel-directory";
type TeacherIdentity = { id: string; email: string; name: string };

// A successful HRM lookup can serve subsequent admin views across requests.
// The roster is part of the key, so newly added teachers are fetched afresh.
export function readPersonnelDirectory(teachers: TeacherIdentity[]) {
  const rosterHash = createHash("sha256").update(JSON.stringify(teachers)).digest("hex");
  return unstable_cache(
    () => getMettasoulPersonnelDirectoryFromHrm(teachers),
    ["hrm-personnel-directory-v2", rosterHash],
    { revalidate: 120, tags: [personnelDirectoryTag] },
  )();
}

export function invalidatePersonnelDirectory() {
  revalidateTag(personnelDirectoryTag, { expire: 0 });
}
