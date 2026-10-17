import type { VoiceState } from "../../game/VoiceChat";
import type { LitePhase } from "./types";

export const TITLE = "Lite mode";
export const SUBTITLE =
  "This device cannot show the 3D office, but you can still be in it.";
export const NAME_LABEL = "Your name";
export const NAME_PLACEHOLDER = "e.g. Ana";
export const NAME_LOCKED_HINT = "Your name comes from your account.";

export const BUTTON_LABEL: Record<LitePhase, string> = {
  lobby: "Join the office",
  connecting: "Connecting…",
  online: "Join the office",
  offline: "Try again",
};

export const TRY_OFFICE_LABEL = "Try the 3D office anyway";
export const CALENDARS_LABEL = "Room calendars";
export const LEAVE_LABEL = "Leave";
export const SIGN_OUT_LABEL = "Sign out";
export const RECONNECTING_MESSAGE = "Connection lost. Reconnecting…";

export const INCLUDED_TITLE = "What works here";
export const INCLUDED = [
  "See who is in the office, and who is away or busy.",
  "Read and send chat messages, to everybody or to one person.",
  "Open the calendars of the rooms.",
  "Voice, where the server has it: join the call and talk. You hear everybody in the open office and they hear you. Your microphone is asked for only when you press Join voice, and you can mute and unmute yourself.",
] as const;

export const MISSING_TITLE = "What is not included";
export const MISSING = [
  "Seeing the office or walking in it. You stay where new people arrive, so the nearby chat and what others hear of your voice come from that spot.",
  "Cameras and screen sharing.",
  "Choosing your status, emotes, knocking and the whiteboards. You show as away by yourself after a few minutes without touching anything.",
] as const;

/** The voice button of the game talks about keys and the camera: neither is here. */
export const VOICE_LABELS: Record<VoiceState, string> = {
  unavailable: "",
  idle: "Join voice · asks for your microphone",
  connecting: "Joining the call…",
  live: "Mic on · tap to mute",
  muted: "Muted · tap to unmute",
  error: "Call failed · tap to retry",
};

/** Said instead of the voice button when the server has no call to join: not a missing feature of this screen. */
export const VOICE_UNAVAILABLE =
  "Voice is not available on this server, so there is no call to join.";

export const ONLINE_NOTE = "You are in the office as";
