import { describe, expect, it } from "vitest";
import { checkCompany } from "./companyCheck.ts";

const server: Record<string, string | undefined> = {
  DATABASE_URL:
    "postgresql://user:pw@ep-x-pooler.neon.tech/neondb?sslmode=verify-full",
  LIVEKIT_URL: "wss://acme.livekit.cloud",
  LIVEKIT_API_KEY: "key",
  LIVEKIT_API_SECRET: "secret",
  CLERK_SECRET_KEY: "sk_live_abc",
  VITE_CLERK_PUBLISHABLE_KEY: "pk_live_abc",
  CLERK_ORGANIZATION_ID: "org_123",
  ADMIN_EMAILS: "boss@acme.com",
  ALLOWED_ORIGINS: "https://office.acme.com",
  VOICE_ROOM_PREFIX: "acme",
};
const site: Record<string, string | undefined> = {
  VITE_SERVER_URL: "wss://office-acme.up.railway.app",
  VITE_CLERK_PUBLISHABLE_KEY: "pk_live_abc",
};

const problems = (s = server, v = site) =>
  checkCompany(s, v).map((f) => `${f.level}: ${f.message}`);
const without = <T extends object>(env: T, key: keyof T) => {
  const copy = { ...env };
  delete copy[key];
  return copy;
};

