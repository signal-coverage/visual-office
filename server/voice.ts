import {
  AccessToken,
  RoomServiceClient,
  TrackSource,
} from "livekit-server-sdk";
import { voiceRoomName } from "../shared/voice.ts";

export interface VoiceConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
  /**
   * In front of every room name, so several companies can share one LiveKit
   * project without their "office" rooms being the same room. Empty for a
   * single company.
   */
  roomPrefix?: string;
}

/**
 * What somebody may publish in the call of a zone (the shared office call when
 * `zone` is null). A screen is shared in private rooms, where there is a screen
 * to show it on; somebody who may not speak (a moderator muted them) keeps their camera.
 */
export function voiceSources(
  zone: string | null,
  canSpeak: boolean,
): TrackSource[] {
  return [
    ...(canSpeak ? [TrackSource.MICROPHONE] : []),
    TrackSource.CAMERA,
    ...(zone ? [TrackSource.SCREEN_SHARE] : []),
  ];
}

const TOKEN_TTL = "2h";
const PRIVATE_TOKEN_TTL = "2m";

export interface VoiceStatus {
  config: VoiceConfig | null;
  /** One line for the startup log. It never contains the key or the secret. */
  summary: string;
}

/** A variable pasted from a dashboard may carry spaces or a line break; an empty one counts as unset. */
const clean = (value: string | undefined) => value?.trim() || undefined;

/** A company's name as the start of a room name: letters, digits and dashes, short, ending in a dash (or nothing). */
export function roomPrefixFromEnv(raw: string | undefined): string {
  const name = (raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/g, "");
  return name ? `${name}-` : "";
}

/**
 * The browser SDK connects with ws:// or wss://, but dashboards and docs often
 * show the same address as https://, or without any scheme.
 */
export function normalizeLiveKitUrl(raw: string): string {
  const url = raw.trim().replace(/\/+$/, "");
  if (/^https:\/\//i.test(url)) return url.replace(/^https:\/\//i, "wss://");
  if (/^http:\/\//i.test(url)) return url.replace(/^http:\/\//i, "ws://");
  if (/^wss?:\/\//i.test(url)) return url;
  return `wss://${url}`;
}

/**
 * Reads the LiveKit settings. The well-known `livekit-server --dev` credentials
 * are only used outside production, so a misconfigured deploy turns voice off
 * instead of running with public secrets, and says why.
 */
export function voiceStatusFromEnv(env: NodeJS.ProcessEnv): VoiceStatus {
  const isDev = env.NODE_ENV !== "production";
  const url =
    clean(env.LIVEKIT_URL) ?? (isDev ? "ws://localhost:7880" : undefined);
  const apiKey = clean(env.LIVEKIT_API_KEY) ?? (isDev ? "devkey" : undefined);
  const apiSecret =
    clean(env.LIVEKIT_API_SECRET) ?? (isDev ? "secret" : undefined);

  if (url && apiKey && apiSecret) {
    const roomPrefix = roomPrefixFromEnv(env.VOICE_ROOM_PREFIX);
    const config: VoiceConfig = {
      url: normalizeLiveKitUrl(url),
      apiKey,
      apiSecret,
      // Only when there is one, so a single company's settings are what they always were
      ...(roomPrefix ? { roomPrefix } : {}),
    };
    return {
      config,
      summary: `Voice chat is on, using ${config.url}${config.roomPrefix ? ` (rooms start with ${config.roomPrefix})` : ""}`,
    };
  }

  const missing = [
    ["LIVEKIT_URL", url],
    ["LIVEKIT_API_KEY", apiKey],
    ["LIVEKIT_API_SECRET", apiSecret],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  const summary =
    missing.length === 3
      ? "Voice chat is off: set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET to turn it on"
      : `Voice chat is off: missing ${missing.join(", ")}`;
  return { config: null, summary };
}

export function voiceConfigFromEnv(env: NodeJS.ProcessEnv): VoiceConfig | null {
  return voiceStatusFromEnv(env).config;
}

/** The little LiveKit administration the server needs: see who is in a room and remove somebody. */
export interface VoiceAdmin {
  listParticipants: (room: string) => Promise<string[]>;
  removeParticipant: (room: string, identity: string) => Promise<void>;
}

/** What a moderator may do to somebody in a call. */
export interface VoiceModeration {
  /**
   * Takes the microphone away from somebody in a call (or gives it back): what
   * they may publish changes at once, and a microphone already on is muted. Does
   * nothing for somebody who is not in the call.
   */
  setCanSpeak: (
    room: string,
    identity: string,
    zone: string | null,
    canSpeak: boolean,
  ) => Promise<void>;
}

/** What `VoiceAdmin` uses of LiveKit's room service: so it can be tried without one. */
export type RoomClient = Pick<
  RoomServiceClient,
  | "listParticipants"
  | "removeParticipant"
  | "getParticipant"
  | "updateParticipant"
  | "mutePublishedTrack"
>;

/**
 * LiveKit answers "not found" when asked about a room nobody is in (it deletes
 * a room as soon as the last person leaves). That is an empty room, not a failure.
 */
export function isRoomMissing(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { status, code } = error as { status?: unknown; code?: unknown };
  return status === 404 || code === "not_found";
}

export function createVoiceAdmin(
  config: VoiceConfig,
  // The admin API speaks http(s) on the same host the browsers reach with ws(s)
  client: RoomClient = new RoomServiceClient(
    config.url.replace(/^ws/i, "http"),
    config.apiKey,
    config.apiSecret,
  ),
): VoiceAdmin & VoiceModeration {
  return {
    listParticipants: async (room) => {
      try {
        return (await client.listParticipants(room)).map((p) => p.identity);
      } catch (error) {
        if (isRoomMissing(error)) return [];
        throw error;
      }
    },
    removeParticipant: (room, identity) =>
      client.removeParticipant(room, identity),
    setCanSpeak: async (room, identity, zone, canSpeak) => {
      try {
        await client.updateParticipant(room, identity, undefined, {
          canPublish: true,
          canSubscribe: true,
          canPublishData: false,
          canPublishSources: voiceSources(zone, canSpeak),
        });
        if (canSpeak) return;
        // A microphone that is already on keeps going unless it is muted too
        const participant = await client.getParticipant(room, identity);
        for (const track of participant.tracks)
          if (track.source === TrackSource.MICROPHONE && !track.muted)
            await client.mutePublishedTrack(room, identity, track.sid, true);
      } catch (error) {
        // Not in the call (yet): the token they get next already says what they may publish
        if (isRoomMissing(error)) return;
        throw error;
      }
    },
  };
}

/**
 * Issues a short-lived token that lets one player join the voice room of their
 * zone (the shared office call when `zone` is null). A private zone's token
 * expires fast: it is only needed at the moment of joining, and a stale one
 * must not let somebody who walked out of the meeting back in.
 */
export async function createVoiceToken(
  config: VoiceConfig,
  identity: string,
  name: string,
  zone: string | null = null,
  canSpeak = true,
  /** The floor whose voice room it is: every floor has its own. */
  floor?: string,
): Promise<string> {
  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity,
    name,
    ttl: zone ? PRIVATE_TOKEN_TTL : TOKEN_TTL,
  });
  token.addGrant({
    room: voiceRoomName(zone, config.roomPrefix, floor),
    roomJoin: true,
    canPublish: true,
    // Sharing a screen is for private rooms, where there is a screen to show it on
    canPublishSources: voiceSources(zone, canSpeak),
    canSubscribe: true,
    canPublishData: false,
  });
  return token.toJwt();
}
