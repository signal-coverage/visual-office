import { describe, expect, it } from "vitest";
import {
  AUTH_REQUIRED_CODE,
  AUTH_UNAVAILABLE_CODE,
  messageForAuthCode,
  NOT_MEMBER_CODE,
} from "../../shared/auth.ts";
import {
  FLOOR_ACCESS_LOST_CODE,
  FLOOR_ACCESS_LOST_MESSAGE,
  FLOOR_ARCHIVED_CODE,
  FLOOR_ARCHIVED_MESSAGE,
  FLOOR_CLOSED_CODE,
  FLOOR_CLOSED_MESSAGE,
  FLOOR_FORBIDDEN_CODE,
  FLOOR_FORBIDDEN_MESSAGE,
  FLOOR_UNAVAILABLE_MESSAGE,
  FLOOR_UNKNOWN_MESSAGE,
} from "../../shared/floors.ts";
import {
  BANNED_CODE,
  BANNED_MESSAGE,
  KICKED_CODE,
  KICKED_MESSAGE,
} from "../../shared/moderation.ts";
import {
  SERVER_RESTARTING_CODE,
  SERVER_RESTARTING_MESSAGE,
} from "../../shared/restart.ts";
import { CONNECTION_LOST_MESSAGE, UNREACHABLE_MESSAGE } from "./consts";
import {
  messageForDisconnect,
  messageForJoinError,
  showClickPrompt,
  touchSceneCovered,
} from "./helpers";

describe("messageForDisconnect", () => {
  it("says the floor was closed for editing when that is why", () => {
    expect(messageForDisconnect(FLOOR_CLOSED_CODE)).toBe(FLOOR_CLOSED_MESSAGE);
  });

  it("says the server is restarting, when it was", () => {
    expect(messageForDisconnect(SERVER_RESTARTING_CODE)).toBe(
      SERVER_RESTARTING_MESSAGE,
    );
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
    mapOpen: false,
    panelOpen: false,
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

  it("does not, while the map of rooms has the mouse on purpose", () => {
    expect(showClickPrompt({ ...playing, mapOpen: true })).toBe(false);
  });

  it("does not, while a computer or a shelf has the mouse on purpose", () => {
    expect(showClickPrompt({ ...playing, panelOpen: true })).toBe(false);
  });

  it("does not, outside the office", () => {
    expect(showClickPrompt({ ...playing, online: false })).toBe(false);
  });

  it("never on a touch screen: there is no mouse to take, so there is nothing to click", () => {
    expect(showClickPrompt({ ...playing, touch: true })).toBe(false);
    expect(showClickPrompt({ ...playing, touch: false })).toBe(true);
  });
});

describe("touchSceneCovered", () => {
  const clear = {
    menuOpen: false,
    chatOpen: false,
    calendarOpen: false,
    mapOpen: false,
    panelOpen: false,
  };

  it("leaves the fingers on the scene when nothing covers it", () => {
    expect(touchSceneCovered(clear)).toBe(false);
  });

  it("takes them off it while the menu, the chat, the calendar, the map or a computer is open", () => {
    expect(touchSceneCovered({ ...clear, menuOpen: true })).toBe(true);
    expect(touchSceneCovered({ ...clear, chatOpen: true })).toBe(true);
    expect(touchSceneCovered({ ...clear, calendarOpen: true })).toBe(true);
    expect(touchSceneCovered({ ...clear, mapOpen: true })).toBe(true);
    expect(touchSceneCovered({ ...clear, panelOpen: true })).toBe(true);
  });
});

describe("the rooms", () => {
  it("says why somebody was sent out of a room they may not be in", () => {
    expect(messageForDisconnect(FLOOR_FORBIDDEN_CODE)).toBe(
      FLOOR_FORBIDDEN_MESSAGE,
    );
    expect(messageForDisconnect(FLOOR_ACCESS_LOST_CODE)).toBe(
      FLOOR_ACCESS_LOST_MESSAGE,
    );
  });

  it("says why joining a room failed: not allowed, no such room, or it could not be checked", () => {
    const refused = (code: number, message = "x") =>
      Object.assign(new Error(message), { code });
    expect(messageForJoinError(refused(FLOOR_FORBIDDEN_CODE))).toBe(
      FLOOR_FORBIDDEN_MESSAGE,
    );
    expect(messageForJoinError(refused(404, FLOOR_UNKNOWN_MESSAGE))).toBe(
      FLOOR_UNKNOWN_MESSAGE,
    );
    expect(messageForJoinError(refused(503, FLOOR_UNAVAILABLE_MESSAGE))).toBe(
      FLOOR_UNAVAILABLE_MESSAGE,
    );
  });

  it("says a room is archived, whether it was refused at the door (410) or the player was inside", () => {
    expect(messageForDisconnect(FLOOR_ARCHIVED_CODE)).toBe(
      FLOOR_ARCHIVED_MESSAGE,
    );
    const refused = (code: number, message: string) =>
      Object.assign(new Error(message), { code });
    expect(messageForJoinError(refused(410, FLOOR_ARCHIVED_MESSAGE))).toBe(
      FLOOR_ARCHIVED_MESSAGE,
    );
    expect(messageForJoinError(refused(FLOOR_ARCHIVED_CODE, "closed"))).toBe(
      FLOOR_ARCHIVED_MESSAGE,
    );
  });

  it("does not take every 410 for an archived room", () => {
    const refused = Object.assign(new Error("Gone"), { code: 410 });
    expect(messageForJoinError(refused)).toBe(UNREACHABLE_MESSAGE);
  });

  it("does not take every 404 or 503 for a room that is not there", () => {
    const refused = (code: number) =>
      Object.assign(new Error("Bad Gateway"), { code });
    expect(messageForJoinError(refused(404))).toBe(UNREACHABLE_MESSAGE);
    expect(messageForJoinError(refused(503))).toBe(UNREACHABLE_MESSAGE);
  });
});
