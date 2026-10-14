import { describe, expect, it } from "vitest";
import {
  canEditFloor,
  identityOf,
  resolveActor,
  type Actor,
  type ResolveDeps,
} from "./actor.ts";

const person = (roles: { admin?: boolean; headOf?: string[] }): Actor => ({
  kind: "user",
  user: { id: "user_ana", email: null, name: "Ana", isAdmin: !!roles.admin },
  roles: { admin: roles.admin ?? false, headOf: roles.headOf ?? [] },
});

describe("canEditFloor", () => {
  it("lets the server's own tools do anything: they hold the secret", () => {
    expect(canEditFloor({ kind: "machine" }, "marketing")).toBe(true);
  });

  it("lets the head of a floor edit it", () => {
    expect(canEditFloor(person({ headOf: ["marketing"] }), "marketing")).toBe(
      true,
    );
  });

  it("does not let the head of one floor edit another", () => {
    expect(canEditFloor(person({ headOf: ["marketing"] }), "sales")).toBe(
      false,
    );
  });

  it("lets an admin edit any floor", () => {
    expect(canEditFloor(person({ admin: true }), "sales")).toBe(true);
  });

  it("does not let an ordinary member edit anything", () => {
    expect(canEditFloor(person({}), "marketing")).toBe(false);
  });
});

describe("identityOf", () => {
  it("is the verified user for a person, whatever they claim in the request", () => {
    expect(identityOf(person({}), { holder: "somebody-else" }, "holder")).toBe(
      "user_ana",
    );
    expect(identityOf(person({}), undefined, "author")).toBe("user_ana");
  });

  it("is what the request says for the server's own tools, when it is sensible", () => {
    expect(
      identityOf({ kind: "machine" }, { holder: "editor-1" }, "holder"),
    ).toBe("editor-1");
    expect(identityOf({ kind: "machine" }, { author: "me" }, "author")).toBe(
      "me",
    );
  });

  it("is nothing for the server's own tools when the request does not say who", () => {
    for (const body of [
      undefined,
      null,
      {},
      { holder: "" },
      { holder: 5 },
      [],
    ]) {
      expect(
        identityOf({ kind: "machine" }, body, "holder"),
        JSON.stringify(body),
      ).toBeNull();
    }
    expect(
      identityOf({ kind: "machine" }, { holder: "x".repeat(65) }, "holder"),
    ).toBeNull();
    expect(
      identityOf({ kind: "machine" }, { holder: "a\u0000b" }, "holder"),
    ).toBeNull();
  });
});

describe("resolveActor", () => {
  const ana = { id: "user_ana", email: null, name: "Ana", isAdmin: false };
  const deps = (
    result: Awaited<ReturnType<ResolveDeps["authenticate"]>> = {
      ok: true,
      user: ana,
    },
  ): ResolveDeps & { asked: string[] } => {
    const asked: string[] = [];
    return {
      asked,
      authenticate: async (token) => {
        asked.push(String(token));
        return result;
      },
      rolesOf: async () => ({ admin: false, headOf: ["marketing"] }),
    };
  };

  it("is the server's own tools when the shared secret was right, without asking anybody", async () => {
    const d = deps();
    expect(
      await resolveActor({ header: "Bearer whatever", machine: true }, d),
    ).toEqual({ kind: "machine" });
    expect(d.asked).toEqual([]);
  });

  it("is the person their token says, with the roles we hold for them", async () => {
    const d = deps();
    expect(
      await resolveActor({ header: "Bearer the-token", machine: false }, d),
    ).toEqual({
      kind: "user",
      user: ana,
      roles: { admin: false, headOf: ["marketing"] },
    });
    expect(d.asked).toEqual(["the-token"]);
  });

  it("is nobody when there is no token", async () => {
    for (const header of [undefined, "", "Bearer", "Bearer ", "Basic abc"]) {
      expect(
        await resolveActor({ header, machine: false }, deps()),
        String(header),
      ).toBeNull();
    }
  });

  it("is nobody when the token is refused", async () => {
    for (const reason of [
      "invalid",
      "missing",
      "not_member",
      "unavailable",
    ] as const) {
      expect(
        await resolveActor(
          { header: "Bearer t", machine: false },
          deps({ ok: false, reason }),
        ),
        reason,
      ).toBeNull();
    }
  });

  it("is nobody when sign-in is off, since there is nobody to vouch for a person", async () => {
    expect(
      await resolveActor({ header: "Bearer t", machine: false }, deps(null)),
    ).toBeNull();
  });
});
