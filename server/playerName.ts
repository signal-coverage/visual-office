import { cleanName, sanitizeName } from "../shared/name.ts";

/**
 * The name a player gets in the office. Somebody who signed in is called what
 * their profile says, unless the company lets people choose: then what they
 * asked for, or the profile name when that is empty or not a name. Somebody
 * who did not sign in is called what they asked for.
 */
export function nameForPlayer({
  profileName,
  allowEdit,
  requested,
}: {
  /** The name of the signed-in person's profile, or null when sign-in is off. */
  profileName: string | null;
  /** Whether the company lets people choose their own name. */
  allowEdit: boolean;
  /** What the client sent: untrusted. */
  requested: unknown;
}): string {
  if (profileName === null) return sanitizeName(requested);
  if (!allowEdit) return profileName;
  return cleanName(requested) || profileName;
}
