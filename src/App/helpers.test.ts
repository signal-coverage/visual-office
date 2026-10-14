import { describe, expect, it } from "vitest";
import {
  AUTH_REQUIRED_CODE,
  AUTH_UNAVAILABLE_CODE,
  messageForAuthCode,
  NOT_MEMBER_CODE,
} from "../../shared/auth.ts";
import {
  FLOOR_CLOSED_CODE,
  FLOOR_CLOSED_MESSAGE,
} from "../../shared/floors.ts";
import {
  BANNED_CODE,
  BANNED_MESSAGE,
  KICKED_CODE,
  KICKED_MESSAGE,
} from "../../shared/moderation.ts";
import { CONNECTION_LOST_MESSAGE, UNREACHABLE_MESSAGE } from "./consts";
import {
  messageForDisconnect,
  messageForJoinError,
  showClickPrompt,
} from "./helpers";

describe("messageForDisconnect", () => {
  it("says the floor was closed for editing when that is why", () => {
    expect(messageForDisconnect(FLOOR_CLOSED_CODE)).toBe(FLOOR_CLOSED_MESSAGE);
  });

  it("says a moderator removed you, instead of a lost connection", () => {
    expect(messageForDisconnect(KICKED_CODE)).toBe(KICKED_MESSAGE);
    expect(messageForDisconnect(BANNED_CODE)).toBe(BANNED_MESSAGE);
  });

  it("says the connection was lost for any other reason", () => {
    for (const code of [1000, 1006, 4000, 4001, 0]) {
      expect(messageForDisconnect(code), String(code)).toBe(
        CONNECTION_LOST_MESSAGE,
      );
    }
  });
});

describe("messageForJoinError", () => {
  it("says the floor is closed when the server refused the entry for that reason", () => {
    const refused = Object.assign(new Error("closed"), {
      code: FLOOR_CLOSED_CODE,
    });
    expect(messageForJoinError(refused)).toBe(FLOOR_CLOSED_MESSAGE);
  });

  it("says why somebody was not let in: sign in, not invited, or the service is down", () => {
    for (const code of [
      AUTH_REQUIRED_CODE,
      NOT_MEMBER_CODE,
      AUTH_UNAVAILABLE_CODE,
    ]) {
      const refused = Object.assign(new Error("refused"), { code });
      expect(messageForJoinError(refused), String(code)).toBe(
        messageForAuthCode(code),
      );
    }
  });

  it("says a moderator's ban is why somebody was not let in", () => {
    const refused = Object.assign(new Error("banned"), { code: BANNED_CODE });
    expect(messageForJoinError(refused)).toBe(BANNED_MESSAGE);
  });

  it("says the server could not be reached for anything else", () => {
    for (const error of [
      new Error("network"),
      Object.assign(new Error("full"), { code: 4002 }),
      "boom",
      null,
      undefined,
      42,
    ]) {
      expect(messageForJoinError(error)).toBe(UNREACHABLE_MESSAGE);
    }
  });
});

describe("showClickPrompt", () => {
  const playing = {
    online: true,
    locked: false,
    menuOpen: false,
    chatOpen: false,
    calendarOpen: false,
  };

  it("asks for a click when the player is in the office and the mouse is free, with nothing else open", () => {
    expect(showClickPrompt(playing)).toBe(true);
  });

  it("does not, while the mouse is captured", () => {
    expect(showClickPrompt({ ...playing, locked: true })).toBe(false);
  });

  it("does not, while the menu, the chat or the calendar has the mouse on purpose", () => {
    expect(showClickPrompt({ ...playing, menuOpen: true })).toBe(false);
    expect(showClickPrompt({ ...playing, chatOpen: true })).toBe(false);
    expect(showClickPrompt({ ...playing, calendarOpen: true })).toBe(false);
  });

  it("does not, outside the office", () => {
    expect(showClickPrompt({ ...playing, online: false })).toBe(false);
  });
});
