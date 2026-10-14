import { describe, expect, it } from "vitest";
import { wantsSignUp } from "./helpers";

describe("wantsSignUp", () => {
  it("is true when the link asks for it", () => {
    expect(wantsSignUp("?mode=sign-up")).toBe(true);
  });

  it("is true when the link carries an invitation, wherever it lands", () => {
    expect(wantsSignUp("?__clerk_ticket=abc123&__clerk_status=sign_up")).toBe(
      true,
    );
    expect(wantsSignUp("?name=Ana&__clerk_ticket=abc123")).toBe(true);
  });

  it("is false for an ordinary visit, with or without other settings in the link", () => {
    expect(wantsSignUp("")).toBe(false);
    expect(wantsSignUp("?name=Ana")).toBe(false);
    expect(wantsSignUp("?debug")).toBe(false);
  });

  it("is false for another mode, or an empty invitation", () => {
    expect(wantsSignUp("?mode=sign-in")).toBe(false);
    expect(wantsSignUp("?__clerk_ticket=")).toBe(false);
  });
});