describe("checkCompany", () => {
  it("finds nothing wrong with a complete, consistent company", () => {
    expect(checkCompany(server, site)).toEqual([]);
  });

  it("never prints a key, a secret or a connection string", () => {
    const all = problems(
      {
        ...server,
        DATABASE_URL: "mysql://user:SECRETPW@host/db",
        CLERK_SECRET_KEY: "pk_live_SECRETKEY",
        LIVEKIT_API_SECRET: "",
      },
      { ...site, VITE_CLERK_PUBLISHABLE_KEY: "sk_live_SECRETKEY" },
    ).join("\n");
    expect(all).not.toContain("SECRETPW");
    expect(all).not.toContain("SECRETKEY");
  });

  it("puts what stops the company from working before what is only advice", () => {
    const found = checkCompany(
      { ...without(server, "DATABASE_URL"), VOICE_ROOM_PREFIX: "" },
      site,
    );
    const levels = found.map((f) => f.level);
    expect(levels).toContain("error");
    expect(levels).toContain("warning");
    expect(levels.indexOf("warning")).toBeGreaterThan(
      levels.lastIndexOf("error"),
    );
  });

  describe("the database", () => {
    it("is an error when there is none: roles and layouts would be lost at every restart", () => {
      expect(problems(without(server, "DATABASE_URL"))).toEqual([
        expect.stringMatching(/^error: DATABASE_URL.*restart/i),
      ]);
    });

    it("is an error when it is not a Postgres address", () => {
      expect(
        problems({ ...server, DATABASE_URL: "mysql://u:p@host/db" })[0],
      ).toMatch(/^error: DATABASE_URL/);
    });
  });

  describe("sign-in", () => {
    it("is an error when the keys are missing or do not look right", () => {
      expect(problems(without(server, "CLERK_SECRET_KEY"))[0]).toMatch(
        /^error: .*CLERK_SECRET_KEY/,
      );
      expect(
        problems({ ...server, CLERK_SECRET_KEY: "pk_live_abc" })[0],
      ).toMatch(/^error: /);
    });

    it("only reminds that the first admin sets the company up from the game, when the organization is not given", () => {
      expect(problems(without(server, "CLERK_ORGANIZATION_ID"))).toEqual([
        expect.stringMatching(
          /^warning: CLERK_ORGANIZATION_ID.*first admin.*game/i,
        ),
      ]);
    });

    it("is an error when there is neither an organization nor an admin: nobody could set the company up", () => {
      const found = problems({
        ...without(without(server, "CLERK_ORGANIZATION_ID"), "ADMIN_EMAILS"),
      });
      expect(found).toEqual([
        expect.stringMatching(/^error: .*CLERK_ORGANIZATION_ID.*ADMIN_EMAILS/i),
      ]);
    });

    it("is an error when the organization id is not one", () => {
      expect(problems({ ...server, CLERK_ORGANIZATION_ID: "acme" })[0]).toMatch(
        /^error: CLERK_ORGANIZATION_ID.*org_/,
      );
    });

    it("advises production keys instead of test ones for a real company", () => {
      expect(
        problems(
          {
            ...server,
            CLERK_SECRET_KEY: "sk_test_abc",
            VITE_CLERK_PUBLISHABLE_KEY: "pk_test_abc",
          },
          { ...site, VITE_CLERK_PUBLISHABLE_KEY: "pk_test_abc" },
        ),
      ).toEqual([expect.stringMatching(/^warning: .*test keys/i)]);
    });

    it("warns that nobody will be admin when no email is given", () => {
      expect(problems({ ...server, ADMIN_EMAILS: "" })).toEqual([
        expect.stringMatching(/^warning: ADMIN_EMAILS.*admin/i),
      ]);
    });
  });

  describe("the site and the server agree", () => {
    it("is an error when the site has no server address or no key", () => {
      expect(problems(server, without(site, "VITE_SERVER_URL"))[0]).toMatch(
        /^error: VITE_SERVER_URL/,
      );
      expect(
        problems(server, without(site, "VITE_CLERK_PUBLISHABLE_KEY"))[0],
      ).toMatch(/^error: .*VITE_CLERK_PUBLISHABLE_KEY/);
    });

    it("is an error when the server address is not a websocket one", () => {
      expect(
        problems(server, {
          ...site,
          VITE_SERVER_URL: "https://x.up.railway.app",
        })[0],
      ).toMatch(/^error: VITE_SERVER_URL.*wss/);
    });

    it("is an error when the site would use an unencrypted websocket: a secure page cannot open it", () => {
      expect(
        problems(server, {
          ...site,
          VITE_SERVER_URL: "ws://x.up.railway.app",
        })[0],
      ).toMatch(/^error: VITE_SERVER_URL.*wss/);
    });

    it("is an error when the site and the server use different Clerk keys", () => {
      expect(
        problems(server, {
          ...site,
          VITE_CLERK_PUBLISHABLE_KEY: "pk_live_other",
        })[0],
      ).toMatch(/^error: .*different/i);
    });
  });

  describe("the sites allowed to call the server", () => {
    it("warns that the editor will not work without any", () => {
      expect(problems({ ...server, ALLOWED_ORIGINS: "" })).toEqual([
        expect.stringMatching(/^warning: ALLOWED_ORIGINS.*editor/i),
      ]);
    });

    it("is an error for one that is not an origin: a path, or no https", () => {
      for (const origin of [
        "https://office.acme.com/app",
        "office.acme.com",
        "ftp://office.acme.com",
      ])
        expect(
          problems({ ...server, ALLOWED_ORIGINS: origin })[0],
          origin,
        ).toMatch(/^error: ALLOWED_ORIGINS/);
    });

    it("accepts several, and a trailing slash", () => {
      expect(
        problems({
          ...server,
          ALLOWED_ORIGINS: "https://office.acme.com/, https://acme.example.org",
        }),
      ).toEqual([]);
    });
  });

  describe("voice", () => {
    it("warns when it is off, saying what is missing", () => {
      expect(problems(without(server, "LIVEKIT_API_SECRET"))).toEqual([
        expect.stringMatching(/^warning: .*LIVEKIT_API_SECRET/),
      ]);
    });

    it("reminds that rooms need a prefix when the LiveKit project is shared with another company", () => {
      expect(problems(without(server, "VOICE_ROOM_PREFIX"))).toEqual([
        expect.stringMatching(/^warning: VOICE_ROOM_PREFIX.*another company/i),
      ]);
    });
  });

  it("notes the shared admin token, which gives full machine access", () => {
    expect(problems({ ...server, FLOOR_ADMIN_TOKEN: "x" })).toEqual([
      expect.stringMatching(/^warning: FLOOR_ADMIN_TOKEN/),
    ]);
  });
});
