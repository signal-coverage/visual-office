import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VoiceCredentials } from "../../shared/voice.ts";
import type { VoiceState } from "./VoiceChat";

const fakes = vi.hoisted(() => {
  interface FakeChat {
    credentials: VoiceCredentials | null;
    options: { mic: boolean } | null;
    left: boolean;
    cameraRequests: boolean[];
    volumes: Map<string, number>;
    videoWanted: Map<string, boolean>;
  }
  return { chats: [] as FakeChat[] };
});

vi.mock("./VoiceChat", () => ({
  VoiceChat: class {
    state = {
      credentials: null,
      options: null,
      left: false,
      cameraRequests: [] as boolean[],
      volumes: new Map<string, number>(),
      videoWanted: new Map<string, boolean>(),
    } as (typeof fakes.chats)[number];

    constructor() {
      fakes.chats.push(this.state);
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
  const call = new CallController({
    onState: (state) => states.push(state),
    onCamera: () => {},
    onRemoteVideo: () => {},
  });
  return { call, states };
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
