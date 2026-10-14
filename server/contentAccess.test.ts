import { describe, expect, it } from "vitest";
import type { Actor } from "./actor.ts";
import { mayEditContent } from "./contentAccess.ts";

const person = (roles: { admin?: boolean; headOf?: string[] }): Actor => ({
  kind: "user",
  user: { id: "user_x", email: null, name: "X", isAdmin: !!roles.admin },
  roles: { admin: roles.admin ?? false, headOf: roles.headOf ?? [] },
});

describe("mayEditContent", () => {
  it("lets an admin edit the content of any floor", () => {
    expect(mayEditContent(person({ admin: true }), "office")).toBe(true);
    expect(mayEditContent(person({ admin: true }), "hr")).toBe(true);
  });

  it("lets the head of a floor edit that floor's content, and no other", () => {
    const head = person({ headOf: ["hr"] });
    expect(mayEditContent(head, "hr")).toBe(true);
    expect(mayEditContent(head, "office")).toBe(false);
    expect(mayEditContent(head, "lab")).toBe(false);
  });

  it("does not let anybody else", () => {
    expect(mayEditContent(person({}), "office")).toBe(false);
    expect(mayEditContent(person({}), "hr")).toBe(false);
  });

  it("lets the server's own tools", () => {
    expect(mayEditContent({ kind: "machine" }, "hr")).toBe(true);
  });
});
