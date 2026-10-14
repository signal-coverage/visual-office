import { describe, expect, it } from "vitest";
import type { Roles } from "./userStore.ts";
import { canModerate, mayModerate } from "./moderation.ts";

const roles = (admin: boolean, headOf: string[] = []): Roles => ({
  admin,
  headOf,
});
const member = roles(false);
const head = roles(false, ["office"]);
const headElsewhere = roles(false, ["sales"]);
const admin = roles(true);

const actorOf = (id: string, r: Roles) => ({ id, roles: r });
const targetOf = (id: string, r: Roles) => ({ id, roles: r });

describe("canModerate", () => {
  it("is for admins, and for the head of that floor", () => {
    expect(canModerate(admin, "office")).toBe(true);
    expect(canModerate(head, "office")).toBe(true);
  });

  it("is not for members, nor for the head of another floor", () => {
    expect(canModerate(member, "office")).toBe(false);
    expect(canModerate(headElsewhere, "office")).toBe(false);
  });
});

describe("mayModerate", () => {
  it("lets an admin act on a member and on a head", () => {
    expect(
      mayModerate(actorOf("a", admin), targetOf("m", member), "office"),
    ).toEqual({ ok: true });
    expect(
      mayModerate(actorOf("a", admin), targetOf("h", head), "office"),
    ).toEqual({ ok: true });
  });

  it("lets the head of the floor act on a member of it", () => {
    expect(
      mayModerate(actorOf("h", head), targetOf("m", member), "office"),
    ).toEqual({ ok: true });
  });

  it("refuses members, and heads of other floors", () => {
    for (const who of [member, headElsewhere]) {
      expect(
        mayModerate(actorOf("x", who), targetOf("m", member), "office"),
      ).toEqual({ ok: false, reason: "not_allowed" });
    }
  });

  it("refuses to act on yourself, even for an admin", () => {
    expect(
      mayModerate(actorOf("a", admin), targetOf("a", admin), "office"),
    ).toEqual({ ok: false, reason: "self" });
    expect(
      mayModerate(actorOf("h", head), targetOf("h", head), "office"),
    ).toEqual({ ok: false, reason: "self" });
  });

  it("refuses to act on an admin, whoever asks", () => {
    expect(
      mayModerate(actorOf("h", head), targetOf("a", admin), "office"),
    ).toEqual({ ok: false, reason: "admin" });
    expect(
      mayModerate(actorOf("b", admin), targetOf("a", admin), "office"),
    ).toEqual({ ok: false, reason: "admin" });
  });

  it("says not allowed before anything about the target", () => {
    expect(
      mayModerate(actorOf("m", member), targetOf("a", admin), "office"),
    ).toEqual({ ok: false, reason: "not_allowed" });
  });

  it("lets the server's own tools act, which have no identity", () => {
    expect(
      mayModerate({ id: null, roles: admin }, targetOf("m", member), "office"),
    ).toEqual({ ok: true });
  });
});
