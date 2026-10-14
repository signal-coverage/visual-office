import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultAppearance } from "../../shared/appearance.ts";
import { CHAT_REFUSAL_TEXT } from "../../shared/chat.ts";
import { IDLE_AFTER_MS } from "../../shared/presence.ts";
import type { NetworkHandlers } from "../game/network";
import type { LiteEvents } from "./LiteSession";

const fakes = vi.hoisted(() => ({
  handlers: null as unknown,
  connectArgs: null as unknown[] | null,
  connection: {
    sessionId: "me",
    sendMove: vi.fn(),
    sendChat: vi.fn(),
    sendIdle: vi.fn(),
    leave: vi.fn(),
  },
  call: {
    options: undefined as unknown,
    setCredentials: vi.fn(),
    setMutedByModerator: vi.fn(),
    toggleMic: vi.fn(),
    update: vi.fn(),
    reset: vi.fn(),
    dispose: vi.fn(),
  },
  failConnect: null as Error | null,
}));

vi.mock("../game/network", () => ({
  connect: async (...args: unknown[]) => {
    fakes.connectArgs = args;
    fakes.handlers = args[2];
    if (fakes.failConnect) throw fakes.failConnect;
    return fakes.connection;
  },
}));

vi.mock("../game/CallController", () => ({
  CallController: class {
    constructor(_events: unknown, options: unknown) {
      fakes.call.options = options;
    }
    setCredentials = fakes.call.setCredentials;
    setMutedByModerator = fakes.call.setMutedByModerator;
    toggleMic = fakes.call.toggleMic;
    update = fakes.call.update;
    reset = fakes.call.reset;
    dispose = fakes.call.dispose;
  },
}));

const { LiteSession } = await import("./LiteSession");

const handlers = () => fakes.handlers as NetworkHandlers;

function setup() {
  const events = {
    onChat: vi.fn(),
    onRoster: vi.fn(),
    onVoiceState: vi.fn(),
    onMicLevel: vi.fn(),
    onNotice: vi.fn(),
    onReconnecting: vi.fn(),
    onDisconnected: vi.fn(),
  } satisfies LiteEvents;
  const session = new LiteSession();
  return { session, events };
}

const look = defaultAppearance("Ana");

