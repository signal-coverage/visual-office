import type { ModerationAction } from "../../../shared/moderation.ts";
import type { Status } from "../../../shared/presence.ts";

export interface ModerationPerson {
  /** Their session in the room: what the server is asked about. */
  id: string;
  name: string;
  status: Status;
}

export interface ModerationPanelProps {
  /** Everybody else the moderator sees in the office. */
  people: ModerationPerson[];
  /** Asks the server to do it: it checks that the moderator may. */
  onAct: (action: ModerationAction, target: string, minutes?: number) => void;
  /** Goes back to the menu. */
  onBack: () => void;
}
