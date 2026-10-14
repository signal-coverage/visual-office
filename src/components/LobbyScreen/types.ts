import type { ReactNode } from "react";
import type { Appearance } from "../../../shared/appearance.ts";

export type LobbyPhase = "lobby" | "connecting" | "offline";

export interface LobbyScreenProps {
  phase: LobbyPhase;
  initialName: string;
  initialAppearance: Appearance;
  /** Why the player is back in the lobby (connection failed or dropped). */
  message: string | null;
  /** The name of somebody who signed in: shown, and not for them to change. */
  fixedName?: string;
  /** Their account menu (to sign out), when they signed in. */
  accountMenu?: ReactNode;
  /** Opens the office editor: only offered to those who may edit the floor. */
  onEditFloor?: () => void;
  /** Opens the screen to name the heads of floors: only offered to admins. */
  onManagePeople?: () => void;
  /** Opens the screen to invite people to the company: only offered to admins. */
  onInvitePeople?: () => void;
  /** Opens the company's settings: only offered to admins. */
  onOpenSettings?: () => void;
  /** Opens the activity log: only offered to admins. */
  onOpenActivity?: () => void;
  /** Opens where the calendars of the rooms are set: only offered to admins. */
  onOpenCalendars?: () => void;
  /** The room the player enters (and edits) when it is not the common one: the last they were in. */
  roomName?: string | null;
  /** Opens the screen where rooms are made and named: only offered to admins. */
  onManageRooms?: () => void;
  /** Opens the screen where books and announcements are set up: only offered to admins and heads of floors. */
  onManageContent?: () => void;
  onJoin: (name: string, appearance: Appearance) => void;
}
