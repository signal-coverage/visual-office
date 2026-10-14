import { describe, expect, it } from "vitest";
import { inviteRequestsFrom } from "./invite.ts";

describe("inviteRequestsFrom", () => {
  it("invites the people it is told to, to sign up on the site", () => {
    expect(
      inviteRequestsFrom(
        { emails: ["ana@acme.com"], site: "https://office.acme.com" },
        {},
      ),
    ).toEqual({
      ok: true,
      invitations: [
        {
          emailAddress: "ana@acme.com",
          redirectUrl: "https://office.acme.com/?mode=sign-up",
        },
      ],
    });
  });

  it("invites the first admins from ADMIN_EMAILS when nobody is named", () => {
    const result = inviteRequestsFrom(
      { site: "https://office.acme.com" },
      { ADMIN_EMAILS: "Boss@Acme.com, cto@acme.com" },
    );
    expect(result).toMatchObject({
      ok: true,
      invitations: [
        { emailAddress: "boss@acme.com" },
        { emailAddress: "cto@acme.com" },
      ],
    });
  });

  it("takes the site from ALLOWED_ORIGINS when it is not given", () => {
    const result = inviteRequestsFrom(
      { emails: ["ana@acme.com"] },
      {
        ALLOWED_ORIGINS: "https://office.acme.com/, https://other.example.com",
      },
    );
    expect(result).toMatchObject({
      ok: true,
      invitations: [{ redirectUrl: "https://office.acme.com/?mode=sign-up" }],
    });
  });

  it("lowercases and does not repeat an email", () => {
    const result = inviteRequestsFrom(
      {
        emails: ["Ana@Acme.com", "ana@acme.com", " ana@acme.com "],
        site: "https://office.acme.com",
      },
      {},
    );
    expect(result).toMatchObject({ ok: true });
    expect(result.ok && result.invitations).toHaveLength(1);
  });

  it("accepts this machine as the site, for trying it out", () => {
    for (const site of ["http://localhost:5173", "http://127.0.0.1:5173"])
      expect(
        inviteRequestsFrom({ emails: ["ana@acme.com"], site }, {}),
        site,
      ).toMatchObject({ ok: true });
  });

  it("says when there is nobody to invite", () => {
    const result = inviteRequestsFrom({ site: "https://office.acme.com" }, {});
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/--email|ADMIN_EMAILS/),
    });
  });

  it("says when it does not know the site", () => {
    const result = inviteRequestsFrom({ emails: ["ana@acme.com"] }, {});
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/--site|ALLOWED_ORIGINS/),
    });
  });

  it("refuses an email that is not one, and says which", () => {
    const result = inviteRequestsFrom(
      {
        emails: ["ana@acme.com", "not-an-email"],
        site: "https://x.example.com",
      },
      {},
    );
    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining("not-an-email"),
    });
  });

  it("refuses a site that is not https (or this machine), or that has a path", () => {
    for (const site of [
      "http://office.acme.com",
      "office.acme.com",
      "https://office.acme.com/app",
      "ftp://office.acme.com",
    ])
      expect(
        inviteRequestsFrom({ emails: ["ana@acme.com"], site }, {}),
        site,
      ).toEqual({ ok: false, error: expect.stringContaining("site") });
  });
});
