import { describe, expect, it } from "vitest";
import {
  archiveRoom,
  createRoom,
  fetchFloors,
  fetchRoomsAdmin,
  renameRoom,
  setFloorAccess,
  splitRooms,
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
    expect((await fetchRoomsAdmin(request, admin))?.floors).toEqual([floor]);
    expect(calls[0].url).toBe(`${admin}/floors`);
  });

  it("brings the templates a room can be made from, as far as they are well formed", async () => {
    const templates = [
      { id: "office", name: "Open office", description: "The classic one." },
      { id: "open", name: "Open floor", description: "One big space." },
    ];
    const { request } = api({
      body: {
        floors: [],
        templates: [...templates, { id: 3 }, null, { id: "x", name: "X" }],
      },
    });
    expect((await fetchRoomsAdmin(request, admin))?.templates).toEqual(
      templates,
    );
  });

  it("has no templates for a server that does not say", async () => {
    const { request } = api({ body: { floors: [] } });
    expect(await fetchRoomsAdmin(request, admin)).toEqual({
      floors: [],
      templates: [],
    });
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

  it("sends the template when one is chosen, and none when it is not", async () => {
    const floor = { id: "hr", name: "People", common: false, createdAt: 5 };
    const { request, calls } = api({ status: 201, body: { floor } });
    await createRoom(request, admin, "People", "meeting");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      name: "People",
      template: "meeting",
    });
  });

  it("brings the room even when the server says its template could not be applied", async () => {
    const floor = { id: "hr", name: "People", common: false, createdAt: 5 };
    const { request } = api({
      status: 500,
      body: { error: "The room was made, but its template…", floor },
    });
    const result = await createRoom(request, admin, "People", "meeting");
    expect(result).toEqual({
      ok: false,
      text: "The room was made, but its template…",
      floor,
    });
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

describe("archived rooms in the admin list", () => {
  it("keeps when a room was archived, and only then", async () => {
    const floors = [
      { id: "hr", name: "People", common: false, createdAt: 5 },
      { id: "old", name: "Old", common: false, createdAt: 6, archivedAt: 9 },
    ];
    const { request } = api({ body: { floors } });
    expect((await fetchRoomsAdmin(request, admin))?.floors).toEqual(floors);
  });

  it("is nothing for a room whose archive moment is not a number", async () => {
    const floor = {
      id: "x",
      name: "X",
      common: false,
      createdAt: 1,
      archivedAt: "yes",
    };
    expect(
      await fetchRoomsAdmin(api({ body: { floors: [floor] } }).request, admin),
    ).toBeNull();
  });

  it("splits the rooms into the ones in use and the archived ones, in order", () => {
    const rooms = [
      { id: "office", name: "Main", common: true, createdAt: 0 },
      { id: "a", name: "A", common: false, createdAt: 1, archivedAt: 5 },
      { id: "b", name: "B", common: false, createdAt: 2 },
    ];
    expect(splitRooms(rooms)).toEqual({
      active: [rooms[0], rooms[2]],
      archived: [rooms[1]],
    });
  });
});

describe("renameRoom", () => {
  it("asks the server to rename it and gives back the room as it is now", async () => {
    const floor = {
      id: "hr",
      name: "Human Resources",
      common: false,
      createdAt: 5,
    };
    const { request, calls } = api({ body: { floor } });
    expect(await renameRoom(request, admin, "hr", "Human Resources")).toEqual({
      ok: true,
      floor,
    });
    expect(calls[0].url).toBe(`${admin}/floors/hr`);
    expect(calls[0].init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      name: "Human Resources",
    });
  });

  it("gives the server's words when it refuses, or says it could not be done", async () => {
    expect(
      await renameRoom(
        api({ status: 400, body: { error: "Say the room's new name." } })
          .request,
        admin,
        "hr",
        "",
      ),
    ).toEqual({ ok: false, text: "Say the room's new name." });
    expect(
      (await renameRoom(api(new Error("down")).request, admin, "hr", "X")).ok,
    ).toBe(false);
  });
});

describe("archiveRoom", () => {
  const floor = {
    id: "hr",
    name: "People",
    common: false,
    createdAt: 5,
    archivedAt: 9,
  };

  it("asks the server to archive a room, or to bring it back", async () => {
    const archived = api({ body: { floor } });
    expect(await archiveRoom(archived.request, admin, "hr", true)).toEqual({
      ok: true,
      floor,
    });
    expect(archived.calls[0].url).toBe(`${admin}/floors/hr/archive`);
    expect(archived.calls[0].init?.method).toBe("POST");
    const back = api({ body: { floor: { ...floor, archivedAt: undefined } } });
    await archiveRoom(back.request, admin, "hr", false);
    expect(back.calls[0].url).toBe(`${admin}/floors/hr/unarchive`);
  });

  it("gives the server's words when it will not, as for the main office", async () => {
    const refused = api({
      status: 409,
      body: { error: "The main office cannot be archived." },
    });
    expect(await archiveRoom(refused.request, admin, "office", true)).toEqual({
      ok: false,
      text: "The main office cannot be archived.",
    });
  });

  it("says it could not be done when the server does not answer", async () => {
    const reply = await archiveRoom(
      api(new Error("down")).request,
      admin,
      "hr",
      true,
    );
    expect(reply.ok).toBe(false);
  });
});