beforeEach(() => {
  vi.useFakeTimers();
  fakes.failConnect = null;
  for (const group of [fakes.connection, fakes.call])
    for (const value of Object.values(group))
      if (vi.isMockFunction(value)) value.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("LiteSession, joining", () => {
  it("joins the room with the name, the look and the sign-in token", async () => {
    const { session, events } = setup();
    await session.connect("Ana", look, events, "token-1");
    expect(fakes.connectArgs?.slice(0, 2)).toEqual(["Ana", look]);
    expect(fakes.connectArgs?.[3]).toBe("token-1");
  });

  it("fails when the room cannot be joined, so the screen can say so", async () => {
    fakes.failConnect = new Error("nope");
    const { session, events } = setup();
    await expect(session.connect("Ana", look, events, null)).rejects.toThrow(
      "nope",
    );
  });

  it("leaves again when it was closed while it was still joining", async () => {
    const { session, events } = setup();
    const joining = session.connect("Ana", look, events, null);
    session.dispose();
    await joining;
    expect(fakes.connection.leave).toHaveBeenCalled();
  });
});

describe("LiteSession, the room", () => {
  it("tells who is online, from the point of view of this person", async () => {
    const { session, events } = setup();
    await session.connect("Ana", look, events, null);
    handlers().onPlayers(
      [
        { id: "me", name: "Ana", zone: null, color: 0, status: "available" },
        { id: "b", name: "Bea", zone: null, color: 1, status: "away" },
      ],
      "me",
    );
    const roster = events.onRoster.mock.calls[0][0];
    expect(roster.count).toBe(2);
    expect(
      roster.entries.find((entry: { you: boolean }) => entry.you)?.name,
    ).toBe("Ana");
  });

  it("passes chat along, and says why a message was refused", async () => {
    const { session, events } = setup();
    await session.connect("Ana", look, events, null);
    const message = {
      id: "b",
      name: "Bea",
      color: 1,
      text: "hi",
      scope: "everyone" as const,
      at: 1,
    };
    handlers().onChat(message, false);
    expect(events.onChat).toHaveBeenCalledWith(message, false);
    handlers().onChatRefused("gone");
    expect(events.onNotice).toHaveBeenCalledWith(CHAT_REFUSAL_TEXT.gone);
  });

  it("sends what is typed to the room", async () => {
    const { session, events } = setup();
    await session.connect("Ana", look, events, null);
    session.sendChat("hello", "everyone");
    session.sendChat("psst", "dm", "b");
    expect(fakes.connection.sendChat).toHaveBeenNthCalledWith(
      1,
      "hello",
      "everyone",
      undefined,
    );
    expect(fakes.connection.sendChat).toHaveBeenNthCalledWith(
      2,
      "psst",
      "dm",
      "b",
    );
  });

  it("never moves: the person stays where the server put them", async () => {
    const { session, events } = setup();
    await session.connect("Ana", look, events, null);
    vi.advanceTimersByTime(60_000);
    expect(fakes.connection.sendMove).not.toHaveBeenCalled();
  });

  it("says when the connection drops and comes back, and when it is gone", async () => {
    const { session, events } = setup();
    await session.connect("Ana", look, events, null);
    handlers().onDropped();
    handlers().onReconnected();
    expect(events.onReconnecting.mock.calls).toEqual([[true], [false]]);
    handlers().onDisconnected(1006);
    expect(events.onDisconnected).toHaveBeenCalledWith(1006);
    expect(fakes.call.reset).toHaveBeenCalled();
  });
});

describe("LiteSession, voice", () => {
  it("receives sound only: there is nowhere to show anybody's camera", async () => {
    const { session, events } = setup();
    await session.connect("Ana", look, events, null);
    expect(fakes.call.options).toEqual({ receiveVideo: false });
  });

  it("makes the call available when the server gives the credentials", async () => {
    const { session, events } = setup();
    await session.connect("Ana", look, events, null);
    const credentials = { url: "ws://x", token: "t", zone: null };
    handlers().onVoice(credentials);
    expect(fakes.call.setCredentials).toHaveBeenCalledWith(credentials);
  });

  it("joins and mutes with the one button", async () => {
    const { session, events } = setup();
    await session.connect("Ana", look, events, null);
    session.toggleVoice();
    expect(fakes.call.toggleMic).toHaveBeenCalledTimes(1);
  });

  it("respects a moderator who muted this person", async () => {
    const { session, events } = setup();
    await session.connect("Ana", look, events, null);
    handlers().onVoiceMuted(true);
    expect(fakes.call.setMutedByModerator).toHaveBeenLastCalledWith(true);
    expect(events.onNotice).toHaveBeenCalled();
  });

  it("hears everybody in the open office at full volume, as if standing next to them", async () => {
    const { session, events } = setup();
    await session.connect("Ana", look, events, null);
    handlers().onPlayerAdded("b", { x: 30, z: -20 } as never);
    vi.advanceTimersByTime(300);
    expect(fakes.call.update).toHaveBeenCalled();
    const [, me, forEachRemote] = fakes.call.update.mock.calls[0];
    const seen: Array<[string, number, number]> = [];
    forEachRemote((id: string, x: number, z: number) =>
      seen.push([id, x - me.x, z - me.z]),
    );
    expect(seen).toEqual([["b", 0, 0]]);
  });

  it("stops hearing somebody who left", async () => {
    const { session, events } = setup();
    await session.connect("Ana", look, events, null);
    handlers().onPlayerAdded("b", { x: 1, z: 1 } as never);
    handlers().onPlayerRemoved("b");
    vi.advanceTimersByTime(300);
    const [, , forEachRemote] = fakes.call.update.mock.calls[0];
    const seen: string[] = [];
    forEachRemote((id: string) => seen.push(id));
    expect(seen).toEqual([]);
  });
});

describe("LiteSession, being away", () => {
  it("shows as away after a long time without touching anything, and back on a touch", async () => {
    const { session, events } = setup();
    await session.connect("Ana", look, events, null);
    vi.advanceTimersByTime(IDLE_AFTER_MS + 31_000);
    expect(fakes.connection.sendIdle).toHaveBeenLastCalledWith(true);
    session.touch();
    vi.advanceTimersByTime(31_000);
    expect(fakes.connection.sendIdle).toHaveBeenLastCalledWith(false);
  });

  it("does not say anything while the person is around", async () => {
    const { session, events } = setup();
    await session.connect("Ana", look, events, null);
    vi.advanceTimersByTime(60_000);
    expect(fakes.connection.sendIdle).not.toHaveBeenCalled();
  });
});

describe("LiteSession, leaving", () => {
  it("leaves the room, and stops its timers, on purpose", async () => {
    const { session, events } = setup();
    await session.connect("Ana", look, events, null);
    session.leave();
    expect(fakes.connection.leave).toHaveBeenCalled();
    session.dispose();
    fakes.call.update.mockClear();
    vi.advanceTimersByTime(5_000);
    expect(fakes.call.update).not.toHaveBeenCalled();
    expect(fakes.call.dispose).toHaveBeenCalled();
  });
});
