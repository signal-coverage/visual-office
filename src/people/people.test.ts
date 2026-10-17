import { describe, expect, it } from "vitest";
import {
  canEnterFloor,
  entryIsFixed,
  entryIsLocked,
  fetchPeople,
  groupsGiving,
  moderatePerson,
  setHead,
  withAccess,
  withHead,
  type Person,
} from "./people";

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
      floorInfo: [
        { id: "office", name: "office", common: false },
        { id: "sales", name: "sales", common: false },
      ],
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

describe("fetchPeople and bans", () => {
  it("keeps until when somebody is banned, when the server says", async () => {
    const banned = { ...ana, bannedUntil: 5_000 };
    const { request } = api({
      body: {
        floors: ["office"],
        people: [banned, { ...beto, bannedUntil: null }],
      },
    });
    const list = await fetchPeople(request, base);
    expect(list?.people.map((p) => p.bannedUntil)).toEqual([5_000, null]);
  });

  it("refuses a ban end that is not a time", async () => {
    const { request } = api({
      body: { floors: [], people: [{ ...ana, bannedUntil: "later" }] },
    });
    expect(await fetchPeople(request, base)).toBeNull();
  });
});

describe("moderatePerson", () => {
  it("asks the server to act, and says what it did", async () => {
    const { request, calls } = api({
      body: { ok: true, action: "ban", name: "Ana", minutes: 10 },
    });
    expect(await moderatePerson(request, base, "ban", "user_ana", 10)).toEqual({
      ok: true,
      text: "Ana was banned for 10 minutes.",
    });
    expect(calls[0].url).toBe(`${base}/moderation`);
    expect(calls[0].init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      action: "ban",
      userId: "user_ana",
      minutes: 10,
    });
  });

  it("sends no length for what is not a ban", async () => {
    const { request, calls } = api({
      body: { ok: true, action: "kick", name: "Ana" },
    });
    await moderatePerson(request, base, "kick", "user_ana");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      action: "kick",
      userId: "user_ana",
    });
  });

  it("gives the server's words when it refuses", async () => {
    const { request } = api({
      status: 409,
      body: { error: "That person is not in the office.", reason: "not_here" },
    });
    expect(await moderatePerson(request, base, "kick", "user_ana")).toEqual({
      ok: false,
      text: "That person is not in the office.",
    });
  });

  it("says it could not be done when the server does not answer", async () => {
    expect(
      await moderatePerson(api(new Error("down")).request, base, "mute", "x"),
    ).toEqual({
      ok: false,
      text: "That could not be done right now. Try again in a moment.",
    });
  });
});

describe("people and the rooms they can enter", () => {
  const floorInfo = [
    { id: "office", name: "Main office", common: true },
    { id: "hr", name: "People", common: false },
    { id: "lab", name: "Lab", common: false },
  ];
  const person = (overrides: Partial<Person>): Person => ({
    ...ana,
    access: [],
    ...overrides,
  });

  it("brings the names of the floors, or makes them from the ids when the server says none", async () => {
    const withNames = api({
      body: { floors: ["office", "hr"], floorInfo, people: [] },
    });
    expect((await fetchPeople(withNames.request, base))?.floorInfo).toEqual(
      floorInfo,
    );
    const without = api({ body: { floors: ["office", "sales"], people: [] } });
    expect((await fetchPeople(without.request, base))?.floorInfo).toEqual([
      { id: "office", name: "office", common: false },
      { id: "sales", name: "sales", common: false },
    ]);
  });

  it("brings the entries each person was given", async () => {
    const { request } = api({
      body: {
        floors: ["office"],
        people: [{ ...ana, access: ["hr"], canEnter: ["office", "hr"] }],
      },
    });
    expect((await fetchPeople(request, base))?.people[0]).toMatchObject({
      access: ["hr"],
    });
  });

  it("works out where somebody may enter: common rooms, their own as head, everything as admin, and their entries", () => {
    expect(canEnterFloor(person({}), floorInfo[0])).toBe(true);
    expect(canEnterFloor(person({}), floorInfo[1])).toBe(false);
    expect(canEnterFloor(person({ access: ["hr"] }), floorInfo[1])).toBe(true);
    expect(canEnterFloor(person({ headOf: ["lab"] }), floorInfo[2])).toBe(true);
    expect(canEnterFloor(person({ headOf: ["lab"] }), floorInfo[1])).toBe(
      false,
    );
    expect(canEnterFloor(person({ isAdmin: true }), floorInfo[1])).toBe(true);
  });

  it("says when the checkbox is not for changing: everything that already lets somebody in", () => {
    expect(entryIsFixed(person({}), floorInfo[0])).toBe(true);
    expect(entryIsFixed(person({ isAdmin: true }), floorInfo[1])).toBe(true);
    expect(entryIsFixed(person({ headOf: ["hr"] }), floorInfo[1])).toBe(true);
    expect(entryIsFixed(person({}), floorInfo[1])).toBe(false);
  });

  it("gives and takes away an entry in the list without changing the one it was given", () => {
    const people = [person({ id: "user_ana" }), person({ id: "user_beto" })];
    const given = withAccess(people, "user_ana", "hr", true);
    expect(given[0].access).toEqual(["hr"]);
    expect(given[1].access).toEqual([]);
    expect(people[0].access).toEqual([]);
    expect(withAccess(given, "user_ana", "hr", false)[0].access).toEqual([]);
    expect(withAccess(given, "user_ana", "hr", true)[0].access).toEqual(["hr"]);
  });
});

