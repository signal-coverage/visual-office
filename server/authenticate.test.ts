import { beforeEach, describe, expect, it } from "vitest";
import {
  authenticate,
  profileFromClerkUser,
  type AuthDeps,
} from "./authenticate.ts";
import { MemoryUserStore } from "./userStore.ts";

describe("authenticate", () => {
  let users: MemoryUserStore;
  let profileCalls: number;
  let member: boolean;
  let profileFails: boolean;
  let clock: number;
  let deps: AuthDeps;

  beforeEach(() => {
    users = new MemoryUserStore();
    profileCalls = 0;
    member = true;
    profileFails = false;
    clock = 1_000;
    deps = {
      verify: async (token) =>
        token === "good-ana"
          ? { userId: "user_ana" }
          : token === "good-beto"
            ? { userId: "user_beto" }
            : null,
      profile: async (userId) => {
        profileCalls++;
        if (profileFails) throw new Error("Clerk is down");
        return userId === "user_ana"
          ? { name: "Ana Pérez", email: "ana@acme.com" }
          : { name: "Beto", email: null };
      },
      isMember: async () => member,
      users,
      adminEmails: new Set(),
      now: () => clock,
    };
  });

  it("lets in somebody whose token is good, with the name and email of their profile", async () => {
    const result = await authenticate("good-ana", deps);
    expect(result).toEqual({
      ok: true,
      user: {
        id: "user_ana",
        name: "Ana Pérez",
        email: "ana@acme.com",
        isAdmin: false,
      },
    });
  });

  it("remembers them, so the building knows who has been here", async () => {
    await authenticate("good-ana", deps);
    expect((await users.get("user_ana"))?.name).toBe("Ana Pérez");
  });

  it.each([undefined, null, "", 42, {}])(
    "turns away somebody who brings no token (%s)",
    async (token) => {
      expect(await authenticate(token, deps)).toEqual({
        ok: false,
        reason: "missing",
      });
    },
  );

  it("turns away a token that is not valid", async () => {
    expect(await authenticate("forged", deps)).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(await users.get("user_ana")).toBeNull();
  });

  it("turns away somebody who is not in the company, even with a good token", async () => {
    member = false;
    expect(await authenticate("good-ana", deps)).toEqual({
      ok: false,
      reason: "not_member",
    });
    expect(await users.get("user_ana")).toBeNull();
  });

  it("says the service is unavailable, not that the token is bad, when it cannot check", async () => {
    deps.verify = async () => {
      throw new Error("network down");
    };
    expect(await authenticate("good-ana", deps)).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  describe("the profile", () => {
    it("is asked for once and then remembered for a while, not on every visit", async () => {
      await authenticate("good-ana", deps);
      clock += 60_000;
      await authenticate("good-ana", deps);
      expect(profileCalls).toBe(1);
    });

    it("is asked for again after a while, so a changed name shows up", async () => {
      await authenticate("good-ana", deps);
      clock += 60 * 60_000;
      await authenticate("good-ana", deps);
      expect(profileCalls).toBe(2);
    });

    it("lets in somebody already known when the service cannot give the profile now", async () => {
      await authenticate("good-ana", deps);
      clock += 60 * 60_000;
      profileFails = true;
      const result = await authenticate("good-ana", deps);
      expect(result).toMatchObject({
        ok: true,
        user: { id: "user_ana", name: "Ana Pérez" },
      });
    });

    it("cannot let in somebody new when the service cannot give the profile", async () => {
      profileFails = true;
      expect(await authenticate("good-ana", deps)).toEqual({
        ok: false,
        reason: "unavailable",
      });
    });
  });

  describe("the first admins", () => {
    it("makes admin whoever has an email on the list, whatever its case", async () => {
      deps.adminEmails = new Set(["ana@acme.com"]);
      const result = await authenticate("good-ana", deps);
      expect(result).toMatchObject({ ok: true, user: { isAdmin: true } });
      expect((await users.rolesOf("user_ana")).admin).toBe(true);
    });

    it("does not make admin somebody whose email is not on the list", async () => {
      deps.adminEmails = new Set(["ana@acme.com"]);
      const result = await authenticate("good-beto", deps);
      expect(result).toMatchObject({ ok: true, user: { isAdmin: false } });
    });

    it("does not take admin away from somebody who is no longer on the list", async () => {
      deps.adminEmails = new Set(["ana@acme.com"]);
      await authenticate("good-ana", deps);
      deps.adminEmails = new Set();
      clock += 60 * 60_000;
      const result = await authenticate("good-ana", deps);
      expect(result).toMatchObject({ ok: true, user: { isAdmin: true } });
    });
  });
});

describe("profileFromClerkUser", () => {
  const address = (emailAddress: string, status: string, id = "idn_1") => ({
    id,
    emailAddress,
    verification: { status },
  });

  it("uses the first and last name", () => {
    expect(
      profileFromClerkUser({
        firstName: "Ana",
        lastName: "Pérez",
        username: null,
        primaryEmailAddressId: "idn_1",
        emailAddresses: [address("ana@acme.com", "verified")],
      }),
    ).toEqual({ name: "Ana Pérez", email: "ana@acme.com" });
  });

  it("falls back to the username, then to what comes before the @ of the email", () => {
    expect(
      profileFromClerkUser({
        firstName: null,
        lastName: null,
        username: "anap",
        primaryEmailAddressId: null,
        emailAddresses: [],
      }).name,
    ).toBe("anap");
    expect(
      profileFromClerkUser({
        firstName: "",
        lastName: null,
        username: null,
        primaryEmailAddressId: "idn_1",
        emailAddresses: [address("ana.perez@acme.com", "verified")],
      }).name,
    ).toBe("ana.perez");
  });

  it("is never without a name", () => {
    expect(
      profileFromClerkUser({
        firstName: null,
        lastName: null,
        username: null,
        primaryEmailAddressId: null,
        emailAddresses: [],
      }).name,
    ).toBe("Guest");
  });

  it("only trusts an email that was verified: anybody can type another person's address", () => {
    expect(
      profileFromClerkUser({
        firstName: "Eve",
        lastName: null,
        username: null,
        primaryEmailAddressId: "idn_1",
        emailAddresses: [address("boss@acme.com", "unverified")],
      }).email,
    ).toBeNull();
  });

  it("takes the primary email, not just the first one", () => {
    expect(
      profileFromClerkUser({
        firstName: "Ana",
        lastName: null,
        username: null,
        primaryEmailAddressId: "idn_2",
        emailAddresses: [
          address("old@acme.com", "verified", "idn_1"),
          address("new@acme.com", "verified", "idn_2"),
        ],
      }).email,
    ).toBe("new@acme.com");
  });

  it("keeps the name to a sensible length and without control characters", () => {
    const { name } = profileFromClerkUser({
      firstName: "A\u0000na\n" + "x".repeat(200),
      lastName: null,
      username: null,
      primaryEmailAddressId: null,
      emailAddresses: [],
    });
    expect(name.length).toBeLessThanOrEqual(24);
    // eslint-disable-next-line no-control-regex
    expect(name).not.toMatch(/[\u0000-\u001f]/);
  });
});
