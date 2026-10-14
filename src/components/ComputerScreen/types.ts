export interface ComputerScreenProps {
  /** The room the computer is in: whose announcements it shows. */
  floor: { id: string; name: string };
  /** A fresh sign-in token, or null when there is none. */
  getToken: () => Promise<string | null>;
  /** Whether this person may add announcements: the empty screen then says where. */
  canEdit: boolean;
}
