import {
  peerVolume,
  peerWantsVideo,
  type VoiceCredentials,
} from "../../shared/voice.ts";
import { callErrorText } from "./callError";
import { meterSteps, smoothLevel } from "./micMeter";
import { MUTED_NOTICE } from "../../shared/moderation.ts";
import { SCREENS } from "../../shared/screens.ts";
import { ScreenShares } from "./screenShares";
import { VoiceChat, type VoiceState } from "./VoiceChat";

export interface CallEvents {
  onState: (state: VoiceState) => void;
  /** How many bars of the microphone meter to light (0..METER_STEPS); 0 when not transmitting. */
  onMicLevel: (steps: number) => void;
  /** Our camera turned on (with a preview to show) or off (null). */
  onCamera: (on: boolean, selfView: HTMLVideoElement | null) => void;
  /** Someone nearby has a camera feed to draw, or lost it (null). */
  onRemoteVideo: (identity: string, element: HTMLVideoElement | null) => void;
  /** What the wall screen should show now. Called only when it changes. */
  onScreen: (view: ScreenView) => void;
  /** Something the player should be told, e.g. why sharing is not possible here. */
  onNotice: (text: string) => void;
}

/**
 * What the wall screen shows: nothing shared; that we are not in the call and so
 * cannot see anything; our own sharing (not the picture itself); or somebody
 * else's screen.
 */
export type ScreenView =
  | { kind: "none" }
  | { kind: "offline" }
  | { kind: "local" }
  | { kind: "remote"; name: string; element: HTMLVideoElement };

const NOTICES = {
  unavailable:
    "Sharing needs voice and video, which are not available right now.",
  privateOnly:
    "Screen sharing works in a private room, like the meeting room. Walk in and press P.",
  joinToSee:
    "This room has a screen. To see what is shared, join the call: M (microphone), C (camera) or P (share yours).",
  cancelled: "Screen sharing was cancelled.",
  failed: "Could not share the screen.",
} as const;

type Position = { x: number; z: number };
type ForEachPosition = (
  callback: (identity: string, x: number, z: number) => void,
) => void;

const UPDATE_INTERVAL = 0.2;
/** The meter is read more often than the distances: it has to follow speech. */
const METER_INTERVAL = 0.08;

/**
 * The audio/video call: joining it, microphone, camera, and tuning what we
 * receive to how far away each person is.
 *
 * Joining with the camera key keeps the microphone off, so nobody starts
 * transmitting sound just because they wanted to show their face.
 */
export class CallController {
  private readonly events: CallEvents;
  private readonly receiveVideo: boolean;
  private chat: VoiceChat | null = null;
  private credentials: VoiceCredentials | null = null;
  private state: VoiceState = "unavailable";
  private cameraOn = false;
  private sinceUpdate = 0;
  private sinceMeter = 0;
  private meterLevel = 0;
  private meterSteps = 0;
  /** What we want from the call, to carry over when it moves to another room. */
  private wanted = { mic: false, camera: false };
  /**
   * The private zone of the call we are in (null: the open office). The volume
   * rule follows this, not the latest credentials: it is the room we are really
   * connected to that decides who we can hear.
   */
  private callZone: string | null = null;
  /** A moderator took the microphone away: the server will not let it publish, so do not offer it. */
  private mutedByModerator = false;
  /** Screens shared by others in this call, and whether we are sharing ours. */
  private readonly shares = new ScreenShares();
  private sharingMine = false;
  private picking = false;
  private view: ScreenView = { kind: "none" };
  /** The rooms of this floor that have a screen on a wall: the main office's until the floor says otherwise. */
  private screenZones: ReadonlySet<string> = new Set(
    SCREENS.map((screen) => screen.zone),
  );

  constructor(
    events: CallEvents,
    /** `receiveVideo: false` is for a screen with nowhere to draw the cameras: only sound is received. */
    options: { receiveVideo?: boolean } = {},
  ) {
    this.events = events;
    this.receiveVideo = options.receiveVideo ?? true;
  }

  /**
   * The game server gave us credentials: the call is now available. They change
   * when we cross into or out of a private zone, and a call already in progress
   * moves to the new room, keeping the microphone and camera as they were.
   */
  setCredentials(credentials: VoiceCredentials) {
    this.credentials = credentials;
    if (this.state === "unavailable") this.setState("idle");
    if (this.chat && credentials.zone !== this.callZone) {
      void this.join(this.wanted);
    }
  }

