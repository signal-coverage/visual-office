import type { ReactNode } from "react";

export interface InteractionPanelProps {
  title: string;
  /** What to show: text, or what an administrator set up for a computer or a shelf. */
  content: ReactNode;
  /** Whether the panel is for clicking and scrolling (the mouse is free): it takes the mouse and gets a Close button. */
  interactive?: boolean;
  /** Closes it: from the Close button, and from F or Esc when the panel is interactive. */
  onClose?: () => void;
  /** Walked with fingers: the footer says what to tap, not which keys to press. */
  touch?: boolean;
}