describe("people, groups and the rooms they open", () => {
  const floorInfo = [
    { id: "office", name: "Main office", common: true },
    { id: "hr", name: "People", common: false },
    { id: "lab", name: "Lab", common: false },
  ];
  const viaHr = {
    ...ana,
    access: [] as string[],
    groups: [{ id: "human-resources", name: "Human Resources" }],
    effectiveAccess: [{ floor: "hr", sources: ["group:Human Resources"] }],
  };
  const both: Person = {
    ...viaHr,
    access: ["hr"],
    effectiveAccess: [
      { floor: "hr", sources: ["direct", "group:Human Resources"] },
    ],
  };

  it("keeps the groups of each person and where each entry comes from", async () => {
    const { request } = api({
      body: { floors: ["office"], people: [viaHr, ana] },
    });
    const list = await fetchPeople(request, base);
    expect(list?.people[0]).toMatchObject({
      groups: [{ id: "human-resources", name: "Human Resources" }],
      effectiveAccess: [{ floor: "hr", sources: ["group:Human Resources"] }],
    });
    expect(list?.people[1]).toEqual(ana);
  });

  it("is nothing when the groups or the sources are not what was asked", async () => {
    for (const bad of [
      { ...viaHr, groups: "x" },
      { ...viaHr, groups: [{ id: 1, name: "x" }] },
      { ...viaHr, effectiveAccess: [{ floor: "hr", sources: "direct" }] },
      { ...viaHr, effectiveAccess: [{ floor: 3, sources: [] }] },
    ])
      expect(
        await fetchPeople(
          api({ body: { floors: ["office"], people: [bad] } }).request,
          base,
        ),
      ).toBeNull();
  });

  it("names the groups that give somebody a room, and none for a direct entry", () => {
    expect(groupsGiving(viaHr, "hr")).toEqual(["Human Resources"]);
    expect(groupsGiving(both, "hr")).toEqual(["Human Resources"]);
    expect(groupsGiving(viaHr, "lab")).toEqual([]);
    expect(groupsGiving(ana, "hr")).toEqual([]);
  });

  it("counts a room from a group as a room somebody may enter", () => {
    expect(canEnterFloor(viaHr, floorInfo[1])).toBe(true);
    expect(canEnterFloor(viaHr, floorInfo[2])).toBe(false);
  });

  it("locks the checkbox when the only way in is a group, and not when there is an entry of their own", () => {
    expect(entryIsLocked(viaHr, floorInfo[1])).toBe(true);
    expect(entryIsLocked(both, floorInfo[1])).toBe(false);
    expect(entryIsLocked(viaHr, floorInfo[2])).toBe(false);
    expect(entryIsLocked(ana, floorInfo[1])).toBe(false);
    // What already lets somebody in anyway stays locked, as before
    expect(entryIsLocked(ana, floorInfo[0])).toBe(true);
    expect(entryIsLocked({ ...ana, isAdmin: true }, floorInfo[1])).toBe(true);
  });

  it("keeps where entries come from in step when an entry of their own is given or taken away", () => {
    const given = withAccess([viaHr], "user_ana", "hr", true)[0];
    expect(given.access).toEqual(["hr"]);
    expect(given.effectiveAccess).toEqual([
      { floor: "hr", sources: ["direct", "group:Human Resources"] },
    ]);
    const taken = withAccess([both], "user_ana", "hr", false)[0];
    expect(taken.effectiveAccess).toEqual([
      { floor: "hr", sources: ["group:Human Resources"] },
    ]);
    const lab = withAccess([viaHr], "user_ana", "lab", true)[0];
    expect(lab.effectiveAccess).toEqual([
      { floor: "hr", sources: ["group:Human Resources"] },
      { floor: "lab", sources: ["direct"] },
    ]);
    expect(
      withAccess([lab], "user_ana", "lab", false)[0].effectiveAccess,
    ).toEqual([{ floor: "hr", sources: ["group:Human Resources"] }]);
  });

  it("leaves people who do not carry the sources as they were", () => {
    expect(withAccess([ana], "user_ana", "hr", true)[0]).not.toHaveProperty(
      "effectiveAccess",
    );
  });
});
