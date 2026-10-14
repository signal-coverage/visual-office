import { describe, expect, it } from "vitest";
import { VOICE_MAX_DISTANCE } from "../shared/voice.ts";
import { routeChat, type ChatPeer } from "./chatRouting.ts";

const peer = (id: string, over: Partial<ChatPeer> = {}): ChatPeer => ({
  id,
  x: 0,
  z: 0,
  zone: null,
  status: "available",
  ...over,
});

const ids = (route: ReturnType<typeof routeChat>) =>
  route.ok ? route.deliveries.map((d) => d.id).sort() : route.reason;

describe("routeChat: everyone", () => {
  it("reaches everybody, wherever they are, and the sender", () => {
    const peers = [
      peer("ana"),
      peer("beto", { x: 90 }),
      peer("carla", { zone: "meeting" }),
    ];
    expect(ids(routeChat("ana", peers, { scope: "everyone" }))).toEqual([
      "ana",
      "beto",
      "carla",
    ]);
  });
});

describe("routeChat: nearby", () => {
  it("reaches the people in the open office who can hear the sender", () => {
    const peers = [
      peer("ana"),
      peer("beto", { x: VOICE_MAX_DISTANCE - 1 }),
      peer("carla", { x: VOICE_MAX_DISTANCE + 1 }),
    ];
    expect(ids(routeChat("ana", peers, { scope: "nearby" }))).toEqual([
      "ana",
      "beto",
    ]);
  });

  it("does not reach somebody inside a private zone from the open office, however close", () => {
    const peers = [peer("ana"), peer("beto", { x: 1, zone: "meeting" })];
    expect(ids(routeChat("ana", peers, { scope: "nearby" }))).toEqual(["ana"]);
  });

  it("from a private zone reaches only the people in that same zone, however far", () => {
    const peers = [
      peer("ana", { x: -10, zone: "meeting" }),
      peer("beto", { x: -7, zone: "meeting" }),
      peer("carla", { x: -10 }),
      peer("dani", { x: -10, zone: "other" }),
    ];
    expect(ids(routeChat("ana", peers, { scope: "nearby" }))).toEqual([
      "ana",
      "beto",
    ]);
  });

  it("is only the sender when nobody is around", () => {
    const peers = [peer("ana"), peer("beto", { x: 50 })];
    expect(ids(routeChat("ana", peers, { scope: "nearby" }))).toEqual(["ana"]);
  });

  it("never makes the sender's own copy loud", () => {
    const route = routeChat("ana", [peer("ana")], { scope: "nearby" });
    expect(route).toEqual({
      ok: true,
      deliveries: [{ id: "ana", quiet: true }],
    });
  });
});

describe("routeChat: direct messages", () => {
  it("reaches only the target and the sender", () => {
    const peers = [peer("ana"), peer("beto"), peer("carla")];
    expect(ids(routeChat("ana", peers, { scope: "dm", to: "beto" }))).toEqual([
      "ana",
      "beto",
    ]);
  });

  it("reaches the target wherever they are", () => {
    const peers = [peer("ana"), peer("beto", { x: 500, zone: "meeting" })];
    expect(ids(routeChat("ana", peers, { scope: "dm", to: "beto" }))).toEqual([
      "ana",
      "beto",
    ]);
  });

  it("is refused for somebody who is not in the room", () => {
    const peers = [peer("ana"), peer("beto")];
    expect(routeChat("ana", peers, { scope: "dm", to: "ghost" })).toEqual({
      ok: false,
      reason: "gone",
    });
  });

  it("is refused to yourself", () => {
    expect(routeChat("ana", [peer("ana")], { scope: "dm", to: "ana" })).toEqual(
      { ok: false, reason: "self" },
    );
  });

  it("still arrives for somebody who asked not to be disturbed, but quietly", () => {
    const peers = [peer("ana"), peer("beto", { status: "dnd" })];
    expect(routeChat("ana", peers, { scope: "dm", to: "beto" })).toEqual({
      ok: true,
      deliveries: [
        { id: "ana", quiet: true },
        { id: "beto", quiet: true },
      ],
    });
  });

  it("is loud for everybody else, whether in a meeting, away or available", () => {
    for (const status of ["available", "busy", "away"] as const) {
      const peers = [peer("ana"), peer("beto", { status })];
      const route = routeChat("ana", peers, { scope: "dm", to: "beto" });
      expect(route.ok && route.deliveries.find((d) => d.id === "beto")).toEqual(
        { id: "beto", quiet: false },
      );
    }
  });
});

describe("routeChat: the sender", () => {
  it("is refused when the sender is not in the room", () => {
    expect(routeChat("ghost", [peer("ana")], { scope: "everyone" })).toEqual({
      ok: false,
      reason: "gone",
    });
  });
});
