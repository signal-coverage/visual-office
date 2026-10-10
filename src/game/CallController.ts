import {
  proximityVolume,
  wantsVideo,
  type VoiceCredentials,
} from "../../shared/voice.ts";
import { VoiceChat, type VoiceState } from "./VoiceChat";

export interface CallEvents {
  onState: (state: VoiceState) => void;
  /** Our camera turned on (with a preview to show) or off (null). */
  onCamera: (on: boolean, selfView: HTMLVideoElement | null) => void;
  /** Someone nearby has a camera feed to draw, or lost it (null). */
  onRemoteVideo: (identity: string, element: HTMLVideoElement | null) => void;
}

type Position = { x: number; z: number };
type ForEachPosition = (
  callback: (identity: string, x: number, z: number) => void,
) => void;

const UPDATE_INTERVAL = 0.2;

/**
 * The audio/video call: joining it, microphone, camera, and tuning what we
 * receive to how far away each person is.
 *
 * Joining with the camera key keeps the microphone off, so nobody starts
 * transmitting sound just because they wanted to show their face.
 */
export class CallController {
  private readonly events: CallEvents;
  private chat: VoiceChat | null = null;
  private credentials: VoiceCredentials | null = null;
  private state: VoiceState = "unavailable";
  private cameraOn = false;
  private sinceUpdate = 0;

  constructor(events: CallEvents) {
    this.events = events;
  }

  /** The game server gave us credentials: the call is now available. */
  setCredentials(credentials: VoiceCredentials) {
    this.credentials = credentials;
    if (this.state === "unavailable") this.setState("idle");
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
        this.setState("muted");
        break;
      case "muted":
        this.chat?.setMuted(false);
        this.setState("live");
        break;
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
    this.sinceUpdate += dt;
    const chat = this.chat;
    if (!chat || this.sinceUpdate < UPDATE_INTERVAL) return;
    this.sinceUpdate = 0;

    forEachRemote((identity, x, z) => {
      const distance = Math.hypot(x - me.x, z - me.z);
      chat.setVolume(identity, proximityVolume(distance));
      chat.setVideoWanted(
        identity,
        wantsVideo(distance, chat.isReceivingVideo(identity)),
      );
    });
  }

  private setState(state: VoiceState) {
    this.state = state;
    this.events.onState(state);
  }

  private async join({ mic, camera }: { mic: boolean; camera: boolean }) {
    const credentials = this.credentials;
    if (!credentials) return;
    this.leave();

    const chat = new VoiceChat({
      onRemoteVideo: this.events.onRemoteVideo,
      onLocalVideo: (element) => {
        this.cameraOn = element !== null;
        this.events.onCamera(this.cameraOn, element);
      },
    });
    this.chat = chat;
    this.setState("connecting");

    try {
      await chat.join(credentials, { mic });
    } catch (error) {
      console.warn("Could not join the call", error);
      if (this.chat !== chat) return;
      this.leave();
      this.setState("error");
      return;
    }
    if (this.chat !== chat) return; // left, or a newer attempt replaced this one
    this.setState(mic ? "live" : "muted");
    if (camera) await this.setCamera(true);
  }

  private async setCamera(on: boolean) {
    try {
      await this.chat?.setCameraEnabled(on);
    } catch (error) {
      // Denied permission, no camera, or in use by another app: stay in the call without it
      console.warn("Camera unavailable", error);
    }
  }

  private leave() {
    this.chat?.leave();
    this.chat = null;
    this.cameraOn = false;
  }
}
