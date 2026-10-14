import type { SignedInUser } from "../../App/types";
import type { LiteReason } from "../../lite/device";

export interface LiteOfficeProps {
  /** Why the 3D office is not shown: said on the screen, so nobody wonders. */
  reason: LiteReason;
  /** Somebody who signed in: the name, token and calendars come from them. */
  signedIn?: SignedInUser;
  /** Goes to the 3D office anyway, where the device can at least try. Not offered without WebGL. */
  onTryOffice?: () => void;
}

/** lobby: name screen · connecting: joining · online: in the room · offline: failed or dropped */
export type LitePhase = "lobby" | "connecting" | "online" | "offline";
