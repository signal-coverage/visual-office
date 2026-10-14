import type {
  LocalAudioTrack,
  LocalVideoTrack,
  RemoteParticipant,
  RemoteTrackPublication,
  Room,
} from "livekit-client";
import type { VoiceCredentials } from "../../shared/voice.ts";
import { levelFromRms } from "./micMeter";

/**
 * unavailable: the server has no voice configured (or we are offline)
 * idle: credentials received, not joined yet
 */
export type VoiceState =
  "unavailable" | "idle" | "connecting" | "live" | "muted" | "error";

export interface MediaEvents {
  /** Someone's camera started (an element to draw) or stopped / went out of range (null). */
  onRemoteVideo: (identity: string, element: HTMLVideoElement | null) => void;
  /** Our own camera preview, or null when it is off. */
  onLocalVideo: (element: HTMLVideoElement | null) => void;
  /** The call ended without us leaving it: network drop, or the server removed us. */
  onDisconnected: () => void;
  /** Somebody started sharing their screen (an element to draw), or stopped (null). */
  onRemoteScreen: (
    identity: string,
    name: string,
    element: HTMLVideoElement | null,
  ) => void;
  /** We started or stopped sharing ours, however it happened (the browser's own "stop" button too). */
  onLocalScreen: (sharing: boolean) => void;
}

const CAMERA_CAPTURE = {
  resolution: { width: 480, height: 360, frameRate: 24 },
};

/**
 * Screens are mostly still text and slides: sharp matters more than smooth, so
 * a high resolution at a low frame rate. This is also what keeps the bandwidth
 * of everybody watching (and the LiveKit quota) within reason.
 */
const SCREEN_CAPTURE = {
  audio: false,
  contentHint: "detail" as const,
  resolution: { width: 1920, height: 1080, frameRate: 10 },
};

/**
 * Thin wrapper over a LiveKit room. Participant identities are the Colyseus
 * session ids, so game state and media streams can be matched one to one.
 *
 * Audio is always received (its volume follows distance); video is only
 * subscribed to for nearby people, to save bandwidth.
 *
 * livekit-client is large and only needed once somebody joins the call, so it
 * is loaded on demand instead of being part of the initial bundle.
 */
export class VoiceChat {
  private room: Room | null = null;
  private closed = false;
  private readonly events: MediaEvents;
  private readonly audioElements = new Set<HTMLMediaElement>();
  private readonly audioOfTrack = new Map<object, HTMLMediaElement>();
  private readonly videoPublications = new Map<
    string,
    RemoteTrackPublication
  >();
  /** The <video> of each subscribed camera, kept even while it is muted so it can come back. */
  private readonly remoteVideos = new Map<string, HTMLVideoElement>();
  /** The <video> of each screen somebody is sharing. */
  private readonly screenElements = new Map<string, HTMLVideoElement>();
  private localVideo: {
    track: LocalVideoTrack;
    element: HTMLVideoElement;
  } | null = null;
  /** The parts of livekit-client the meter needs, once it has been loaded. */
  private sdk: Pick<
    typeof import("livekit-client"),
    "Track" | "createAudioAnalyser"
  > | null = null;
  private meter: {
    track: LocalAudioTrack;
    analyser: AnalyserNode;
    buffer: Float32Array<ArrayBuffer>;
    cleanup: () => Promise<void>;
  } | null = null;
  private meterBroken = false;

  constructor(events: MediaEvents) {
    this.events = events;
  }

