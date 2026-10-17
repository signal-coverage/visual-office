import type { VoiceState } from "../../game/VoiceChat";

export const LABELS = {
  menu: "Menu",
  chat: "Chat",
  people: "People list",
  map: "Map of rooms",
  emotes: "Emotes",
  knock: "Knock",
  camera: "Camera",
  stand: "Stand up",
} as const;

export const ICONS = {
  menu: "☰",
  chat: "\u{1F4AC}",
  people: "\u{1F465}",
  map: "\u{1F5FA}️",
  emotes: "\u{1F600}",
  knock: "✊",
  camera: "\u{1F4F7}",
} as const;

/** What the voice button says (to a screen reader, and as its tooltip) in each state. */
export const VOICE_LABELS: Record<VoiceState, string> = {
  unavailable: "",
  idle: "Join voice",
  connecting: "Joining the call",
  live: "Microphone on, tap to mute",
  muted: "Muted, tap to unmute",
  error: "Call failed, tap to try again",
};

export const VOICE_ICONS: Record<VoiceState, string> = {
  unavailable: "",
  idle: "\u{1F399}️",
  connecting: "⏳",
  live: "\u{1F3A4}",
  muted: "\u{1F507}",
  error: "⚠️",
};

export const EMOTES_BAR_LABEL = "Emotes";
