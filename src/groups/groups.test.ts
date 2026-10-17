import { describe, expect, it } from "vitest";
import {
  applyChanges,
  createGroup,
  deleteGroup,
  fetchGroups,
  renameGroup,
  setGroupFloor,
  setGroupMember,
} from "./groups";

const admin = "https://office.example.com/admin";

function api(...answers: Array<{ status?: number; body?: unknown } | Error>) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  let n = 0;
  const request = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const answer = answers[Math.min(n++, answers.length - 1)];
    if (answer instanceof Error) throw answer;
    return new Response(JSON.stringify(answer.body ?? {}), {
      status: answer.status ?? 200,
    });
  };
  return { calls, request };
}

const group = {
  id: "hr",
  name: "Human Resources",
  createdAt: 5,
  floors: ["lab"],
  members: ["user_ana"],
};
const limits = { groups: 30, members: 200, floors: 40 };
const bodyOf = (call: { init: RequestInit | undefined }) =>
  JSON.parse(String(call.init?.body));

describe("fetchGroups", () => {
  it("brings the groups and the limits", async () => {
    const { request, calls } = api({ body: { groups: [group], limits } });
    expect(await fetchGroups(request, admin)).toEqual({
      groups: [group],
      limits,
    });
    expect(calls[0].url).toBe(`${admin}/groups`);
  });

  it("is nothing when the server refuses, does not answer or sends something else", async () => {
    expect(await fetchGroups(api({ status: 403 }).request, admin)).toBeNull();
    expect(await fetchGroups(api(new Error("down")).request, admin)).toBeNull();
    for (const body of [
      {},
      { groups: "x", limits },
      { groups: [{ ...group, floors: "lab" }], limits },
      { groups: [{ ...group, members: [3] }], limits },
      { groups: [{ id: "x" }], limits },
    ])
      expect(await fetchGroups(api({ body }).request, admin)).toBeNull();
  });

  it("uses the limits the server promises when it does not say", async () => {
    const found = await fetchGroups(
      api({ body: { groups: [group] } }).request,
      admin,
    );
    expect(found?.limits).toEqual(limits);
  });
});

describe("the calls that change a group", () => {
  it("makes a group from its name", async () => {
    const { request, calls } = api({ status: 201, body: { group } });
    expect(await createGroup(request, admin, "Human Resources")).toEqual({
      ok: true,
      group,
    });
    expect(calls[0].url).toBe(`${admin}/groups`);
    expect(calls[0].init?.method).toBe("POST");
    expect(bodyOf(calls[0])).toEqual({ name: "Human Resources" });
  });

  it("renames, deletes, and adds or removes a person or a room", async () => {
    const renamed = api({ body: { group } });
    expect(await renameGroup(renamed.request, admin, "hr", "People")).toEqual({
      ok: true,
      group,
    });
    expect(renamed.calls[0].url).toBe(`${admin}/groups/hr`);
    expect(bodyOf(renamed.calls[0])).toEqual({ name: "People" });

    const deleted = api({ body: { group: "hr", deleted: true } });
    expect(await deleteGroup(deleted.request, admin, "hr")).toEqual({
      ok: true,
    });
    expect(deleted.calls[0].url).toBe(`${admin}/groups/hr/delete`);

    const member = api({ body: {} });
    expect(
      await setGroupMember(member.request, admin, "hr", "user_ana", true),
    ).toEqual({ ok: true });
    expect(member.calls[0].url).toBe(`${admin}/groups/hr/members`);
    expect(bodyOf(member.calls[0])).toEqual({
      userId: "user_ana",
      member: true,
    });

    const floor = api({ body: {} });
    expect(
      await setGroupFloor(floor.request, admin, "hr", "lab", false),
    ).toEqual({ ok: true });
    expect(floor.calls[0].url).toBe(`${admin}/groups/hr/floors`);
    expect(bodyOf(floor.calls[0])).toEqual({ floor: "lab", allowed: false });
  });

  it("gives the server's words when it refuses, or says it could not be done", async () => {
    expect(
      await createGroup(
        api({
          status: 409,
          body: { error: "There is a group with that name." },
        }).request,
        admin,
        "X",
      ),
    ).toEqual({ ok: false, text: "There is a group with that name." });
    const down = await setGroupMember(
      api(new Error("down")).request,
      admin,
      "hr",
      "u",
      true,
    );
    expect(down.ok).toBe(false);
    expect(!down.ok && down.text).toMatch(/try again/i);
  });
});

describe("applyChanges", () => {
  it("does each change in order and says it is done", async () => {
    const { request, calls } = api({ body: { group } }, { body: {} });
    const result = await applyChanges(request, admin, "hr", [
      { kind: "rename", name: "People" },
      { kind: "floor", floor: "lab", allowed: false },
      { kind: "member", userId: "user_ana", member: true },
    ]);
    expect(result).toEqual({ ok: true, done: 3 });
    expect(calls.map((call) => call.url)).toEqual([
      `${admin}/groups/hr`,
      `${admin}/groups/hr/floors`,
      `${admin}/groups/hr/members`,
    ]);
  });

  it("stops at the first change the server refuses, saying how many were made and why", async () => {
    const { request, calls } = api(
      { body: {} },
      { status: 409, body: { error: "A group has at most 40 rooms." } },
      { body: {} },
    );
    const result = await applyChanges(request, admin, "hr", [
      { kind: "floor", floor: "a", allowed: true },
      { kind: "floor", floor: "b", allowed: true },
      { kind: "floor", floor: "c", allowed: true },
    ]);
    expect(result).toEqual({
      ok: false,
      done: 1,
      text: "A group has at most 40 rooms.",
    });
    expect(calls).toHaveLength(2);
  });

  it("does nothing, and is done, when there is nothing to change", async () => {
    const { request, calls } = api({ body: {} });
    expect(await applyChanges(request, admin, "hr", [])).toEqual({
      ok: true,
      done: 0,
    });
    expect(calls).toEqual([]);
  });
});
