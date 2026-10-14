import type { ChatScope } from "../../../shared/chat.ts";

export const MAX_VISIBLE_MESSAGES = 8;
export const OPEN_KEY = "Enter";
export const CANCEL_KEY = "Escape";
export const OPEN_LABEL = "Chat (Enter)";
export const SCOPE_LABEL = "Send to";
export const PEOPLE_LABEL = "Send the message to";
export const NOBODY = "Nobody else is here";
export const PICK_SOMEBODY = "Choose somebody";

export const PLACEHOLDERS: Readonly<Record<ChatScope, string>> = {
  everyone: "Message everyone and press Enter",
  nearby: "Message the people nearby and press Enter",
  dm: "Choose somebody, then type and press Enter",
};

/** What a message that was not for everybody is called next to its author. */
export const NEARBY_TAG = "nearby";
export const YOU = "you";
