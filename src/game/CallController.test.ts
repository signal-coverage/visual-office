import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VoiceCredentials } from "../../shared/voice.ts";
import type { ScreenView } from "./CallController";
import type { VoiceState } from "./VoiceChat";

const fakes = vi.hoisted(() => {
  interface FakeChat {
    credentials: VoiceCredentials | null;
    events: {
      onDisconnected: () => void;
      onLocalScreen: (on: boolean) => void;
      onRemoteScreen: (
        identity: string,
        name: string,
        element: HTMLVideoElement | null,
      ) => void;
    } | null;
    options: { mic: boolean } | null;
    left: boolean;
    cameraRequests: boolean[];
    screenRequests: boolean[];
    /** Makes the next request to share fail with this error. */
    screenError: Error | null;
    volumes: Map<string, number>;
    videoWanted: Map<string, boolean>;
    level: number;
  }
  return { chats: [] as FakeChat[] };
});

vi.mock("./VoiceChat", () => ({
  VoiceChat: class {
    state = {
      credentials: null,
      events: null,
      options: null,
      left: false,
      cameraRequests: [] as boolean[],
      screenRequests: [] as boolean[],
      screenError: null,
      volumes: new Map<string, number>(),
      videoWanted: new Map<string, boolean>(),
      level: 0,
    } as (typeof fakes.chats)[number];

    constructor(events: NonNullable<(typeof fakes.chats)[number]["events"]>) {
      this.state.events = events;
      fakes.chats.push(this.state);
    }
    async setScreenShareEnabled(on: boolean) {
      this.state.screenRequests.push(on);
      if (this.state.screenError) throw this.state.screenError;
    }
    async join(credentials: VoiceCredentials, options: { mic: boolean }) {
      this.state.credentials = credentials;
      this.state.options = options;
    }
    async setCameraEnabled(on: boolean) {
      this.state.cameraRequests.push(on);
    }
    setMuted() {}
    setVolume(identity: string, volume: number) {
      this.state.volumes.set(identity, volume);
    }
    setVideoWanted(identity: string, wanted: boolean) {
      this.state.videoWanted.set(identity, wanted);
    }
    isReceivingVideo() {
      return false;
    }
    micLevel() {
      return this.state.level;
    }
    leave() {
      this.state.left = true;
    }
  },
}));

const { CallController } = await import("./CallController");

