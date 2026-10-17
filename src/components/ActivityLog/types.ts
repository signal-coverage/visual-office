export interface ActivityLogProps {
  /** A fresh sign-in token, or null when there is none. */
  getToken: () => Promise<string | null>;
  /** Leaves the screen and goes back to the main menu. */
  onClose: () => void;
}
