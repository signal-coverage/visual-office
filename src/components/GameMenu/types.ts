import type { Appearance } from "../../../shared/appearance.ts";
import type { Settings } from "../../App/settings";

export interface GameMenuProps {
  /** Shown on the name tag of the character preview. */
  name: string;
  /** How the player looks now. */
  look: Appearance;
  settings: Settings;
  /** Closes the menu and goes back to the office. */
  onResume: () => void;
  /** Saves a new look: the server checks it and everybody sees it. */
  onChangeLook: (look: Appearance) => void;
  onChangeSettings: (settings: Settings) => void;
  /** Leaves the office and goes back to the first screen. */
  onLeave: () => void;
  /** Ends the session. Only there when somebody signed in. */
  onSignOut?: () => void;
}

export type Panel = "main" | "character" | "controls" | "options";
