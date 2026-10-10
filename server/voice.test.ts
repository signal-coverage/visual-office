import { TokenVerifier } from "livekit-server-sdk";
import { describe, expect, it } from "vitest";
import { ROOM_NAME } from "../shared/constants.ts";
import { createVoiceToken, voiceConfigFromEnv } from "./voice.ts";

describe("voiceConfigFromEnv", () => {
  it("falls back to LiveKit dev defaults outside production", () => {
    expect(voiceConfigFromEnv({})).toEqual({
      url: "ws://localhost:7880",
      apiKey: "devkey",
      apiSecret: "secret",
    });
  });

  it("reads explicit configuration", () => {
    const env = {
      LIVEKIT_URL: "wss://x.example",
      LIVEKIT_API_KEY: "k",
      LIVEKIT_API_SECRET: "s",
    };
    expect(voiceConfigFromEnv(env)).toEqual({
      url: "wss://x.example",
      apiKey: "k",
      apiSecret: "s",
    });
  });

  it("disables voice in production when credentials are missing (never uses dev secrets)", () => {
    expect(voiceConfigFromEnv({ NODE_ENV: "production" })).toBeNull();
  });

  it("works in production when everything is configured", () => {
    const env = {
      NODE_ENV: "production",
      LIVEKIT_URL: "wss://x.example",
      LIVEKIT_API_KEY: "k",
      LIVEKIT_API_SECRET: "s",
    };
    expect(voiceConfigFromEnv(env)).not.toBeNull();
  });
});

describe("createVoiceToken", () => {
  const config = {
    url: "ws://localhost:7880",
    apiKey: "devkey",
    apiSecret: "a-long-enough-test-secret-value",
  };

  it("issues a token bound to the player identity and the office room only", async () => {
    const token = await createVoiceToken(config, "session-123", "Alice");
    const claims = await new TokenVerifier(
      config.apiKey,
      config.apiSecret,
    ).verify(token);

    expect(claims.sub).toBe("session-123");
    expect(claims.name).toBe("Alice");
    expect(claims.video?.room).toBe(ROOM_NAME);
    expect(claims.video?.roomJoin).toBe(true);
    expect(claims.video?.canPublish).toBe(true);
    expect(claims.video?.canSubscribe).toBe(true);
    expect(claims.video?.roomAdmin).toBeFalsy();
  });

  it("is rejected when verified with a different secret", async () => {
    const token = await createVoiceToken(config, "session-123", "Alice");
    await expect(
      new TokenVerifier(
        config.apiKey,
        "another-secret-entirely-different",
      ).verify(token),
    ).rejects.toThrow();
  });
});
