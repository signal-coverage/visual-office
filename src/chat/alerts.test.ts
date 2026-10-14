import { describe, expect, it } from "vitest";
import type { ChatMessage } from "../../shared/chat.ts";
import {
  alertFor,
  desktopAlertText,
  documentTitle,
  shouldDesktopNotify,
  toastText,
} from "./alerts";

const message = (over: Partial<ChatMessage> = {}): ChatMessage => ({
  id: "ana",
  name: "Ana",
  text: "got a minute?",
  at: 1,
  color: 0,
  scope: "dm",
  to: "beto",
  toName: "Beto",
  ...over,
});

describe("alertFor", () => {
  it("is unread and loud for a direct message that arrives while the chat is not in view", () => {
    expect(
      alertFor({ message: message(), mine: false, viewing: false }),
    ).toEqual({ unread: true, notify: true });
  });

  it("is still unread but silent when the server asked for quiet (do not disturb)", () => {
    expect(
      alertFor({
        message: message({ quiet: true }),
        mine: false,
        viewing: false,
      }),
    ).toEqual({ unread: true, notify: false });
  });

  it("is nothing when the chat is open and the tab is in view", () => {
    expect(
      alertFor({ message: message(), mine: false, viewing: true }),
    ).toEqual({ unread: false, notify: false });
  });

  it("is nothing for our own messages", () => {
    expect(
      alertFor({ message: message(), mine: true, viewing: false }),
    ).toEqual({ unread: false, notify: false });
  });

  it("is nothing for messages to everybody or to the people nearby", () => {
    for (const scope of ["everyone", "nearby", undefined] as const)
      expect(
        alertFor({ message: message({ scope }), mine: false, viewing: false }),
      ).toEqual({ unread: false, notify: false });
  });
});

describe("documentTitle", () => {
  it("counts the unread messages only while the tab is hidden", () => {
    expect(documentTitle("Visual Office", 2, true)).toBe("(2) Visual Office");
    expect(documentTitle("Visual Office", 2, false)).toBe("Visual Office");
    expect(documentTitle("Visual Office", 0, true)).toBe("Visual Office");
  });
});

describe("shouldDesktopNotify", () => {
  const ok = {
    enabled: true,
    permission: "granted",
    hidden: true,
    notify: true,
  };
  it("needs the setting, the browser's permission, a hidden tab and a loud message", () => {
    expect(shouldDesktopNotify(ok)).toBe(true);
    expect(shouldDesktopNotify({ ...ok, enabled: false })).toBe(false);
    expect(shouldDesktopNotify({ ...ok, permission: "denied" })).toBe(false);
    expect(shouldDesktopNotify({ ...ok, permission: "default" })).toBe(false);
    expect(shouldDesktopNotify({ ...ok, permission: null })).toBe(false);
    expect(shouldDesktopNotify({ ...ok, hidden: false })).toBe(false);
    expect(shouldDesktopNotify({ ...ok, notify: false })).toBe(false);
  });
});

describe("texts", () => {
  it("names the sender and shortens a long message in the toast", () => {
    expect(toastText(message())).toBe("Ana (direct): got a minute?");
    const long = toastText(message({ text: "x".repeat(300) }));
    expect(long.length).toBeLessThan(120);
    expect(long.endsWith("…")).toBe(true);
  });

  it("puts the sender in the title of the desktop notification and the text in its body", () => {
    expect(desktopAlertText(message())).toEqual({
      title: "Ana",
      body: "got a minute?",
    });
  });
});