const open: VoiceCredentials = { url: "ws://x", token: "t-open", zone: null };
const meeting: VoiceCredentials = {
  url: "ws://x",
  token: "t-meeting",
  zone: "meeting",
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup() {
  const states: VoiceState[] = [];
  const meter: number[] = [];
  const notices: string[] = [];
  const views: ScreenView[] = [];
  const call = new CallController({
    onState: (state) => states.push(state),
    onMicLevel: (steps) => meter.push(steps),
    onCamera: () => {},
    onRemoteVideo: () => {},
    onScreen: (view) => views.push(view),
    onNotice: (text) => notices.push(text),
  });
  return { call, states, meter, notices, views };
}

/** Lets one meter reading go by (the meter reads a few times a second). */
function readMeter(call: InstanceType<typeof CallController>, dt = 0.1) {
  call.update(dt, { x: 0, z: 0 }, () => {});
}

/** Runs one tuning pass with one other player at the given distance. */
function tune(call: InstanceType<typeof CallController>, distance: number) {
  call.update(1, { x: 0, z: 0 }, (callback) => callback("other", distance, 0));
}

beforeEach(() => {
  fakes.chats.length = 0;
});

describe("CallController, changing rooms", () => {
  it("only remembers the new credentials while not in a call", async () => {
    const { call } = setup();
    call.setCredentials(open);
    call.setCredentials(meeting);
    await flush();
    expect(fakes.chats).toHaveLength(0);

    // ...and the next join goes straight to the room of the latest credentials
    call.toggleMic();
    await flush();
    expect(fakes.chats[0].credentials).toEqual(meeting);
  });

  it("moves a live call to the new room, microphone still on", async () => {
    const { call, states } = setup();
    call.setCredentials(open);
    call.toggleMic();
    await flush();
    expect(states.at(-1)).toBe("live");

    call.setCredentials(meeting);
    await flush();

    expect(fakes.chats).toHaveLength(2);
    expect(fakes.chats[0].left).toBe(true);
    expect(fakes.chats[1].credentials).toEqual(meeting);
    expect(fakes.chats[1].options).toEqual({ mic: true });
    expect(states.at(-1)).toBe("live");
  });

  it("keeps a muted call muted and its camera on when it changes room", async () => {
    const { call, states } = setup();
    call.setCredentials(open);
    call.toggleCamera(); // joins with the microphone off, camera on
    await flush();
    expect(fakes.chats[0].cameraRequests).toEqual([true]);

    call.setCredentials(meeting);
    await flush();

    expect(fakes.chats[1].options).toEqual({ mic: false });
    expect(fakes.chats[1].cameraRequests).toEqual([true]);
    expect(states.at(-1)).toBe("muted");
  });

  it("does not reconnect when the credentials are for the room it is already in", async () => {
    const { call } = setup();
    call.setCredentials(open);
    call.toggleMic();
    await flush();

    call.setCredentials({ ...open, token: "a-fresh-token" });
    await flush();
    expect(fakes.chats).toHaveLength(1);
  });

  it("never leaves the old room open while joining the new one", async () => {
    const { call } = setup();
    call.setCredentials(open);
    call.toggleMic();
    await flush();
    call.setCredentials(meeting);
    expect(fakes.chats[0].left).toBe(true);
  });
});

describe("CallController, losing the call", () => {
  it("says so when the call drops without us asking, instead of staying on 'mic on'", async () => {
    const { call, states } = setup();
    call.setCredentials(open);
    call.toggleMic();
    await flush();
    expect(states.at(-1)).toBe("live");

    fakes.chats[0].events!.onDisconnected();

    expect(states.at(-1)).toBe("error");
    expect(fakes.chats[0].left).toBe(true);
  });

  it("lets the player rejoin from there", async () => {
    const { call, states } = setup();
    call.setCredentials(open);
    call.toggleMic();
    await flush();
    fakes.chats[0].events!.onDisconnected();

    call.toggleMic();
    await flush();

    expect(fakes.chats).toHaveLength(2);
    expect(states.at(-1)).toBe("live");
  });

  it("ignores the drop of a call we already replaced", async () => {
    const { call, states } = setup();
    call.setCredentials(open);
    call.toggleMic();
    await flush();
    call.setCredentials(meeting); // moves to a new call
    await flush();

    fakes.chats[0].events!.onDisconnected(); // the old one reports late

    expect(states.at(-1)).toBe("live");
    expect(fakes.chats[1].left).toBe(false);
  });
});

describe("CallController, microphone meter", () => {
  it("reports how loud the microphone is while the call is live", async () => {
    const { call, meter } = setup();
    call.setCredentials(open);
    call.toggleMic();
    await flush();

    fakes.chats[0].level = 1;
    readMeter(call);
    expect(meter.at(-1)).toBe(8);

    fakes.chats[0].level = 0.5;
    readMeter(call, 1); // long enough for the bar to settle
    expect(meter.at(-1)).toBe(4);
  });

  it("shows nothing while muted, however loud the room is", async () => {
    const { call, meter } = setup();
    call.setCredentials(open);
    call.toggleMic();
    await flush();
    fakes.chats[0].level = 1;
    readMeter(call);
    expect(meter.at(-1)).toBe(8);

    call.toggleMic(); // mute
    expect(meter.at(-1)).toBe(0);
    readMeter(call);
    expect(meter.at(-1)).toBe(0);
  });

  it("shows nothing when the call ends", async () => {
    const { call, meter } = setup();
    call.setCredentials(open);
    call.toggleMic();
    await flush();
    fakes.chats[0].level = 1;
    readMeter(call);

    call.reset();
    expect(meter.at(-1)).toBe(0);
  });

  it("only reports when the bar actually changes", async () => {
    const { call, meter } = setup();
    call.setCredentials(open);
    call.toggleMic();
    await flush();
    fakes.chats[0].level = 0.5;
    for (let i = 0; i < 20; i++) readMeter(call);
    expect(meter.filter((steps) => steps === 4)).toHaveLength(1);
  });

  it("does not read the microphone more often than needed", async () => {
    const { call, meter } = setup();
    call.setCredentials(open);
    call.toggleMic();
    await flush();
    fakes.chats[0].level = 1;
    readMeter(call, 0.001); // far too soon after the call began
    expect(meter).not.toContain(8);
  });
});

describe("CallController, sharing the screen", () => {
  const video = (label: string) => ({ label }) as unknown as HTMLVideoElement;

  it("says so when there is no call to share into", () => {
    const { call, notices } = setup();
    call.toggleScreenShare();
    expect(notices).toHaveLength(1);
    expect(fakes.chats).toHaveLength(0);
  });

  it("only shares in a private room, and explains it elsewhere", async () => {
    const { call, notices } = setup();
    call.setCredentials(open);
    call.toggleScreenShare();
    await flush();
    expect(fakes.chats).toHaveLength(0); // it did not even join
    expect(notices[0]).toMatch(/private room/i);

    call.toggleMic(); // now in the open call
    await flush();
    call.toggleScreenShare();
    await flush();
    expect(notices).toHaveLength(2);
    expect(fakes.chats[0].screenRequests).toEqual([]);
  });

  it("joins the call without the microphone, then shares, when it is not in one yet", async () => {
    const { call, states } = setup();
    call.setCredentials(meeting);
    call.toggleScreenShare();
    await flush();

    expect(fakes.chats[0].options).toEqual({ mic: false });
    expect(fakes.chats[0].screenRequests).toEqual([true]);
    expect(states.at(-1)).toBe("muted");
  });

  it("starts and stops sharing from a call it is already in", async () => {
    const { call } = setup();
    call.setCredentials(meeting);
    call.toggleMic();
    await flush();

    call.toggleScreenShare();
    await flush();
    fakes.chats[0].events!.onLocalScreen(true); // the browser confirms it is sharing

    call.toggleScreenShare();
    await flush();
    expect(fakes.chats[0].screenRequests).toEqual([true, false]);
  });

  it("shows the wall screen as ours while we share, and as empty when we stop", async () => {
    const { call, views } = setup();
    call.setCredentials(meeting);
    call.toggleMic();
    await flush();

    fakes.chats[0].events!.onLocalScreen(true);
    expect(views.at(-1)).toEqual({ kind: "local" });
    fakes.chats[0].events!.onLocalScreen(false); // e.g. the browser's own "stop sharing"
    expect(views.at(-1)).toEqual({ kind: "none" });
  });

  it("shows somebody else's screen, with their name", async () => {
    const { call, views } = setup();
    call.setCredentials(meeting);
    call.toggleMic();
    await flush();

    const element = video("ana");
    fakes.chats[0].events!.onRemoteScreen("ana-id", "Ana", element);
    expect(views.at(-1)).toEqual({ kind: "remote", name: "Ana", element });

    fakes.chats[0].events!.onRemoteScreen("ana-id", "Ana", null);
    expect(views.at(-1)).toEqual({ kind: "none" });
  });

  it("does not tell the screen the same thing twice", async () => {
    const { call, views } = setup();
    call.setCredentials(meeting);
    call.toggleMic();
    await flush();
    views.length = 0; // what joining the call itself reported does not count
    fakes.chats[0].events!.onRemoteScreen("ana-id", "Ana", null);
    fakes.chats[0].events!.onRemoteScreen("ana-id", "Ana", null);
    expect(views).toEqual([]);
  });

  it("clears the screen when we leave the room it was shared in", async () => {
    const { call, views } = setup();
    call.setCredentials(meeting);
    call.toggleMic();
    await flush();
    fakes.chats[0].events!.onRemoteScreen("ana-id", "Ana", video("ana"));

    call.setCredentials(open); // we walked out: the call moves to the open office
    await flush();
    expect(views.at(-1)).toEqual({ kind: "none" });
  });

  it("clears the screen when the call drops, and says the call is what is missing", async () => {
    const { call, views } = setup();
    call.setCredentials(meeting);
    call.toggleMic();
    await flush();
    fakes.chats[0].events!.onRemoteScreen("ana-id", "Ana", video("ana"));
    fakes.chats[0].events!.onDisconnected();
    expect(views.at(-1)).toEqual({ kind: "offline" });
  });

  it("clears the screen when the game connection is gone", async () => {
    const { call, views } = setup();
    call.setCredentials(meeting);
    call.toggleMic();
    await flush();
    fakes.chats[0].events!.onRemoteScreen("ana-id", "Ana", video("ana"));
    call.reset();
    expect(views.at(-1)).toEqual({ kind: "none" });
  });

  it("ignores what a call we already left reports late", async () => {
    const { call, views } = setup();
    call.setCredentials(meeting);
    call.toggleMic();
    await flush();
    const old = fakes.chats[0];
    call.setCredentials(open);
    await flush();
    views.length = 0;

    old.events!.onRemoteScreen("ana-id", "Ana", video("late"));
    old.events!.onLocalScreen(true);
    expect(views).toEqual([]);
  });

  it("tells the player when they cancel the browser's picker", async () => {
    const { call, notices } = setup();
    call.setCredentials(meeting);
    call.toggleMic();
    await flush();
    const denied = new Error("Permission denied");
    denied.name = "NotAllowedError";
    fakes.chats[0].screenError = denied;

    call.toggleScreenShare();
    await flush();
    expect(notices.at(-1)).toMatch(/cancel/i);
  });

  it("tells the player when sharing fails for any other reason", async () => {
    const { call, notices } = setup();
    call.setCredentials(meeting);
    call.toggleMic();
    await flush();
    fakes.chats[0].screenError = new Error("boom");

    call.toggleScreenShare();
    await flush();
    expect(notices.at(-1)).toMatch(/could not/i);
  });
});

describe("CallController, a room with a screen", () => {
  it("tells somebody who walks in without being in the call what to turn on", () => {
    const { call, notices } = setup();
    call.setCredentials(open); // voice is available, but they have not joined
    call.enteredZone("meeting");
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatch(/screen/i);
    // Every way of joining the call is named
    expect(notices[0]).toMatch(/\bM\b/);
    expect(notices[0]).toMatch(/\bC\b/);
    expect(notices[0]).toMatch(/\bP\b/);
  });

  it("does so each time they walk in", () => {
    const { call, notices } = setup();
    call.setCredentials(open);
    call.enteredZone("meeting");
    call.enteredZone(null);
    call.enteredZone("meeting");
    expect(notices).toHaveLength(2);
  });

  it("says nothing to somebody who is already in the call", async () => {
    const { call, notices } = setup();
    call.setCredentials(open);
    call.toggleMic();
    await flush();
    call.enteredZone("meeting");
    expect(notices).toEqual([]);
  });

  it("says nothing while the call is still being joined", async () => {
    const { call, notices } = setup();
    call.setCredentials(open);
    call.toggleMic(); // connecting, not yet awaited
    call.enteredZone("meeting");
    expect(notices).toEqual([]);
  });

  it("says nothing when walking out, or into a room without a screen", () => {
    const { call, notices } = setup();
    call.setCredentials(open);
    call.enteredZone(null);
    call.enteredZone("lounge");
    expect(notices).toEqual([]);
  });

  it("says nothing when there is no voice to turn on", () => {
    const { call, notices } = setup(); // credentials never arrived: voice is off
    call.enteredZone("meeting");
    expect(notices).toEqual([]);
  });

  it("reminds somebody whose call failed, since the same keys bring it back", async () => {
    const { call, notices, states } = setup();
    call.setCredentials(open);
    call.toggleMic();
    await flush();
    fakes.chats[0].events!.onDisconnected();
    expect(states.at(-1)).toBe("error");
    call.enteredZone("meeting");
    expect(notices).toHaveLength(1);
  });
});

describe("CallController, what the wall screen says when there is no call", () => {
  it("asks to join the call when voice is available but we are not in it", () => {
    const { call, views } = setup();
    call.setCredentials(open);
    expect(views.at(-1)).toEqual({ kind: "offline" });
  });

  it("goes back to 'nothing shared' once we are in the call", async () => {
    const { call, views } = setup();
    call.setCredentials(open);
    call.toggleMic();
    await flush();
    expect(views.at(-1)).toEqual({ kind: "none" });
  });

  it("says nothing about joining when there is no voice at all", () => {
    const { call, views } = setup();
    call.reset();
    expect(views).toEqual([]);
  });

  it("asks again after leaving the game connection and coming back", () => {
    const { call, views } = setup();
    call.setCredentials(open);
    call.reset();
    expect(views.at(-1)).toEqual({ kind: "none" });
    call.setCredentials(open);
    expect(views.at(-1)).toEqual({ kind: "offline" });
  });
});

describe("CallController, who is heard", () => {
  it("fades with distance in the open office", async () => {
    const { call } = setup();
    call.setCredentials(open);
    call.toggleMic();
    await flush();

    tune(call, 12);
    expect(fakes.chats[0].volumes.get("other")).toBe(0);
    expect(fakes.chats[0].videoWanted.get("other")).toBe(false);
  });

  it("hears and sees everybody in a private room, however far", async () => {
    const { call } = setup();
    call.setCredentials(meeting);
    call.toggleMic();
    await flush();

    tune(call, 12);
    expect(fakes.chats[0].volumes.get("other")).toBe(1);
    expect(fakes.chats[0].videoWanted.get("other")).toBe(true);
  });

  it("goes by the room it is connected to, not the latest credentials", async () => {
    const { call } = setup();
    call.setCredentials(open);
    call.toggleMic();
    await flush();

    // Credentials for the meeting arrive, but the old call has not been replaced yet
    // (it is replaced synchronously, so check the new call is the one being tuned)
    call.setCredentials(meeting);
    await flush();
    tune(call, 12);
    expect(fakes.chats[0].volumes.has("other")).toBe(false); // old call: no longer tuned
    expect(fakes.chats[1].volumes.get("other")).toBe(1);
  });
});