  /** Microphone key: joins the call the first time, then mutes / unmutes. */
  toggleMic() {
    switch (this.state) {
      case "idle":
      case "error":
        void this.join({ mic: true, camera: false });
        break;
      case "live":
        this.chat?.setMuted(true);
        this.wanted.mic = false;
        this.setState("muted");
        break;
      case "muted":
        if (this.mutedByModerator) {
          this.events.onNotice(MUTED_NOTICE);
          break;
        }
        this.chat?.setMuted(false);
        this.wanted.mic = true;
        this.setState("live");
        break;
    }
  }

  /**
   * A moderator muted us, or let us speak again. While muted the microphone
   * goes off at once and stays off, also when the call moves to another room.
   */
  setMutedByModerator(muted: boolean) {
    this.mutedByModerator = muted;
    if (!muted) return;
    this.wanted.mic = false;
    if (this.state === "live") {
      this.chat?.setMuted(true);
      this.setState("muted");
    }
  }

  /** Camera key: joins the call (muted) the first time, then turns the camera on / off. */
  toggleCamera() {
    switch (this.state) {
      case "idle":
      case "error":
        void this.join({ mic: false, camera: true });
        break;
      case "live":
      case "muted":
        void this.setCamera(!this.cameraOn);
        break;
    }
  }

  /**
   * Share-screen key: only in a private room, which is where the wall screen is.
   * Joins the call (muted, no camera) the first time, then starts / stops sharing.
   */
  toggleScreenShare() {
    switch (this.state) {
      case "unavailable":
        this.events.onNotice(NOTICES.unavailable);
        break;
      case "idle":
      case "error":
        if (!this.credentials?.zone) this.events.onNotice(NOTICES.privateOnly);
        else void this.join({ mic: false, camera: false, screen: true });
        break;
      case "live":
      case "muted":
        if (!this.callZone) this.events.onNotice(NOTICES.privateOnly);
        else void this.setScreen(!this.sharingMine);
        break;
    }
  }

  /**
   * The player walked into a zone (null: back into the open office). A room with
   * a screen only shows what is shared to people who are in the call, so whoever
   * is not is told what to turn on, before they wonder why the screen is empty.
   */
  enteredZone(zone: string | null) {
    if (!zone || !this.screenZones.has(zone)) return;
    if (this.state === "idle" || this.state === "error")
      this.events.onNotice(NOTICES.joinToSee);
  }

  /** Which rooms of the floor have a screen on a wall: they are known once the floor says what it is made of. */
  setScreenZones(zones: Iterable<string>) {
    this.screenZones = new Set(zones);
  }

  /** The game connection is gone, and the call with it. */
  reset() {
    this.leave();
    this.credentials = null;
    this.setState("unavailable");
  }

  /** Silent teardown, for when the whole game is being shut down. */
  dispose() {
    this.leave();
  }

  /** Re-tunes volume and video subscriptions to the current distances. Call every frame. */
  update(dt: number, me: Position, forEachRemote: ForEachPosition) {
    this.updateMeter(dt);
    this.sinceUpdate += dt;
    const chat = this.chat;
    if (!chat || this.sinceUpdate < UPDATE_INTERVAL) return;
    this.sinceUpdate = 0;

    const zone = this.callZone;
    forEachRemote((identity, x, z) => {
      const distance = Math.hypot(x - me.x, z - me.z);
      chat.setVolume(identity, peerVolume(distance, zone));
      chat.setVideoWanted(
        identity,
        this.receiveVideo &&
          peerWantsVideo(distance, chat.isReceivingVideo(identity), zone),
      );
    });
  }

  private setState(state: VoiceState) {
    this.state = state;
    this.events.onState(state);
    if (state !== "live") this.showMeter(0, 0);
    this.refreshScreen(); // being in the call or not changes what the wall screen says
  }

