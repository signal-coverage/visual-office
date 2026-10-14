import { TokenVerifier, TrackSource, TrackType } from "livekit-server-sdk";
import { describe, expect, it } from "vitest";
import { ROOM_NAME } from "../shared/constants.ts";
import { voiceRoomName } from "../shared/voice.ts";
import {
  createVoiceAdmin,
  createVoiceToken,
  isRoomMissing,
  voiceConfigFromEnv,
  voiceSources,
  voiceStatusFromEnv,
} from "./voice.ts";

describe("VOICE_ROOM_PREFIX", () => {
  const base = {
    LIVEKIT_URL: "wss://x.livekit.cloud",
    LIVEKIT_API_KEY: "key",
    LIVEKIT_API_SECRET: "secret",
    NODE_ENV: "production",
  };
  const prefixOf = (value?: string) =>
    voiceStatusFromEnv({ ...base, VOICE_ROOM_PREFIX: value }).config
      ?.roomPrefix ?? "";

  it("is the company's name followed by a dash", () => {
    expect(prefixOf("acme")).toBe("acme-");
  });

  it("is tidied into something a room name can hold", () => {
    expect(prefixOf("  Acme Corp  ")).toBe("acme-corp-");
    expect(prefixOf("acme_corp.es")).toBe("acme-corp-es-");
    expect(prefixOf("--acme--")).toBe("acme-");
  });

  it("is nothing when there is none, so a single company changes nothing", () => {
    for (const value of [undefined, "", "   ", "!!!"])
      expect(prefixOf(value), String(value)).toBe("");
  });

  it("is kept short", () => {
    expect(prefixOf("a".repeat(80))!.length).toBeLessThanOrEqual(33);
  });

  it("is said at startup, so a company that forgot it is noticed", () => {
    expect(
      voiceStatusFromEnv({ ...base, VOICE_ROOM_PREFIX: "acme" }).summary,
    ).toContain("acme-");
    expect(voiceStatusFromEnv(base).summary).not.toMatch(/prefix/i);
  });

  it("goes in front of the room a token lets somebody join", async () => {
    const config = voiceStatusFromEnv({
      ...base,
      VOICE_ROOM_PREFIX: "acme",
    }).config!;
    const claims = await new TokenVerifier(
      config.apiKey,
      config.apiSecret,
    ).verify(await createVoiceToken(config, "s", "Alice", "meeting"));
    expect(claims.video?.room).toBe(voiceRoomName("meeting", "acme-"));
  });
});

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

