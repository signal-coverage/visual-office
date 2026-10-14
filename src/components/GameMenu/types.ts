import type { Appearance } from "../../../shared/appearance.ts";
import type { Emote } from "../../../shared/emotes.ts";
import type { Status } from "../../../shared/presence.ts";
import type { ModerationAction } from "../../../shared/moderation.ts";
import type { Settings } from "../../App/settings";
import type { ModerationPerson } from "../ModerationPanel/types";

export interface GameMenuProps {
  /** Shown on the name tag of the character preview. */
  name: string;
  /** How the player looks now. */
  look: Appearance;
  settings: Settings;
  /** What the player chose to show as doing. */
  status: Status;
  /** What everybody sees now: it differs from the choice when they are away or in a meeting by themselves. */
  shownStatus: Status;
  /** Chooses what to show as doing: the server checks it and everybody sees it. */
  onChangeStatus: (status: Status) => void;
  /** Makes a gesture everybody can see. */
  onEmote: (emote: Emote) => void;
  /** Knocks on the private room we stand at, or on the person we face. */
  onKnock: () => void;
  /** Opens the schedule of the private rooms. */
  onOpenCalendar: () => void;
  /** Turns the browser's own notifications on (which asks the browser for permission) or off. */
  onToggleDesktopNotifications: (on: boolean) => void;
  /** Closes the menu and goes back to the office. */
  onResume: () => void;
  /** Saves a new look: the server checks it and everybody sees it. */
  onChangeLook: (look: Appearance) => void;
  onChangeSettings: (settings: Settings) => void;
  /** Leaves the office and goes back to the first screen. */
  onLeave: () => void;
  /** Ends the session. Only there when somebody signed in. */
  onSignOut?: () => void;
  /** Only for somebody the server lets moderate: who is here, and how to ask for an action on them. */
  moderation?: {
    people: ModerationPerson[];
    onAct: (action: ModerationAction, target: string, minutes?: number) => void;
  };
}

export type Panel =
  | "main"
  | "character"
  | "status"
  | "emotes"
  | "controls"
  | "options"
  | "moderation";
