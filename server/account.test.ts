import { beforeEach, describe, expect, it } from "vitest";
import {
  describeSession,
  handleAccount,
  setUpCompany,
  type AccountDeps,
} from "./account.ts";
import type { AuditInput } from "./auditStore.ts";
import { createCompany } from "./company.ts";
import { createCompanySettings } from "./companySettings.ts";
import { MemorySettingsStore } from "./settingsStore.ts";
import { MemoryUserStore } from "./userStore.ts";

describe("account", () => {
  let users: MemoryUserStore;
  let settings: MemorySettingsStore;
  /** Who is in which organization, in the sign-in service. */
  let members: Record<string, string[]>;
  let profiles: Record<string, { name: string; email: string | null }>;
  let deps: AccountDeps;

  const build = (): AccountDeps => ({
    verify: async (token) =>
      token.startsWith("tok-") ? { userId: token.slice(4) } : null,
    profile: async (userId) => {
      const profile = profiles[userId];
      if (!profile) throw new Error("unknown to the service");
      return profile;
    },
    isInOrganization: async (userId, organizationId) =>
      (members[organizationId] ?? []).includes(userId),
    isMember: async (userId) => {
      const org = await company.get();
      return org !== null && (members[org] ?? []).includes(userId);
    },
    company,
    settings: createCompanySettings(settings),
    users,
    adminEmails: new Set(["boss@acme.com"]),
    now: () => 1_000,
  });
  let company: ReturnType<typeof createCompany>;

  beforeEach(() => {
    users = new MemoryUserStore();
    settings = new MemorySettingsStore();
    members = { org_acme: ["ana", "boss"] };
    profiles = {
      boss: { name: "The Boss", email: "boss@acme.com" },
      ana: { name: "Ana", email: "ana@acme.com" },
      eve: { name: "Eve", email: "eve@elsewhere.com" },
    };
    company = createCompany({ fromEnv: "org_acme", settings });
    deps = build();
  });

  describe("describeSession", () => {
    it("says who somebody is when they are in the company, and which organization it is", async () => {
      expect(await describeSession("tok-ana", deps)).toEqual({
        ok: true,
        state: "member",
        organizationId: "org_acme",
        appearance: null,
        canEditName: false,
        user: {
          id: "ana",
          name: "Ana",
          email: "ana@acme.com",
          isAdmin: false,
        },
      });
    });

    it("says whether the company lets people choose their name", async () => {
      await createCompanySettings(settings).setAllowNameEdit(true);
      expect(await describeSession("tok-ana", deps)).toMatchObject({
        state: "member",
        canEditName: true,
      });
    });

    it("keeps the name locked when the setting cannot be read", async () => {
      deps.settings = {
        allowNameEdit: async () => {
          throw new Error("down");
        },
        setAllowNameEdit: async () => {},
      };
      expect(await describeSession("tok-ana", deps)).toMatchObject({
        state: "member",
        canEditName: false,
      });
    });

    it("brings the look the person chose last, so the menu starts with it on any browser", async () => {
      await users.upsert({ id: "ana", email: "ana@acme.com", name: "Ana" });
      const look = { skin: 1, hairColor: 2, hairStyle: 0, shirt: 3, pants: 4 };
      await users.setAppearance("ana", look);
      expect(await describeSession("tok-ana", deps)).toMatchObject({
        state: "member",
        appearance: look,
      });
    });

    it("makes the first admins admin when they come in", async () => {
      const result = await describeSession("tok-boss", deps);
      expect(result).toMatchObject({
        state: "member",
        user: { isAdmin: true },
      });
    });

    it("says somebody who is not in the company has to be invited, and keeps no trace of them", async () => {
      expect(await describeSession("tok-eve", deps)).toEqual({
        ok: true,
        state: "not_member",
      });
      expect(await users.get("eve")).toBeNull();
    });

    it("refuses a token that is not valid, and one that is missing", async () => {
      expect(await describeSession("forged", deps)).toEqual({
        ok: false,
        reason: "invalid",
      });
      expect(await describeSession("", deps)).toEqual({
        ok: false,
        reason: "missing",
      });
      expect(await describeSession(undefined, deps)).toEqual({
        ok: false,
        reason: "missing",
      });
    });

    it("says the service is unavailable, not that the token is bad, when it cannot check", async () => {
      deps.verify = async () => {
        throw new Error("down");
      };
      expect(await describeSession("tok-ana", deps)).toEqual({
        ok: false,
        reason: "unavailable",
      });
    });

    describe("before the company is set up", () => {
      beforeEach(() => {
        company = createCompany({ settings });
        deps = build();
      });

      it("lets the first admins set it up, and remembers them", async () => {
        expect(await describeSession("tok-boss", deps)).toEqual({
          ok: true,
          state: "company_missing",
          canSetUp: true,
        });
        expect((await users.get("boss"))?.isAdmin).toBe(true);
      });

      it("tells everybody else to wait for their admin, and keeps no trace of them", async () => {
        expect(await describeSession("tok-ana", deps)).toEqual({
          ok: true,
          state: "company_missing",
          canSetUp: false,
        });
        expect(await users.get("ana")).toBeNull();
      });

      it("does not trust an email that was not verified, which is how anybody could claim to be the admin", async () => {
        profiles.eve = { name: "Eve", email: null };
        const result = await describeSession("tok-eve", deps);
        expect(result).toMatchObject({ canSetUp: false });
      });
    });
  });

  describe("setUpCompany", () => {
    beforeEach(() => {
      company = createCompany({ settings });
      deps = build();
      members.org_new = ["boss"];
    });

    it("makes the organization the company, for an admin who is in it", async () => {
      expect(await setUpCompany("tok-boss", "org_new", deps)).toEqual({
        ok: true,
        organizationId: "org_new",
      });
      expect(await company.get()).toBe("org_new");
      expect(await describeSession("tok-boss", deps)).toMatchObject({
        state: "member",
        organizationId: "org_new",
      });
    });

    it("records who set the company up", async () => {
      const recorded: AuditInput[] = [];
      deps.audit = async (entry) => {
        recorded.push(entry);
      };
      await setUpCompany("tok-boss", "org_new", deps);
      expect(recorded).toEqual([
        {
          actorUserId: "boss",
          actorName: "The Boss",
          action: "company.setup",
          detail: { organizationId: "org_new" },
        },
      ]);
    });

    it("records nothing when it was refused", async () => {
      const recorded: AuditInput[] = [];
      deps.audit = async (entry) => {
        recorded.push(entry);
      };
      members.org_new = ["ana"];
      await setUpCompany("tok-ana", "org_new", deps);
      await setUpCompany("tok-boss", "org_other", deps);
      expect(recorded).toEqual([]);
    });

    it("refuses somebody who is not an admin, and sets nothing", async () => {
      members.org_new = ["ana"];
      expect(await setUpCompany("tok-ana", "org_new", deps)).toEqual({
        ok: false,
        reason: "forbidden",
      });
      expect(await company.get()).toBeNull();
    });

    it("refuses an organization the admin is not part of (or that does not exist)", async () => {
      expect(await setUpCompany("tok-boss", "org_other", deps)).toEqual({
        ok: false,
        reason: "not_in_organization",
      });
      expect(await company.get()).toBeNull();
    });

    it("refuses something that is not an organization id", async () => {
      for (const id of [
        "",
        "acme",
        "org_",
        "org_ with spaces",
        "x".repeat(200),
      ])
        expect(await setUpCompany("tok-boss", id, deps), id).toEqual({
          ok: false,
          reason: "invalid_organization",
        });
    });

    it("cannot be done twice: the company is not changed from the game", async () => {
      await setUpCompany("tok-boss", "org_new", deps);
      members.org_second = ["boss"];
      expect(await setUpCompany("tok-boss", "org_second", deps)).toEqual({
        ok: false,
        reason: "already_set_up",
      });
      expect(await company.get()).toBe("org_new");
    });

    it("cannot be done when the environment already decides", async () => {
      company = createCompany({ fromEnv: "org_acme", settings });
      deps = build();
      expect(await setUpCompany("tok-boss", "org_new", deps)).toEqual({
        ok: false,
        reason: "already_set_up",
      });
    });

    it("refuses a token that is not valid", async () => {
      expect(await setUpCompany("forged", "org_new", deps)).toEqual({
        ok: false,
        reason: "invalid",
      });
    });
  });

  describe("handleAccount", () => {
    const call = (
      method: string,
      path: string,
      token?: string,
      body?: unknown,
    ) => handleAccount({ method, path, token, body }, deps);

    it("answers nothing for a path that is not its own", async () => {
      expect(await call("GET", "/health")).toBeNull();
      expect(await call("GET", "/admin/floors/office")).toBeNull();
    });

    it("gives the state of the session", async () => {
      const reply = await call("GET", "/account/session", "tok-ana");
      expect(reply?.status).toBe(200);
      expect(reply?.body).toEqual({
        state: "member",
        organizationId: "org_acme",
        appearance: null,
        canEditName: false,
        user: { id: "ana", name: "Ana", email: "ana@acme.com", isAdmin: false },
      });
    });

    it("says what a person who is not in the company has to do, without an error", async () => {
      const reply = await call("GET", "/account/session", "tok-eve");
      expect(reply).toEqual({ status: 200, body: { state: "not_member" } });
    });

    it("answers 401 to a token that is not valid or missing, and 503 when the service is down", async () => {
      expect((await call("GET", "/account/session", "forged"))?.status).toBe(
        401,
      );
      expect((await call("GET", "/account/session"))?.status).toBe(401);
      deps.verify = async () => {
        throw new Error("down");
      };
      expect((await call("GET", "/account/session", "tok-ana"))?.status).toBe(
        503,
      );
    });

    it("sets up the company", async () => {
      company = createCompany({ settings });
      deps = build();
      members.org_new = ["boss"];
      const reply = await call("POST", "/account/company", "tok-boss", {
        organizationId: "org_new",
      });
      expect(reply).toEqual({
        status: 200,
        body: { organizationId: "org_new" },
      });
    });

    it("answers with the right status when it cannot be done", async () => {
      company = createCompany({ settings });
      deps = build();
      members.org_new = ["boss"];
      const post = (token: string, organizationId: unknown) =>
        call("POST", "/account/company", token, { organizationId });
      expect((await post("tok-ana", "org_new"))?.status).toBe(403);
      expect((await post("tok-boss", "nope"))?.status).toBe(400);
      expect((await post("tok-boss", "org_other"))?.status).toBe(403);
      expect((await post("forged", "org_new"))?.status).toBe(401);
      await post("tok-boss", "org_new");
      expect((await post("tok-boss", "org_new"))?.status).toBe(409);
    });

    it("needs a body with the organization", async () => {
      for (const body of [undefined, null, [], {}, { organizationId: 5 }])
        expect(
          (await call("POST", "/account/company", "tok-boss", body))?.status,
          JSON.stringify(body),
        ).toBe(400);
    });

    it("only answers the methods it knows", async () => {
      expect((await call("POST", "/account/session", "tok-ana"))?.status).toBe(
        405,
      );
      expect((await call("GET", "/account/company", "tok-boss"))?.status).toBe(
        405,
      );
    });

    it("says so when the database cannot be reached", async () => {
      users.upsert = async () => {
        throw new Error("connection refused");
      };
      expect((await call("GET", "/account/session", "tok-ana"))?.status).toBe(
        503,
      );
    });
  });
});
