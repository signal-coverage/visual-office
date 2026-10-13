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

/** The dot of each state, as a Tailwind background class. */
export const VOICE_COLOR: Record<VoiceState, string> = {
  unavailable: "bg-[#888]",
  idle: "bg-[#888]",
  connecting: "bg-[#f5b942]",
  live: "bg-[#3ddc84]",
  muted: "bg-[#ff5c5c]",
  error: "bg-[#ff5c5c]",
};
