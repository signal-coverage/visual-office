import type { ChatScope } from "../../../shared/chat.ts";
import type { Status } from "../../../shared/presence.ts";
import type { ChatEntry } from "../../chat/alerts";

/** Somebody a direct message can be sent to. */
export interface ChatPerson {
  id: string;
  name: string;
  status: Status;
}

export interface ChatPanelProps {
  messages: ChatEntry[];
  /** Everybody else the player can see, to pick the one a direct message is for. */
  people: ChatPerson[];
  /** Direct messages not read yet: shown on the button. */
  unread: number;
  /** Sends a message; for a direct one, `to` is the person. The server decides who gets it. */
  onSend: (text: string, scope: ChatScope, to?: string) => void;
  /** Called when the input opens, so the game can release the mouse. */
  onOpen: () => void;
  /** Called after a message is sent, so the game can capture the mouse again. */
  onClose: () => void;
  /** Called whenever the input opens or closes, so the rest of the screen knows whether the chat is being read. */
  onOpenChange: (open: boolean) => void;
}
