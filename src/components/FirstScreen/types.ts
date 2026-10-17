import type { ReactNode } from "react";
import type { Appearance } from "../../../shared/appearance.ts";
import type { FloorInfo } from "../../../shared/floors.ts";
import type { FirstScreenPhase } from "../../App/firstScreen";
import type { AdminHandlers } from "../MainMenu";

export interface FirstScreenProps {
  /** Where the connection is: connecting shows the wait, offline brings the player back with `message`. */
  phase: FirstScreenPhase;
  initialName: string;
  initialAppearance: Appearance;
  /** The name of somebody who signed in and may not change it. */
  fixedName?: string;
  /** Why the player is back here (connection failed or dropped). */
  message: string | null;
  /** The rooms and which of them may be entered; null until the server has said. */
  floors: readonly FloorInfo[] | null;
  /** The room the player was last in: where Enter the office goes when it can. */
  lastFloor: string;
  /** A fresh sign-in token, or null when there is none (or sign-in is off). */
  getToken: () => Promise<string | null>;
  accountMenu?: ReactNode;
  admin: AdminHandlers;
  /** Ends the session of somebody who signed in; without it, Exit says goodbye instead. */
  onSignOut?: () => void;
  touch: boolean;
  /** Asks the app to join a room with this name and look. */
  onJoin: (name: string, appearance: Appearance, floor: string) => void;
  /** Asks again which rooms there are. */
  onRefreshFloors: () => void;
}
