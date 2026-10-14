export const TITLE = "People";
export const INTRO =
  "Everybody who has signed in. The head of a floor can edit its layout and can always enter it; admins can do that on every floor and name heads. Under Can enter, choose which rooms each person may enter: everybody can enter the common room.";
export const headColumn = (floor: string) => `Head of ${floor}`;
export const enterColumn = (floor: string) => `Can enter ${floor}`;
export const headLabel = (person: string, floor: string) =>
  `${person} is head of ${floor}`;
export const enterLabel = (person: string, floor: string) =>
  `${person} can enter ${floor}`;
export const ALWAYS_NOTE = "always";
export const LOADING = "Loading…";
export const LOAD_ERROR = "Could not load the people. Try again in a moment.";
export const SAVE_ERROR = "Could not save that change. It was not made.";
export const EMPTY = "Nobody has signed in yet.";
export const ADMIN_BADGE = "Admin";
export const CLOSE_LABEL = "Back";
export const MODERATION_COLUMN = "Moderation";
export const MODERATION_INTRO =
  "Mute, remove or ban somebody. Admins cannot be moderated, and everything is recorded in the activity log.";
export const BAN_LENGTH_LABEL = "Ban length (minutes)";
export const MUTE_LABEL = "Mute";
export const UNMUTE_LABEL = "Let speak";
export const KICK_LABEL = "Remove";
export const BAN_LABEL = "Ban";
export const UNBAN_LABEL = "Lift ban";
export const CONFIRM_LABEL = "Yes, do it";
export const CANCEL_LABEL = "Cancel";
export const bannedUntilText = (until: number) =>
  `Banned until ${new Date(until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
