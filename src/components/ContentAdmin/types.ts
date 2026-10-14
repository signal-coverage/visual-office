export interface ContentAdminProps {
  /** A fresh sign-in token, or null when there is none. */
  getToken: () => Promise<string | null>;
  /** Closes the screen and goes back to the lobby. */
  onClose: () => void;
}
