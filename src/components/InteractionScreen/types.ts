import type { PanelContent } from "../../../shared/interactions.ts";

export interface InteractionScreenProps {
  panel: PanelContent;
  /** The room the player is in: whose content the computers and shelves show. */
  floor: { id: string; name: string };
  /** A fresh sign-in token, or null when there is none. */
  getToken: () => Promise<string | null>;
  /** Whether the player may set up content: the empty screens then say where. */
  canEdit: boolean;
  /** Puts the panel away (and gives the mouse back to the game). */
  onClose: () => void;
  /** Walked with fingers: the panel says what to tap instead of which keys to press. */
  touch?: boolean;
}
