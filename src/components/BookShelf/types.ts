export interface BookShelfProps {
  /** The room the shelf is in: whose books it holds. */
  floor: { id: string; name: string };
  /** A fresh sign-in token, or null when there is none. */
  getToken: () => Promise<string | null>;
  /** Whether this person may add books: the empty shelf then says where. */
  canEdit: boolean;
}

export interface BookReaderProps {
  floor: string;
  id: string;
  request: (url: string, init?: RequestInit) => Promise<Response>;
  base: string;
  onBack: () => void;
}
