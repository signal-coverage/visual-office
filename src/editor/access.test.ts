import { describe, expect, it } from "vitest";
import { fetchAccess } from "./access";

const backend = (respond: () => Promise<Response>) => ({
  floorBase: "https://office.example.com/admin/floors/office",
  request: respond,
});
const says = (body: unknown) => async () => new Response(JSON.stringify(body));

describe("fetchAccess", () => {
  it("says what the game server lets the person do", async () => {
    expect(
      await fetchAccess(backend(says({ canEdit: true, canManage: true }))),
    ).toEqual({ canEdit: true, canManage: true });
    expect(
      await fetchAccess(backend(says({ canEdit: true, canManage: false }))),
    ).toEqual({ canEdit: true, canManage: false });
    expect(
      await fetchAccess(backend(says({ canEdit: false, canManage: false }))),
    ).toEqual({ canEdit: false, canManage: false });
  });

  it("asks the floor's access address", async () => {
    let asked = "";
    await fetchAccess({
      floorBase: "https://office.example.com/admin/floors/office",
      request: async (url) => {
        asked = url;
        return new Response(JSON.stringify({}));
      },
    });
    expect(asked).toBe("https://office.example.com/admin/floors/office/access");
  });

  it("takes each answer on its own: managing says nothing about editing", async () => {
    expect(await fetchAccess(backend(says({ canManage: true })))).toEqual({
      canEdit: false,
      canManage: true,
    });
  });

  it("is a no for anything that is not a clear yes: an error, nonsense, no answer", async () => {
    const no = { canEdit: false, canManage: false };
    for (const respond of [
      async () => new Response("{}", { status: 403 }),
      says({ canEdit: "yes", canManage: 1 }),
      says({}),
      says(null),
      async () => new Response("not json"),
      async () => {
        throw new Error("network down");
      },
    ])
      expect(await fetchAccess(backend(respond))).toEqual(no);
  });
});
