import { CONTROLS } from "../../App/controls";
import type { AdminTool } from "./types";

export const TITLE = "Visual Office";
export const TAGLINE = "Walk around, chat and talk with whoever is near you.";
export const MENU_LABEL = "Main menu";
export const PREVIEW_FALLBACK_NAME = "You";
export const enteringRoom = (name: string) => `You will enter: ${name}`;

export const LABELS = {
  enter: "Enter the office",
  rooms: "Enter a different office",
  customize: "Customize character",
  exit: "Exit",
  admin: "Administration",
} as const;

export const CONNECTING_LABEL = "Connecting…";
export const ONLY_ONE_OFFICE = "There is only one office";
export const LOOKING_FOR_OFFICES = "Looking for offices…";

export const ADMIN_TITLE = "Administration";
export const ADMIN_CLOSE = "Close";

export const ADMIN_LABELS: Record<AdminTool["id"], string> = {
  onEditFloor: "Edit this floor",
  onManagePeople: "Manage people",
  onInvitePeople: "Invite people",
  onOpenSettings: "Settings",
  onOpenActivity: "Activity",
  onOpenCalendars: "Calendars",
  onManageRooms: "Rooms",
  onManageGroups: "Groups",
  onManageContent: "Content",
};

export const EXIT_CONFIRM = {
  title: "Leave and sign out?",
  body: "You will go back to the sign-in screen.",
  cancel: "Cancel",
  confirm: "Exit",
} as const;

/** The few keys reminded under the menu; the in-game menu lists them all. */
export const HINT_KEYS = ["W A S D", "Shift", "Mouse", "Esc"] as const;

/** The same on a phone, where there are no keys: the gestures. */
export const TOUCH_HINTS = [
  ["Left thumb", "Move"],
  ["Right thumb", "Look"],
  ["Tap", "Use"],
] as const;

export const actionOf = (keys: string) =>
  CONTROLS.find(([candidate]) => candidate === keys)?.[1] ?? "";
