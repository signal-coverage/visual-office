import { MAX_NAME_LENGTH } from "../../../shared/name.ts";
import { CONTROLS } from "../../App/controls";
import type { LobbyPhase } from "./types";

export const EYEBROW = "Visual Office";
export const TITLE = "Lobby";
export const SUBTITLE = "Walk around, chat and talk with whoever is near you.";
export const NAME_LABEL = "Your name";
export const NAME_PLACEHOLDER = "e.g. Ana";
export const NAME_MAX_LENGTH = MAX_NAME_LENGTH;
/** What the name tag of the preview says until a name is typed. */
export const PREVIEW_FALLBACK_NAME = "You";

export const BUTTON_LABEL: Record<LobbyPhase, string> = {
  lobby: "Enter office",
  connecting: "Connecting…",
  offline: "Try again",
};

export const EDIT_FLOOR_LABEL = "Edit this floor";
export const MANAGE_PEOPLE_LABEL = "Manage people";
export const INVITE_PEOPLE_LABEL = "Invite people";
export const SETTINGS_LABEL = "Settings";
export const ACTIVITY_LABEL = "Activity";
export const CALENDARS_LABEL = "Calendars";
export const NAME_LOCKED_HINT = "Your name comes from your account.";

/** The few keys the lobby reminds you of; the menu lists them all. */
export const HINT_KEYS = ["W A S D", "Shift", "Mouse", "Esc"] as const;

export const actionOf = (keys: string) =>
  CONTROLS.find(([candidate]) => candidate === keys)?.[1] ?? "";
