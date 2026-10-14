import { describe, expect, it } from "vitest";
import { fetchSession, registerCompany } from "./account";

const base = "https://office.example.com";

function api(answer: { status?: number; body?: unknown } | Error) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const request = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (answer instanceof Error) throw answer;
    return new Response(JSON.stringify(answer.body ?? {}), {
      status: answer.status ?? 200,
    });
  };
  return { calls, request };
}

describe("fetchSession", () => {
  it("says somebody is in the company, with who they are and which organization it is", async () => {
    const { request, calls } = api({
      body: {
        state: "member",
        organizationId: "org_acme",
        appearance: null,
        user: { id: "u1", name: "Ana", email: "ana@acme.com", isAdmin: true },
      },
    });
    expect(await fetchSession(request, base)).toEqual({
      state: "member",
      organizationId: "org_acme",
      appearance: null,
      canEditName: false,
      user: { id: "u1", name: "Ana", email: "ana@acme.com", isAdmin: true },
    });
    expect(calls[0].url).toBe(`${base}/account/session`);
  });

  it("says whether the company lets people choose their name, and not when it does not say or says it oddly", async () => {
    const session = (canEditName: unknown) =>
      fetchSession(
        api({
          body: {
            state: "member",
            organizationId: "org_acme",
            appearance: null,
            ...(canEditName === undefined ? {} : { canEditName }),
            user: { id: "u1", name: "Ana", email: null, isAdmin: false },
          },
        }).request,
        base,
      );
    expect(await session(true)).toMatchObject({ canEditName: true });
    expect(await session(false)).toMatchObject({ canEditName: false });
    for (const odd of [undefined, "true", 1, null, {}])
      expect(await session(odd)).toMatchObject({ canEditName: false });
  });

  it("brings the look the person chose last", async () => {
    const look = { skin: 1, hairColor: 2, hairStyle: 0, shirt: 3, pants: 4 };
    const session = await fetchSession(
      api({
        body: {
          state: "member",
          organizationId: "org_acme",
          appearance: look,
          user: { id: "u1", name: "Ana", email: null, isAdmin: false },
        },
      }).request,
      base,
    );
    expect(session).toMatchObject({ state: "member", appearance: look });
  });

  it("reads a look kept before the extra options as a look with them plain", async () => {
    const old = { skin: 1, hairColor: 2, hairStyle: 0, shirt: 3, pants: 4 };
    const session = await fetchSession(
      api({
        body: {
          state: "member",
          organizationId: "org_acme",
          appearance: old,
          user: { id: "u1", name: "Ana", email: null, isAdmin: false },
        },
      }).request,
      base,
    );
    expect(session).toMatchObject({
      state: "member",
      appearance: {
        ...old,
        facialHair: 0,
        glasses: 0,
        headwear: 0,
        top: 0,
        shoes: 0,
        accessory: 0,
      },
    });
  });

  it("takes a look that is not valid as no look, instead of failing: the person just chooses again", async () => {
    const session = await fetchSession(
      api({
        body: {
          state: "member",
          organizationId: "org_acme",
          appearance: { skin: 999 },
          user: { id: "u1", name: "Ana", email: null, isAdmin: false },
        },
      }).request,
      base,
    );
    expect(session).toMatchObject({ state: "member", appearance: null });
  });

  it("says somebody needs an invitation", async () => {
    expect(
      await fetchSession(api({ body: { state: "not_member" } }).request, base),
    ).toEqual({ state: "not_member" });
  });

  it("says the company is not set up, and whether this person can do it", async () => {
    for (const canSetUp of [true, false])
      expect(
        await fetchSession(
          api({ body: { state: "company_missing", canSetUp } }).request,
          base,
        ),
      ).toEqual({ state: "company_missing", canSetUp });
  });

  it("says to sign in again when the server does not know the token", async () => {
    expect(await fetchSession(api({ status: 401 }).request, base)).toEqual({
      state: "error",
      signedOut: true,
    });
  });

  it("says it could not find out, so the screen can offer to try again", async () => {
    for (const answer of [
      { status: 503 },
      { status: 500 },
      new Error("network down"),
    ])
      expect(await fetchSession(api(answer).request, base)).toEqual({
        state: "error",
        signedOut: false,
      });
  });

  it("does not take an answer that is not what was asked for", async () => {
    for (const body of [
      {},
      null,
      { state: "something-else" },
      { state: "member" },
      { state: "member", organizationId: "org_x" },
      { state: "company_missing" },
      { state: "company_missing", canSetUp: "yes" },
    ])
      expect(
        await fetchSession(api({ body }).request, base),
        JSON.stringify(body),
      ).toEqual({ state: "error", signedOut: false });
  });
});

describe("registerCompany", () => {
  it("asks the server to make the organization the company", async () => {
    const { request, calls } = api({ body: { organizationId: "org_new" } });
    expect(await registerCompany(request, base, "org_new")).toBe(true);
    expect(calls[0].url).toBe(`${base}/account/company`);
    expect(calls[0].init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      organizationId: "org_new",
    });
  });

  it("is false when the server refuses or does not answer", async () => {
    expect(
      await registerCompany(api({ status: 403 }).request, base, "org_new"),
    ).toBe(false);
    expect(
      await registerCompany(api({ status: 409 }).request, base, "org_new"),
    ).toBe(false);
    expect(
      await registerCompany(api(new Error("down")).request, base, "org_new"),
    ).toBe(false);
  });
});