  /** Reads the microphone while we are transmitting; the bar falls smoothly and reports only when it changes. */
  private updateMeter(dt: number) {
    this.sinceMeter += dt;
    if (this.sinceMeter < METER_INTERVAL) return;
    const elapsed = this.sinceMeter;
    this.sinceMeter = 0;
    if (this.state !== "live") return;

    const level = smoothLevel(
      this.meterLevel,
      this.chat?.micLevel() ?? 0,
      elapsed,
    );
    this.showMeter(level, meterSteps(level));
  }

  private showMeter(level: number, steps: number) {
    this.meterLevel = level;
    if (steps === this.meterSteps) return;
    this.meterSteps = steps;
    this.events.onMicLevel(steps);
  }

  private async join({
    mic,
    camera,
    screen = false,
  }: {
    mic: boolean;
    camera: boolean;
    screen?: boolean;
  }) {
    const credentials = this.credentials;
    if (!credentials) return;
    if (mic && this.mutedByModerator) {
      this.events.onNotice(MUTED_NOTICE);
      mic = false;
    }
    this.leave();

    const chat = new VoiceChat({
      onRemoteVideo: this.events.onRemoteVideo,
      onLocalVideo: (element) => {
        this.cameraOn = element !== null;
        this.events.onCamera(this.cameraOn, element);
      },
      onDisconnected: () => {
        if (this.chat !== chat) return; // a call we already replaced or left
        console.warn("The call was disconnected");
        this.leave();
        this.setState("error");
      },
      onLocalScreen: (on) => {
        if (this.chat !== chat) return;
        this.sharingMine = on;
        this.refreshScreen();
      },
      onRemoteScreen: (identity, name, element) => {
        if (this.chat !== chat) return;
        if (element) this.shares.add(identity, name, element);
        else this.shares.remove(identity);
        this.refreshScreen();
      },
    });
    this.chat = chat;
    this.callZone = credentials.zone;
    this.wanted = { mic, camera };
    this.setState("connecting");

    try {
      await chat.join(credentials, { mic });
    } catch (error) {
      console.warn("Could not join the call", error);
      if (this.chat === chat) {
        this.leave();
        this.setState("error");
        this.events.onNotice(callErrorText(error));
        // The library may have reported the drop before rejecting: the state is already the error, and only the reason is missing
      } else if (this.chat === null && this.state === "error") {
        this.events.onNotice(callErrorText(error));
      }
      return;
    }
    if (this.chat !== chat) return; // left, or a newer attempt replaced this one
    this.setState(mic ? "live" : "muted");
    if (camera) await this.setCamera(true);
    if (screen) await this.setScreen(true);
  }

  /** Whether the browser is asking what to share right now. It takes the mouse away from the game while it does. */
  get choosingScreen(): boolean {
    return this.picking;
  }

  private async setScreen(on: boolean) {
    this.picking = on;
    try {
      await this.chat?.setScreenShareEnabled(on);
    } catch (error) {
      // The picker was closed without choosing, or the browser or server refused
      console.warn("Could not share the screen", error);
      const cancelled =
        error instanceof Error && error.name === "NotAllowedError";
      this.events.onNotice(cancelled ? NOTICES.cancelled : NOTICES.failed);
    } finally {
      this.picking = false;
    }
  }

  /** Tells the wall screen what to show, but only when that has changed. */
  private refreshScreen() {
    const remote = this.shares.current();
    const notInCall =
      !this.chat && (this.state === "idle" || this.state === "error");
    const next: ScreenView = this.sharingMine
      ? { kind: "local" }
      : remote
        ? { kind: "remote", name: remote.name, element: remote.element }
        : notInCall
          ? { kind: "offline" }
          : { kind: "none" };
    const same =
      next.kind === this.view.kind &&
      (next.kind !== "remote" ||
        (this.view.kind === "remote" && this.view.element === next.element));
    if (same) return;
    this.view = next;
    this.events.onScreen(next);
  }

  private async setCamera(on: boolean) {
    this.wanted.camera = on;
    try {
      await this.chat?.setCameraEnabled(on);
    } catch (error) {
      // Denied permission, no camera, or in use by another app: stay in the call without it
      console.warn("Camera unavailable", error);
      this.wanted.camera = false;
    }
  }

  private leave() {
    this.chat?.leave();
    this.chat = null;
    this.cameraOn = false;
    this.sharingMine = false;
    this.shares.clear();
    this.refreshScreen();
  }
}
