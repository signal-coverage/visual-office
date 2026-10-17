import { test, expect } from "./fixtures";
import { admin } from "./support/admin";

const ARCHIVED_MESSAGE = "This room is archived and cannot be entered.";
const MOVED_NOTICE = "That room was archived. Moving you to the main office.";

// The end-to-end stack has no sign-in, so nobody has "signed in": there are no people to put in a group
// (the server answers 404 for a member that never signed in), and which rooms a member may enter cannot be
// seen from here. Members, groups and access are covered by the unit tests, on the memory and Postgres twins.
test.describe("rooms and groups, as an admin manages them", () => {
  test.beforeAll(async () => {
    await admin.createFloor("wing-a", "Wing A");
    await admin.createFloor("wing-b", "Wing B");
  });

  test.afterEach(async () => {
    // Whatever a test left archived or renamed, the next one starts from the same two rooms
    await admin.unarchive("wing-a");
    await admin.unarchive("wing-b");
    await admin.rename("wing-a", "Wing A");
    await admin.rename("wing-b", "Wing B");
  });

  test("an archived room leaves the map and the Rooms list, is refused at the door with its message, and comes back", async ({
    join,
    open,
  }) => {
    const ana = await join("Ana");

    const openMap = async () => {
      await ana.tap("KeyR");
      const map = ana.page.getByRole("dialog", { name: "Map of rooms" });
      await expect(map).toBeVisible();
      return map;
    };
    const closeMap = async () => {
      await ana.tap("Escape");
      await ana.waitUntilLocked();
    };

    let map = await openMap();
    await expect(map.locator('[data-room="wing-a"]')).toBeVisible();
    await expect(map.locator('[data-room="wing-b"]')).toBeVisible();
    await closeMap();

    expect((await admin.archive("wing-b")).status).toBe(200);

    map = await openMap();
    await expect(map.locator('[data-room="wing-a"]')).toBeVisible();
    await expect(map.locator('[data-room="wing-b"]')).toHaveCount(0);
    await closeMap();

    await ana.openMenu();
    await ana.menuItem("Rooms");
    await expect(
      ana.menu.getByRole("button", { name: "Wing A" }),
    ).toBeVisible();
    await expect(ana.menu.getByRole("button", { name: "Wing B" })).toHaveCount(
      0,
    );
    await ana.menu.getByRole("button", { name: "Back", exact: true }).click();
    await ana.closeMenu();

    // Asking for it by the link is refused, with its own words
    const page = await open("/?name=Beto&e2e&floor=wing-b");
    await expect(page.getByText(ARCHIVED_MESSAGE)).toBeVisible();
    await expect(page.getByRole("button", { name: "Menu (Esc)" })).toHaveCount(
      0,
    );

    expect((await admin.unarchive("wing-b")).status).toBe(200);

    map = await openMap();
    await expect(map.locator('[data-room="wing-b"]')).toBeVisible();
    await closeMap();

    const back = await join("Cris", { query: "floor=wing-b" });
    await expect(back.page.getByLabel("Current room")).toContainText("Wing B");
  });

  test("somebody inside a room when it is archived is sent to the main office, with a notice", async ({
    join,
  }) => {
    const dora = await join("Dora", { query: "floor=wing-a" });
    await expect(dora.page.getByLabel("Current room")).toContainText("Wing A");

    expect((await admin.archive("wing-a")).status).toBe(200);

    await expect(dora.page.getByLabel("Current room")).toContainText(
      "Main office",
    );
    await expect(dora.page.getByText(MOVED_NOTICE)).toBeVisible();
    await dora.waitUntilLocked();
  });

  test("a renamed room shows its new name on the map, and keeps its id", async ({
    join,
  }) => {
    const eli = await join("Eli");
    expect((await admin.rename("wing-a", "Wing Alpha")).status).toBe(200);

    await eli.tap("KeyR");
    const map = eli.page.getByRole("dialog", { name: "Map of rooms" });
    await expect(map).toBeVisible();
    await expect(map.locator('[data-room="wing-a"]')).toHaveAccessibleName(
      "Go to Wing Alpha",
    );
    await map.locator('[data-room="wing-a"]').hover();
    await expect(map.getByText("Wing Alpha", { exact: true })).toBeVisible();
  });

  test("the main office cannot be archived, and the Rooms screen's list says which rooms are archived", async () => {
    const refused = await admin.archive("office");
    expect(refused.status).toBe(409);
    expect(String(refused.body?.error)).toMatch(/main office/i);

    await admin.archive("wing-b");
    const { body } = await admin.floors();
    const floors = body?.floors as Array<{ id: string; archivedAt?: number }>;
    expect(floors.find((floor) => floor.id === "wing-b")?.archivedAt).toEqual(
      expect.any(Number),
    );
    expect(floors.find((floor) => floor.id === "wing-a")).not.toHaveProperty(
      "archivedAt",
    );
    expect(floors.find((floor) => floor.id === "office")).not.toHaveProperty(
      "archivedAt",
    );
  });

  test("a group made through the API lists its rooms; people need to have signed in first", async () => {
    const made = await admin.createGroup("Human Resources");
    expect(made.status).toBe(201);
    const id = (made.body?.group as { id: string }).id;
    expect(id).toBe("human-resources");

    expect((await admin.setGroupFloor(id, "wing-a", true)).status).toBe(200);
    expect((await admin.setGroupFloor(id, "wing-b", true)).status).toBe(200);
    // The common room is everybody's already
    expect((await admin.setGroupFloor(id, "office", true)).status).toBe(400);
    // Nobody has signed in on this stack, so nobody can be put in a group
    expect((await admin.setGroupMember(id, "user_nobody", true)).status).toBe(
      404,
    );

    const { status, body } = await admin.groups();
    expect(status).toBe(200);
    expect(body?.limits).toEqual({ groups: 30, members: 200, floors: 40 });
    expect(body?.groups).toEqual([
      expect.objectContaining({
        id,
        name: "Human Resources",
        floors: ["wing-a", "wing-b"],
        members: [],
      }),
    ]);

    // An archived room stays in the group, ready for when it comes back
    await admin.archive("wing-a");
    const again = (await admin.groups()).body?.groups as Array<{
      floors: string[];
    }>;
    expect(again[0].floors).toEqual(["wing-a", "wing-b"]);

    expect((await admin.deleteGroup(id)).status).toBe(200);
    expect((await admin.groups()).body?.groups).toEqual([]);
  });
});
