import { ROOM_NAME } from "./constants.ts";

/** What the server sends a player so they can join a voice room. */
export interface VoiceCredentials {
  url: string;
  token: string;
  /**
   * The private zone this call belongs to, or null for the shared office call.
   * It is what the client is actually connected to that decides who it hears,
   * not where the player happens to be standing a moment later.
   */
  zone: string | null;
}

/**
 * The LiveKit room for a zone. Each private zone gets a room of its own: that
 * is what keeps its audio and video away from everyone else, enforced by the
 * server through the token, not by the client's good manners.
 *
 * `prefix` names the company when several share one LiveKit project: without
 * it their "office" rooms would be the same room.
 */
export function voiceRoomName(zone: string | null, prefix = ""): string {
  return `${prefix}${zone ? `${ROOM_NAME}-${zone}` : ROOM_NAME}`;
}

/** Within this distance (meters) other players are heard at full volume. */
export const VOICE_FULL_VOLUME_DISTANCE = 2;
/** Beyond this distance (meters) other players cannot be heard at all. */
export const VOICE_MAX_DISTANCE = 10;

/** Video is only received from people closer than this (meters). */
export const VIDEO_SUBSCRIBE_DISTANCE = 6;
/** ...and kept until they get farther than this, so it does not flicker at the edge. */
export const VIDEO_UNSUBSCRIBE_DISTANCE = 8;

/** Whether to be receiving someone's video, given how far they are and whether we already are. */
export function wantsVideo(
  distance: number,
  alreadyReceiving: boolean,
): boolean {
  if (!Number.isFinite(distance)) return false;
  return (
    distance <
    (alreadyReceiving ? VIDEO_UNSUBSCRIBE_DISTANCE : VIDEO_SUBSCRIBE_DISTANCE)
  );
}

/**
 * Volume (0..1) for someone in the same call. Inside a private zone everybody
 * present is heard at full volume (a meeting is not a hallway); in the open
 * office it fades with distance.
 */
export function peerVolume(distance: number, zone: string | null): number {
  return zone ? 1 : proximityVolume(distance);
}

/** Whether to be receiving someone's video: everyone in a private zone, otherwise by proximity. */
export function peerWantsVideo(
  distance: number,
  alreadyReceiving: boolean,
  zone: string | null,
): boolean {
  return zone ? true : wantsVideo(distance, alreadyReceiving);
}

/** Volume (0..1) at which someone `distance` meters away should be heard. */
export function proximityVolume(distance: number): number {
  if (!Number.isFinite(distance)) return 0;
  if (distance <= VOICE_FULL_VOLUME_DISTANCE) return 1;
  if (distance >= VOICE_MAX_DISTANCE) return 0;
  return (
    1 -
    (distance - VOICE_FULL_VOLUME_DISTANCE) /
      (VOICE_MAX_DISTANCE - VOICE_FULL_VOLUME_DISTANCE)
  );
}
