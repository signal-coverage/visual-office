import type { FeedOutcome, FeedTest } from "../../calendar/admin";

export interface CalendarsAdminProps {
  /** A fresh sign-in token, or null when there is none. */
  getToken: () => Promise<string | null>;
  /** Closes the screen and goes back to the main menu. */
  onClose: () => void;
}

export interface FeedRowProps {
  label: string;
  /** The address kept for this room, or null when it has none. */
  initialUrl: string | null;
  /** Saves the address (an empty one removes the feed). */
  onSave: (
    url: string,
  ) => Promise<FeedOutcome<{ url: string | null; test: FeedTest | null }>>;
  /** Reads the address once, without saving it. */
  onTest: (url: string) => Promise<FeedOutcome<{ test: FeedTest }>>;
}
