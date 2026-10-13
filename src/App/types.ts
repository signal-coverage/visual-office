import type { ReactNode } from "react";
import type { Appearance } from "../../shared/appearance.ts";
/** lobby: name screen · connecting: joining · online: playing · offline: failed or dropped */
export type Phase = "lobby" | "connecting" | "online" | "offline";

/** Somebody who signed in, as the app needs to know them. */
export interface SignedInUser {
  /** The name of their profile: the server uses it, whatever the lobby shows. */
  displayName: string;
  /** A fresh proof of who they are (it lasts about a minute), or null if there is none. */
  getToken: () => Promise<string | null>;
  /** Their account menu (to sign out), shown in the lobby. */
  accountMenu?: ReactNode;
  /** How they looked last time (kept on the server), or nothing if they never chose. */
  appearance?: Appearance | null;
  /** Ends their session. */
  signOut?: () => void;
  /** Opens the office editor: only for those who may edit the floor. */
  onEditFloor?: () => void;
  /** Opens the screen to name the heads of floors: only for admins. */
  onManagePeople?: () => void;
  /** Opens the screen to invite people to the company: only for admins. */
  onInvitePeople?: () => void;
}

export interface AppProps {
  /** Set when the office asks people to sign in; without it, anybody may enter. */
  signedIn?: SignedInUser;
}
