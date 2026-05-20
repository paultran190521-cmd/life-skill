import { createHash } from "node:crypto";

/**
 * Generates an avatar URL based on the user's email.
 * If the email is registered on Gravatar, it uses their custom Gravatar picture.
 * Otherwise, it falls back to a beautiful initial-based avatar (UI Avatars) with the brand color #1992b0.
 */
export function getAvatarUrl(email: string | undefined, name: string) {
  const displayName = name || "User";
  if (!email) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1992b0&color=fff&size=128`;
  }
  
  const cleanEmail = email.trim().toLowerCase();
  const hash = createHash("md5").update(cleanEmail).digest("hex");
  
  const fallbackUrl = encodeURIComponent(
    `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1992b0&color=fff&size=128`
  );
  
  return `https://www.gravatar.com/avatar/${hash}?d=${fallbackUrl}`;
}
