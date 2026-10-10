import type {
  LocalVideoTrack,
  RemoteParticipant,
  RemoteTrackPublication,
  Room,
} from "livekit-client";
import type { VoiceCredentials } from "../../shared/voice.ts";

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
}

const CAMERA_CAPTURE = {
  resolution: { width: 480, height: 360, frameRate: 24 },
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
  private readonly videoPublications = new Map<
    string,
    RemoteTrackPublication
  >();
  /** The <video> of each subscribed camera, kept even while it is muted so it can come back. */
  private readonly remoteVideos = new Map<string, HTMLVideoElement>();
  private localVideo: {
    track: LocalVideoTrack;
    element: HTMLVideoElement;
  } | null = null;

  constructor(events: MediaEvents) {
    this.events = events;
  }

  async join({ url, token }: VoiceCredentials, { mic }: { mic: boolean }) {
    const { Room, RoomEvent, Track } = await import("livekit-client");
    if (this.closed) return;

    const room = new Room();
    this.room = room;

    const handlePublication = (
      publication: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      if (publication.kind === Track.Kind.Audio) {
        publication.setSubscribed(true);
      } else if (publication.kind === Track.Kind.Video) {
        // Subscribed later, by proximity (see setVideoWanted)
        this.videoPublications.set(participant.identity, publication);
      }
    };

    room.on(RoomEvent.TrackPublished, handlePublication);
    room.on(RoomEvent.TrackUnpublished, (publication, participant) => {
      if (publication.kind === Track.Kind.Video)
        this.videoPublications.delete(participant.identity);
    });
    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      this.videoPublications.delete(participant.identity);
    });

    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (track.kind === Track.Kind.Audio) {
        // Silent until the first proximity update decides how loud they should be
        participant.setVolume(0);
        const element = track.attach();
        this.audioElements.add(element);
        document.body.appendChild(element);
      } else if (track.kind === Track.Kind.Video) {
        // attach() is typed as a generic media element, but a video track yields a <video>
        const element = track.attach() as HTMLVideoElement;
        this.remoteVideos.set(participant.identity, element);
        if (!publication.isMuted)
          this.events.onRemoteVideo(participant.identity, element);
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (track, _publication, participant) => {
      for (const element of track.detach()) {
        element.remove();
        this.audioElements.delete(element);
      }
      if (track.kind === Track.Kind.Video) {
        this.remoteVideos.delete(participant.identity);
        this.events.onRemoteVideo(participant.identity, null);
      }
    });

    // Turning a camera off only mutes the track: it stays published and subscribed,
    // so without this the last frame (then a black box) would stay on their avatar.
    room.on(RoomEvent.TrackMuted, (publication, participant) => {
      if (participant.isLocal || publication.kind !== Track.Kind.Video) return;
      this.events.onRemoteVideo(participant.identity, null);
    });
    room.on(RoomEvent.TrackUnmuted, (publication, participant) => {
      if (participant.isLocal || publication.kind !== Track.Kind.Video) return;
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

  leave() {
    this.closed = true;
    this.clearLocalVideo();
    for (const element of this.audioElements) element.remove();
    this.audioElements.clear();
    // Disconnecting does not reliably report each feed as gone: do it ourselves
    for (const identity of this.remoteVideos.keys())
      this.events.onRemoteVideo(identity, null);
    this.remoteVideos.clear();
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
