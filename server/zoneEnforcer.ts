import { voiceRoomName } from "../shared/voice.ts";
import type { VoiceAdmin } from "./voice.ts";

/**
 * Who is in a voice room without having been sent there. `issuedZoneOf` says
 * which zone's room the server last gave somebody credentials for; it returns
 * undefined for anyone this game room does not know, who is never touched
 * (other game rooms share the same voice rooms).
 */
export function identitiesToEvict(
  present: string[],
  zone: string | null,
  issuedZoneOf: (identity: string) => string | null | undefined,
): string[] {
  return present.filter((identity) => {
    const issued = issuedZoneOf(identity);
    return issued !== undefined && issued !== zone;
  });
}

/**
 * Removes from every voice room the players who should not be there. Honest
 * clients switch rooms on their own; this is the backstop for one that does
 * not, or that rejoins with a token it no longer should use.
 * A room that cannot be checked is skipped, so one failure never stops the rest.
 */
export async function enforceZones(
  admin: VoiceAdmin,
  zones: (string | null)[],
  issuedZoneOf: (identity: string) => string | null | undefined,
): Promise<string[]> {
  const evicted: string[] = [];
  for (const zone of zones) {
    const room = voiceRoomName(zone);
    try {
      const present = await admin.listParticipants(room);
      for (const identity of identitiesToEvict(present, zone, issuedZoneOf)) {
        await admin.removeParticipant(room, identity);
        evicted.push(identity);
      }
    } catch (error) {
      console.warn(`Could not check who is in voice room ${room}`, error);
    }
  }
  return evicted;
}
