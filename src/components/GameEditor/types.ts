export interface GameEditorProps {
  /** A fresh sign-in token, or null when there is none. */
  getToken: () => Promise<string | null>;
  /** Leaves the editor and goes back to the office menu. */
  onClose: () => void;
}
