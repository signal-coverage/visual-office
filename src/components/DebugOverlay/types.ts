import type { Diagnostics } from "../../game/Game";

export interface DebugOverlayProps {
  /** Reads the latest numbers. Called a few times per second while the overlay is open. */
  read: () => Diagnostics | null;
}
