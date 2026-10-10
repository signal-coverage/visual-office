/** What the server sends a player so they can join the voice room. */
export interface VoiceCredentials {
  url: string;
  token: string;
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
