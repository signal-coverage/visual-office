export interface CalendarViewProps {
  /** A fresh sign-in token, or null when there is none (or sign-in is off). */
  getToken: () => Promise<string | null>;
  /** Closes the screen and goes back to where the player was. */
  onClose: () => void;
}
