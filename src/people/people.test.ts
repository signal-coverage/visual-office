import { describe, expect, it } from "vitest";
import { fetchPeople, setHead, withHead, type Person } from "./people";

const base = "https://office.example.com/admin";
const ana: Person = {
  id: "user_ana",
  name: "Ana",
  email: "ana@acme.com",
  isAdmin: false,
  headOf: [],
};
const beto: Person = {
  id: "user_beto",
  name: "Beto",
  email: null,
  isAdmin: true,
  headOf: ["office"],
};

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

describe("fetchPeople", () => {
  it("brings the floors and the people", async () => {
    const { request, calls } = api({
      body: { floors: ["office", "sales"], people: [ana, beto] },
    });
    expect(await fetchPeople(request, base)).toEqual({
      floors: ["office", "sales"],
      people: [ana, beto],
    });
    expect(calls[0].url).toBe(`${base}/people`);
  });

  it("is nothing when the server refuses or does not answer, so the screen can say so", async () => {
    expect(await fetchPeople(api({ status: 403 }).request, base)).toBeNull();
    expect(await fetchPeople(api(new Error("down")).request, base)).toBeNull();
  });

  it("is nothing for an answer that is not what was asked", async () => {
    for (const body of [
      {},
      { floors: "office", people: [] },
      { floors: [], people: [{}] },
      null,
    ])
      expect(
        await fetchPeople(api({ body }).request, base),
        JSON.stringify(body),
      ).toBeNull();
  });
});

describe("setHead", () => {
  it("asks the server to name or remove a head, and says whether it was done", async () => {
    const { request, calls } = api({ body: { head: true } });
    expect(await setHead(request, base, "office", "user_ana", true)).toBe(true);
    expect(calls[0].url).toBe(`${base}/floors/office/heads`);
    expect(calls[0].init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      userId: "user_ana",
      head: true,
    });
  });

  it("is false when the server refuses or does not answer", async () => {
    expect(
      await setHead(api({ status: 404 }).request, base, "office", "x", true),
    ).toBe(false);
    expect(
      await setHead(api(new Error("down")).request, base, "office", "x", true),
    ).toBe(false);
  });
});

describe("withHead", () => {
  it("makes somebody head of a floor, in the list, leaving the rest as it was", () => {
    const next = withHead([ana, beto], "user_ana", "sales", true);
    expect(next[0].headOf).toEqual(["sales"]);
    expect(next[1]).toBe(beto);
  });

  it("keeps the floors in order and does not repeat one", () => {
    const next = withHead([beto], "user_beto", "office", true);
    expect(next[0].headOf).toEqual(["office"]);
    expect(withHead(next, "user_beto", "dev", true)[0].headOf).toEqual([
      "dev",
      "office",
    ]);
  });

  it("takes the floor away from somebody", () => {
    expect(withHead([beto], "user_beto", "office", false)[0].headOf).toEqual(
      [],
    );
  });

  it("does not change the list it was given", () => {
    const list = [ana];
    withHead(list, "user_ana", "sales", true);
    expect(list[0].headOf).toEqual([]);
  });
});
