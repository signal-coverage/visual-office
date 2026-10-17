import type { ReactNode } from "react";
import type { Appearance } from "../../../shared/appearance.ts";
import type { FloorInfo } from "../../../shared/floors.ts";
import type { SignedInUser } from "../../App/types";

export type MenuItemId = "enter" | "rooms" | "customize" | "exit";

export interface MenuItem {
  id: MenuItemId;
  label: string;
  disabled: boolean;
  /** Why the item cannot be used. */
  hint?: string;
}

/** The tools of the administration, each present only for those who may use it. */
export type AdminHandlers = Pick<
  SignedInUser,
  | "onEditFloor"
  | "onManagePeople"
  | "onInvitePeople"
  | "onOpenSettings"
  | "onOpenActivity"
  | "onOpenCalendars"
  | "onManageRooms"
  | "onManageGroups"
  | "onManageContent"
>;

export interface AdminTool {
  id: keyof AdminHandlers;
  label: string;
  onPress: () => void;
}

export interface MainMenuProps {
  name: string;
  appearance: Appearance;
  /** The rooms and which of them may be entered; null until the server has said. */
  floors: readonly FloorInfo[] | null;
  /** Joining: the buttons wait. */
  busy: boolean;
  /** Why the player is back here (connection failed or dropped). */
  message: string | null;
  /** The name of the room "Enter the office" goes to, when it is not the common one. */
  roomName: string | null;
  accountMenu?: ReactNode;
  admin: AdminHandlers;
  /** Whether Exit signs the person out (and asks first). */
  signOutOnExit: boolean;
  /** Walked with fingers: the keys are not reminded. */
  touch: boolean;
  onEnter: () => void;
  onOtherOffice: () => void;
  onCustomize: () => void;
  onExit: () => void;
}
