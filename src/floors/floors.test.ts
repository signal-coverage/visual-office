import { describe, expect, it } from "vitest";
import {
  createRoom,
  fetchFloors,
  fetchRoomsAdmin,
  setFloorAccess,
} from "./floors";

const server = "https://office.example.com";
const admin = `${server}/admin`;

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

const office = {
  id: "office",
  name: "Main office",
  common: true,
  canEnter: true,
};
const hr = { id: "hr", name: "People", common: false, canEnter: false };

describe("fetchFloors", () => {
  it("brings the rooms and which of them the person may enter", async () => {
    const { request, calls } = api({ body: { floors: [office, hr] } });
    expect(await fetchFloors(request, server)).toEqual([office, hr]);
    expect(calls[0].url).toBe(`${server}/account/floors`);
  });

  it("is nothing when the server refuses, does not answer or sends something else", async () => {
    expect(await fetchFloors(api({ status: 401 }).request, server)).toBeNull();
    expect(
      await fetchFloors(api(new Error("offline")).request, server),
    ).toBeNull();
    expect(await fetchFloors(api({ body: {} }).request, server)).toBeNull();
    expect(
      await fetchFloors(api({ body: { floors: "x" } }).request, server),
    ).toBeNull();
    expect(
      await fetchFloors(
        api({ body: { floors: [{ id: "x", name: "X", common: false }] } })
          .request,
        server,
      ),
    ).toBeNull();
  });

  it("keeps only what is meant for the player", async () => {
    const { request } = api({
      body: { floors: [{ ...hr, accessList: ["user_ana"] }] },
    });
    expect(await fetchFloors(request, server)).toEqual([hr]);
  });
});

describe("fetchRoomsAdmin", () => {
  it("brings every room", async () => {
    const floor = { id: "hr", name: "People", common: false, createdAt: 5 };
    const { request, calls } = api({ body: { floors: [floor] } });
    expect(await fetchRoomsAdmin(request, admin)).toEqual([floor]);
    expect(calls[0].url).toBe(`${admin}/floors`);
  });

  it("is nothing when the server would not say", async () => {
    expect(
      await fetchRoomsAdmin(api({ status: 403 }).request, admin),
    ).toBeNull();
    expect(
      await fetchRoomsAdmin(api({ body: { floors: [{}] } }).request, admin),
    ).toBeNull();
  });
});

describe("createRoom", () => {
  it("sends the name and brings the room that was made", async () => {
    const floor = { id: "hr", name: "People", common: false, createdAt: 5 };
    const { request, calls } = api({ status: 201, body: { floor } });
    expect(await createRoom(request, admin, "People")).toEqual({
      ok: true,
      floor,
    });
    expect(calls[0].url).toBe(`${admin}/floors`);
    expect(calls[0].init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ name: "People" });
  });

  it("says what the server said when it refused", async () => {
    const { request } = api({
      status: 409,
      body: { error: "There is a room with that id." },
    });
    expect(await createRoom(request, admin, "People")).toEqual({
      ok: false,
      text: "There is a room with that id.",
    });
  });

  it("says it could not when the server does not answer", async () => {
    const result = await createRoom(
      api(new Error("offline")).request,
      admin,
      "People",
    );
    expect(result.ok).toBe(false);
  });
});

describe("setFloorAccess", () => {
  it("sends who and whether, and says whether it was done", async () => {
    const { request, calls } = api({ body: { floor: "hr" } });
    expect(await setFloorAccess(request, admin, "hr", "user_ana", true)).toBe(
      true,
    );
    expect(calls[0].url).toBe(`${admin}/floors/hr/access`);
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      userId: "user_ana",
      allowed: true,
    });
  });

  it("is false when the server refuses or does not answer", async () => {
    expect(
      await setFloorAccess(
        api({ status: 403 }).request,
        admin,
        "hr",
        "u",
        true,
      ),
    ).toBe(false);
    expect(
      await setFloorAccess(
        api(new Error("offline")).request,
        admin,
        "hr",
        "u",
        true,
      ),
    ).toBe(false);
  });
});