describe("isRoomMissing", () => {
  it("recognises LiveKit's answer for a room nobody is in", () => {
    // LiveKit Cloud deletes a room when its last person leaves
    expect(
      isRoomMissing(Object.assign(new Error("Not Found"), { status: 404 })),
    ).toBe(true);
    expect(isRoomMissing({ code: "not_found" })).toBe(true);
  });

  it("does not hide any other failure", () => {
    expect(isRoomMissing(Object.assign(new Error("x"), { status: 500 }))).toBe(
      false,
    );
    expect(isRoomMissing(Object.assign(new Error("x"), { status: 401 }))).toBe(
      false,
    );
    expect(isRoomMissing(new Error("connection refused"))).toBe(false);
    expect(isRoomMissing(null)).toBe(false);
    expect(isRoomMissing("not_found")).toBe(false);
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

  it("lets people share their screen only in a private room", async () => {
    const verifier = new TokenVerifier(config.apiKey, config.apiSecret);
    const sources = async (zone: string | null) =>
      (
        await verifier.verify(
          await createVoiceToken(config, "s", "Alice", zone),
        )
      ).video?.canPublishSources;

    expect(await sources(null)).toEqual(
      expect.arrayContaining(["microphone", "camera"]),
    );
    expect(await sources(null)).not.toContain("screen_share");
    expect(await sources("meeting")).toEqual(
      expect.arrayContaining(["microphone", "camera", "screen_share"]),
    );
  });

  it("never lets anybody publish the sound of a shared screen", async () => {
    const verifier = new TokenVerifier(config.apiKey, config.apiSecret);
    for (const zone of [null, "meeting"]) {
      const claims = await verifier.verify(
        await createVoiceToken(config, "s", "Alice", zone),
      );
      expect(claims.video?.canPublishSources).not.toContain(
        "screen_share_audio",
      );
    }
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

describe("voiceSources", () => {
  it("is the microphone and the camera, and a screen only in a private room", () => {
    expect(voiceSources(null, true)).toEqual([
      TrackSource.MICROPHONE,
      TrackSource.CAMERA,
    ]);
    expect(voiceSources("meeting", true)).toEqual([
      TrackSource.MICROPHONE,
      TrackSource.CAMERA,
      TrackSource.SCREEN_SHARE,
    ]);
  });

  it("leaves the microphone out of somebody who may not speak, and nothing else", () => {
    expect(voiceSources(null, false)).toEqual([TrackSource.CAMERA]);
    expect(voiceSources("meeting", false)).toEqual([
      TrackSource.CAMERA,
      TrackSource.SCREEN_SHARE,
    ]);
  });
});

describe("createVoiceToken for somebody who may not speak", () => {
  const config = {
    url: "ws://localhost:7880",
    apiKey: "devkey",
    apiSecret: "a-long-enough-test-secret-value",
  };

  it("has no microphone among what it lets them publish, so a rejoin does not undo a mute", async () => {
    const verifier = new TokenVerifier(config.apiKey, config.apiSecret);
    for (const zone of [null, "meeting"]) {
      const claims = await verifier.verify(
        await createVoiceToken(config, "s", "Alice", zone, false),
      );
      expect(claims.video?.canPublishSources).not.toContain("microphone");
      expect(claims.video?.canPublishSources).toContain("camera");
      expect(claims.video?.canPublish).toBe(true);
    }
  });
});

describe("VoiceAdmin.setCanSpeak", () => {
  const config = {
    url: "ws://localhost:7880",
    apiKey: "devkey",
    apiSecret: "a-long-enough-test-secret-value",
  };
  const track = (sid: string, source: TrackSource, muted = false) => ({
    sid,
    source,
    muted,
    type: TrackType.AUDIO,
  });

  const fakeClient = (
    tracks: Array<ReturnType<typeof track>>,
    failWith?: unknown,
  ) => {
    const calls: unknown[][] = [];
    return {
      calls,
      client: {
        listParticipants: async () => [],
        removeParticipant: async () => {},
        getParticipant: async (...args: unknown[]) => {
          calls.push(["get", ...args]);
          if (failWith) throw failWith;
          return { tracks };
        },
        updateParticipant: async (...args: unknown[]) => {
          calls.push(["update", ...args]);
          if (failWith) throw failWith;
        },
        mutePublishedTrack: async (...args: unknown[]) => {
          calls.push(["mute", ...args]);
        },
      },
    };
  };

  it("takes the microphone out of what they may publish, and silences what is already on", async () => {
    const { client, calls } = fakeClient([
      track("TR_mic", TrackSource.MICROPHONE),
      track("TR_cam", TrackSource.CAMERA),
    ]);
    const admin = createVoiceAdmin(config, client as never);
    await admin.setCanSpeak("office", "session-1", null, false);
    expect(calls).toContainEqual([
      "update",
      "office",
      "session-1",
      undefined,
      {
        canPublish: true,
        canSubscribe: true,
        canPublishData: false,
        canPublishSources: [TrackSource.CAMERA],
      },
    ]);
    expect(calls).toContainEqual([
      "mute",
      "office",
      "session-1",
      "TR_mic",
      true,
    ]);
    expect(calls.filter((call) => call[0] === "mute")).toHaveLength(1);
  });

  it("gives the microphone back without touching any track", async () => {
    const { client, calls } = fakeClient([
      track("TR_mic", TrackSource.MICROPHONE, true),
    ]);
    const admin = createVoiceAdmin(config, client as never);
    await admin.setCanSpeak("office", "session-1", "meeting", true);
    expect(calls).toEqual([
      [
        "update",
        "office",
        "session-1",
        undefined,
        {
          canPublish: true,
          canSubscribe: true,
          canPublishData: false,
          canPublishSources: [
            TrackSource.MICROPHONE,
            TrackSource.CAMERA,
            TrackSource.SCREEN_SHARE,
          ],
        },
      ],
    ]);
  });

  it("does nothing, without failing, for somebody who is not in the call yet", async () => {
    const { client } = fakeClient([], { status: 404, code: "not_found" });
    const admin = createVoiceAdmin(config, client as never);
    await expect(
      admin.setCanSpeak("office", "session-1", null, false),
    ).resolves.toBeUndefined();
  });

  it("does not hide any other failure", async () => {
    const { client } = fakeClient([], new Error("LiveKit is down"));
    const admin = createVoiceAdmin(config, client as never);
    await expect(
      admin.setCanSpeak("office", "session-1", null, false),
    ).rejects.toThrow("LiveKit is down");
  });
});

describe("createVoiceToken on a floor", () => {
  it("grants the voice room of that floor, not the main office's", async () => {
    const config = {
      url: "ws://x",
      apiKey: "devkey",
      apiSecret: "secret!secret!secret!secret!secret!",
    };
    const claims = await new TokenVerifier(
      config.apiKey,
      config.apiSecret,
    ).verify(
      await createVoiceToken(config, "s", "Alice", "meeting", true, "hr"),
    );
    expect(claims.video?.room).toBe(voiceRoomName("meeting", "", "hr"));
    expect(claims.video?.room).not.toBe(voiceRoomName("meeting"));
  });
});