  async join({ url, token }: VoiceCredentials, { mic }: { mic: boolean }) {
    const { Room, RoomEvent, Track, createAudioAnalyser } =
      await import("livekit-client");
    if (this.closed) return;
    this.sdk = { Track, createAudioAnalyser };

    const room = new Room();
    this.room = room;

    // A shared screen is video too, but it is not somebody's camera
    const isScreen = (publication: { source: unknown }) =>
      publication.source === Track.Source.ScreenShare;

    const handlePublication = (
      publication: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      if (publication.kind === Track.Kind.Audio) {
        publication.setSubscribed(true);
      } else if (publication.kind === Track.Kind.Video) {
        // The wall screen shows a shared screen to everybody in the room, near or far;
        // cameras are subscribed later, by proximity (see setVideoWanted)
        if (isScreen(publication)) publication.setSubscribed(true);
        else this.videoPublications.set(participant.identity, publication);
      }
    };

    room.on(RoomEvent.TrackPublished, handlePublication);
    room.on(RoomEvent.TrackUnpublished, (publication, participant) => {
      if (publication.kind === Track.Kind.Video && !isScreen(publication))
        this.videoPublications.delete(participant.identity);
    });
    room.on(RoomEvent.Disconnected, () => {
      // leave() sets `closed` first, so this only fires for drops we did not cause
      if (!this.closed) this.events.onDisconnected();
    });
    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      this.videoPublications.delete(participant.identity);
      if (this.screenElements.delete(participant.identity))
        this.events.onRemoteScreen(
          participant.identity,
          participant.name || participant.identity,
          null,
        );
    });
    room.on(RoomEvent.LocalTrackPublished, (publication) => {
      if (isScreen(publication)) this.events.onLocalScreen(true);
    });
    room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
      if (isScreen(publication)) this.events.onLocalScreen(false);
    });

    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (track.kind === Track.Kind.Audio) {
        // Silent until the first proximity update decides how loud they should be
        participant.setVolume(0);
        const element = track.attach();
        this.audioElements.add(element);
        this.audioOfTrack.set(track, element);
        document.body.appendChild(element);
      } else if (track.kind === Track.Kind.Video) {
        // attach() is typed as a generic media element, but a video track yields a <video>
        const element = track.attach() as HTMLVideoElement;
        if (isScreen(publication)) {
          this.screenElements.set(participant.identity, element);
          this.events.onRemoteScreen(
            participant.identity,
            participant.name || participant.identity,
            element,
          );
          return;
        }
        this.remoteVideos.set(participant.identity, element);
        if (!publication.isMuted)
          this.events.onRemoteVideo(participant.identity, element);
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      // When someone leaves, LiveKit may already have detached the element by now,
      // so detach() returns nothing: remove the one we kept, or it stays in the page.
      const kept = this.audioOfTrack.get(track);
      for (const element of [...track.detach(), ...(kept ? [kept] : [])]) {
        element.remove();
        this.audioElements.delete(element);
      }
      this.audioOfTrack.delete(track);
      if (track.kind === Track.Kind.Video && isScreen(publication)) {
        if (this.screenElements.delete(participant.identity))
          this.events.onRemoteScreen(
            participant.identity,
            participant.name || participant.identity,
            null,
          );
      } else if (track.kind === Track.Kind.Video) {
        this.remoteVideos.delete(participant.identity);
        this.events.onRemoteVideo(participant.identity, null);
      }
    });

    // Turning a camera off only mutes the track: it stays published and subscribed,
    // so without this the last frame (then a black box) would stay on their avatar.
    const isCamera = (publication: { kind: unknown; source: unknown }) =>
      publication.kind === Track.Kind.Video && !isScreen(publication);
    room.on(RoomEvent.TrackMuted, (publication, participant) => {
      if (participant.isLocal || !isCamera(publication)) return;
      this.events.onRemoteVideo(participant.identity, null);
    });
    room.on(RoomEvent.TrackUnmuted, (publication, participant) => {
      if (participant.isLocal || !isCamera(publication)) return;
      const element = this.remoteVideos.get(participant.identity);
      if (element) this.events.onRemoteVideo(participant.identity, element);
    });

    await room.connect(url, token, { autoSubscribe: false });
    for (const participant of room.remoteParticipants.values()) {
      for (const publication of participant.trackPublications.values()) {
        handlePublication(publication, participant);
      }
    }
    await room.startAudio();
    if (mic) await room.localParticipant.setMicrophoneEnabled(true);

    // leave() ran while we were connecting: undo what we just set up
    if (this.closed) this.leave();
  }

  setMuted(muted: boolean) {
    void this.room?.localParticipant.setMicrophoneEnabled(!muted);
  }

  /**
   * Starts or stops sharing our screen. Starting makes the browser ask what to
   * share, and rejects (NotAllowedError) if the player closes that without choosing.
   * Whether it is on is reported through `onLocalScreen`, which also covers the
   * browser's own "stop sharing" button.
   */
  async setScreenShareEnabled(enabled: boolean) {
    await this.room?.localParticipant.setScreenShareEnabled(
      enabled,
      enabled ? SCREEN_CAPTURE : undefined,
    );
  }

  /** Turns our camera on or off. Rejects if the camera cannot be used (denied, missing). */
  async setCameraEnabled(enabled: boolean) {
    const room = this.room;
    if (!room) return;

    if (!enabled) {
      await room.localParticipant.setCameraEnabled(false);
      this.clearLocalVideo();
      return;
    }

    const publication = await room.localParticipant.setCameraEnabled(
      true,
      CAMERA_CAPTURE,
    );
    const track = publication?.videoTrack;
    if (!track) return;
    const element = track.attach() as HTMLVideoElement;
    this.localVideo = { track, element };
    this.events.onLocalVideo(element);
  }

  /**
   * How loud our own microphone is right now (0..1), read from the track that is
   * really being sent, so a bar that moves means the sound is leaving this page.
   * 0 when the microphone is off, muted or cannot be read.
   */
  micLevel(): number {
    const sdk = this.sdk;
    const track = sdk
      ? this.room?.localParticipant.getTrackPublication(
          sdk.Track.Source.Microphone,
        )?.audioTrack
      : undefined;
    if (!sdk || !track || this.meterBroken) {
      this.dropMeter();
      return 0;
    }

    if (this.meter?.track !== track) {
      this.dropMeter();
      try {
        const { analyser, cleanup } = sdk.createAudioAnalyser(track, {
          fftSize: 1024,
        });
        if (analyser.context instanceof AudioContext)
          void analyser.context.resume().catch(() => {});
        this.meter = {
          track,
          analyser,
          buffer: new Float32Array(analyser.fftSize),
          cleanup,
        };
      } catch (error) {
        // No Web Audio: the call still works, only the bar stays empty
        console.warn("Microphone meter unavailable", error);
        this.meterBroken = true;
        return 0;
      }
    }

    const { analyser, buffer } = this.meter;
    analyser.getFloatTimeDomainData(buffer);
    let sum = 0;
    for (const sample of buffer) sum += sample * sample;
    return levelFromRms(Math.sqrt(sum / buffer.length));
  }

  setVolume(identity: string, volume: number) {
    this.room?.remoteParticipants.get(identity)?.setVolume(volume);
  }

  isReceivingVideo(identity: string): boolean {
    return this.videoPublications.get(identity)?.isSubscribed ?? false;
  }

  /** Starts or stops receiving someone's video. No-op if they have no camera on. */
  setVideoWanted(identity: string, wanted: boolean) {
    const publication = this.videoPublications.get(identity);
    if (publication && publication.isSubscribed !== wanted)
      publication.setSubscribed(wanted);
  }

  private dropMeter() {
    if (!this.meter) return;
    void this.meter.cleanup().catch(() => {});
    this.meter = null;
  }

  leave() {
    this.closed = true;
    this.dropMeter();
    this.clearLocalVideo();
    for (const element of this.audioElements) element.remove();
    this.audioElements.clear();
    this.audioOfTrack.clear();
    // Disconnecting does not reliably report each feed as gone: do it ourselves
    for (const identity of this.remoteVideos.keys())
      this.events.onRemoteVideo(identity, null);
    this.remoteVideos.clear();
    this.screenElements.clear(); // the call's owner clears the wall screen itself
    this.videoPublications.clear();
    void this.room?.disconnect();
    this.room = null;
  }

  private clearLocalVideo() {
    if (!this.localVideo) return;
    this.localVideo.track.detach(this.localVideo.element);
    this.localVideo = null;
    this.events.onLocalVideo(null);
  }
}
