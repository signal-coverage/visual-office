import type { ReactNode } from "react";

export interface HudColumnProps {
  /** Walked with fingers: the badges are stacked in a column. */
  touch: boolean;
  children: ReactNode;
}
