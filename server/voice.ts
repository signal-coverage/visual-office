import { AccessToken } from "livekit-server-sdk";
import { ROOM_NAME } from "../shared/constants.ts";

export interface VoiceConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
}

const TOKEN_TTL = "2h";

/**
 * Reads the LiveKit settings. The well-known `livekit-server --dev` credentials
 * are only used outside production, so a misconfigured deploy turns voice off
 * instead of running with public secrets.
 */
export function voiceConfigFromEnv(env: NodeJS.ProcessEnv): VoiceConfig | null {
  const isDev = env.NODE_ENV !== "production";
  const url = env.LIVEKIT_URL ?? (isDev ? "ws://localhost:7880" : undefined);
  const apiKey = env.LIVEKIT_API_KEY ?? (isDev ? "devkey" : undefined);
  const apiSecret = env.LIVEKIT_API_SECRET ?? (isDev ? "secret" : undefined);
  return url && apiKey && apiSecret ? { url, apiKey, apiSecret } : null;
}

/** Issues a short-lived token that lets one player join the office voice room. */
export async function createVoiceToken(
  config: VoiceConfig,
  identity: string,
  name: string,
): Promise<string> {
  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity,
    name,
    ttl: TOKEN_TTL,
  });
  token.addGrant({
    room: ROOM_NAME,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,
  });
  return token.toJwt();
}
