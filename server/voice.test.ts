import { TokenVerifier } from "livekit-server-sdk";
import { describe, expect, it } from "vitest";
import { ROOM_NAME } from "../shared/constants.ts";
import { voiceRoomName } from "../shared/voice.ts";
import {
  createVoiceToken,
  voiceConfigFromEnv,
  voiceStatusFromEnv,
} from "./voice.ts";

describe("voiceStatusFromEnv", () => {
  const production = { NODE_ENV: "production" };
  const complete = {
    ...production,
    LIVEKIT_URL: "wss://demo.livekit.cloud",
    LIVEKIT_API_KEY: "APIxxxPublicKey",
    LIVEKIT_API_SECRET: "xxxSuperSecretValue",
  };

  it("turns voice on in production and reports only the URL, never the credentials", () => {
    const { config, summary } = voiceStatusFromEnv(complete);
    expect(config).toEqual({
      url: "wss://demo.livekit.cloud",
      apiKey: "APIxxxPublicKey",
      apiSecret: "xxxSuperSecretValue",
    });
    expect(summary).toContain("on");
    expect(summary).toContain("wss://demo.livekit.cloud");
    expect(summary).not.toContain("APIxxxPublicKey");
    expect(summary).not.toContain("xxxSuperSecretValue");
  });

  it("explains what to set when nothing is configured in production", () => {
    const { config, summary } = voiceStatusFromEnv(production);
    expect(config).toBeNull();
    for (const name of [
      "LIVEKIT_URL",
      "LIVEKIT_API_KEY",
      "LIVEKIT_API_SECRET",
    ]) {
      expect(summary).toContain(name);
    }
  });

  it("names exactly what is missing when only some variables are set", () => {
    const { config, summary } = voiceStatusFromEnv({
      ...production,
      LIVEKIT_URL: "wss://demo.livekit.cloud",
      LIVEKIT_API_KEY: "APIxxxPublicKey",
    });
    expect(config).toBeNull();
    expect(summary).toContain("missing LIVEKIT_API_SECRET");
    expect(summary).not.toContain("LIVEKIT_URL");
  });

  it.each([
    ["https://demo.livekit.cloud", "wss://demo.livekit.cloud"],
    ["http://localhost:7880", "ws://localhost:7880"],
    ["demo.livekit.cloud", "wss://demo.livekit.cloud"],
    ["wss://demo.livekit.cloud/", "wss://demo.livekit.cloud"],
    ["  wss://demo.livekit.cloud  ", "wss://demo.livekit.cloud"],
    ["ws://localhost:7880", "ws://localhost:7880"],
  ])(
    "accepts the URL %j as %j (the browser SDK needs ws:// or wss://)",
    (raw, expected) => {
      expect(
        voiceStatusFromEnv({ ...complete, LIVEKIT_URL: raw }).config?.url,
      ).toBe(expected);
    },
  );

  it("ignores spaces and line breaks pasted around the key and the secret", () => {
    const { config } = voiceStatusFromEnv({
      ...complete,
      LIVEKIT_API_KEY: "  APIxxxPublicKey\n",
      LIVEKIT_API_SECRET: "\txxxSuperSecretValue \r\n",
    });
    expect(config?.apiKey).toBe("APIxxxPublicKey");
    expect(config?.apiSecret).toBe("xxxSuperSecretValue");
  });

  it("treats empty variables as not set, as hosting dashboards can save them", () => {
    const empty = {
      LIVEKIT_URL: "",
      LIVEKIT_API_KEY: "",
      LIVEKIT_API_SECRET: "",
    };
    expect(voiceStatusFromEnv({ ...production, ...empty }).config).toBeNull();
    // ...and outside production they fall back to the local development server
    expect(voiceStatusFromEnv(empty).config?.url).toBe("ws://localhost:7880");
  });
});

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

  it("can be bound to a zone's own room instead", async () => {
    const token = await createVoiceToken(
      config,
      "session-123",
      "Alice",
      "meeting",
    );
    const claims = await new TokenVerifier(
      config.apiKey,
      config.apiSecret,
    ).verify(token);

    expect(claims.video?.room).toBe(voiceRoomName("meeting"));
    expect(claims.video?.room).not.toBe(ROOM_NAME);
  });

  it("expires quickly for a private zone, so a stale token cannot get back in", async () => {
    const verifier = new TokenVerifier(config.apiKey, config.apiSecret);
    const secondsLeft = async (zone: string | null) => {
      const claims = await verifier.verify(
        await createVoiceToken(config, "session-123", "Alice", zone),
      );
      return (claims.exp ?? 0) - Date.now() / 1000;
    };

    expect(await secondsLeft("meeting")).toBeLessThanOrEqual(5 * 60);
    expect(await secondsLeft("meeting")).toBeGreaterThan(30);
    expect(await secondsLeft(null)).toBeGreaterThan(60 * 60);
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
