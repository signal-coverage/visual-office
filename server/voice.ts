import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { voiceRoomName } from "../shared/voice.ts";

export interface VoiceConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
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
    const config = { url: normalizeLiveKitUrl(url), apiKey, apiSecret };
    return { config, summary: `Voice chat is on, using ${config.url}` };
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

export function createVoiceAdmin(config: VoiceConfig): VoiceAdmin {
  // The admin API speaks http(s) on the same host the browsers reach with ws(s)
  const client = new RoomServiceClient(
    config.url.replace(/^ws/i, "http"),
    config.apiKey,
    config.apiSecret,
  );
  return {
    listParticipants: async (room) =>
      (await client.listParticipants(room)).map((p) => p.identity),
    removeParticipant: (room, identity) =>
      client.removeParticipant(room, identity),
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
): Promise<string> {
  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity,
    name,
    ttl: zone ? PRIVATE_TOKEN_TTL : TOKEN_TTL,
  });
  token.addGrant({
    room: voiceRoomName(zone),
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,
  });
  return token.toJwt();
}
