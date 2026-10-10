import type { ChatMessage } from "../../../shared/chat.ts";

export interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  /** Called when the input opens, so the game can release the mouse. */
  onOpen: () => void;
  /** Called after a message is sent, so the game can capture the mouse again. */
  onClose: () => void;
}
