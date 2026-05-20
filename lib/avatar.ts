/**
 * Generates a default initial-based avatar (UI Avatars) with the brand color #1992b0.
 * Gravatar is not used. Instead, we display clean letter-based initials.
 * The actual personal profile picture is synchronized directly from their Google account when they log in.
 */
export function getAvatarUrl(email: string | undefined, name: string) {
  const displayName = name || "User";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1992b0&color=fff&size=128`;
}
