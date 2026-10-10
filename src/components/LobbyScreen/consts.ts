import { MAX_NAME_LENGTH } from "../../../shared/name.ts";
import type { LobbyPhase } from "./types";

export const TITLE = "Visual Office";
export const SUBTITLE = "Walk around, chat and talk with whoever is near you.";
export const NAME_LABEL = "Your name";
export const NAME_PLACEHOLDER = "e.g. Ana";
export const NAME_MAX_LENGTH = MAX_NAME_LENGTH;

export const BUTTON_LABEL: Record<LobbyPhase, string> = {
  lobby: "Enter office",
  connecting: "Connecting…",
  offline: "Try again",
};

export const CONTROLS: ReadonlyArray<readonly [keys: string, action: string]> =
  [
    ["W A S D", "Move"],
    ["Shift", "Run"],
    ["Mouse", "Look around"],
    ["Enter", "Chat"],
    ["M", "Join voice / mute"],
    ["C", "Camera on / off"],
    ["Esc", "Release the mouse"],
  ];
