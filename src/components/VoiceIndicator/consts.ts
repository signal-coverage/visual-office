import type { VoiceState } from "../../game/VoiceChat";

export const VOICE_LABEL: Record<VoiceState, string> = {
  unavailable: "",
  idle: "M: join voice · C: camera",
  connecting: "Joining the call…",
  live: "Mic on · M: mute · C: camera",
  muted: "Muted · M: unmute · C: camera",
  error: "Call failed · M: retry",
};

export const CAMERA_SUFFIX = " · Camera on";

export const VOICE_COLOR: Record<VoiceState, string> = {
  unavailable: "#888",
  idle: "#888",
  connecting: "#f5b942",
  live: "#3ddc84",
  muted: "#ff5c5c",
  error: "#ff5c5c",
};
