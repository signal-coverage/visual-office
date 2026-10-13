import { describe, expect, it } from "vitest";
import {
  AUTH_REQUIRED_CODE,
  AUTH_UNAVAILABLE_CODE,
  messageForAuthCode,
  NOT_MEMBER_CODE,
  refusalFor,
} from "./auth.ts";

describe("refusalFor", () => {
  it("asks to sign in again for a missing or invalid token (an expired one included)", () => {
    expect(refusalFor("missing").code).toBe(AUTH_REQUIRED_CODE);
    expect(refusalFor("invalid").code).toBe(AUTH_REQUIRED_CODE);
  });

  it("says the person is not in the company", () => {
    expect(refusalFor("not_member").code).toBe(NOT_MEMBER_CODE);
  });

  it("says the sign-in service is unavailable, which is not the visitor's fault", () => {
    expect(refusalFor("unavailable").code).toBe(AUTH_UNAVAILABLE_CODE);
  });

  it("gives each its own words, which the client can show", () => {
    const messages = (["missing", "not_member", "unavailable"] as const).map(
      (reason) => refusalFor(reason).message,
    );
    expect(new Set(messages).size).toBe(3);
    for (const message of messages) expect(message.length).toBeGreaterThan(10);
  });
});

describe("messageForAuthCode", () => {
  it("finds the words for each code", () => {
    expect(messageForAuthCode(AUTH_REQUIRED_CODE)).toBe(
      refusalFor("missing").message,
    );
    expect(messageForAuthCode(NOT_MEMBER_CODE)).toBe(
      refusalFor("not_member").message,
    );
    expect(messageForAuthCode(AUTH_UNAVAILABLE_CODE)).toBe(
      refusalFor("unavailable").message,
    );
  });

  it("knows nothing about other codes", () => {
    expect(messageForAuthCode(4003)).toBeNull();
    expect(messageForAuthCode(0)).toBeNull();
  });
});
