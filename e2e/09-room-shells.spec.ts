import { test, expect } from "./fixtures";
import { admin } from "./support/admin";

test.describe("rooms with a shell of their own", () => {
  test.beforeAll(async () => {
    await admin.createFloor("shells", "Shells", "meeting");
    await admin.createFloor("openroom", "Open room", "open");
  });

  test("the admin API offers the templates, with a line about each", async () => {
    const templates = await admin.templates();
    expect(templates.map((t) => t.id)).toEqual([
      "office",
      "open",
      "meeting",
      "lounge",
    ]);
    for (const template of templates)
      expect(template.description.length).toBeGreaterThan(20);
  });

  test("a room made from the Meeting floor template has its own size, rooms, whiteboards and map plan", async ({
    join,
  }) => {
    const ana = await join("Ana", { query: "floor=shells" });
    await expect(ana.page.getByLabel("Current room")).toContainText("Shells");

    // The floor is 36 m wide: a place past the main office's wall (15 m) is open floor here
    await ana.teleport(0, 6.6, 0);
    await ana.teleport(16.5, 6.6, 0);
    await expect(
      ana.page.getByRole("status").filter({ hasText: "You are in: Lounge" }),
    ).toBeVisible();

    // The first of its private rooms: in through the doorway, and the room's name is the one of this shell
    await ana.teleport(-7.5, 6.6, 0);
    await ana.teleport(-7.5, -3.5, 0);
    await expect(
      ana.page
        .getByRole("status")
        .filter({ hasText: "Private zone: Meeting room A" }),
    ).toBeVisible();

    // Its whiteboard is on the west wall of the room, where this shell put it
    await ana.teleport(-15.5, -3.5, Math.PI / 2);
    await ana.teleport(-15.5, -6, Math.PI / 2);
    await expect(
      ana.page.getByText(/Whiteboard · hold click to draw/),
    ).toBeVisible();

    // The map shows this room's own plan: a floor of another shape, with its own walls
    await ana.tap("KeyR");
    const map = ana.page.getByRole("dialog", { name: "Map of rooms" });
    await expect(map).toBeVisible();
    const floorOf = (room: string) =>
      map.locator(`[data-room="${room}"] svg rect`).first();
    await expect(floorOf("shells")).toBeVisible();
    const shape = async (room: string) =>
      floorOf(room).evaluate((rect) => {
        const width = Number(rect.getAttribute("width"));
        const height = Number(rect.getAttribute("height"));
        return Math.round((width / height) * 100) / 100;
      });
    // 36 by 20 against 30 by 20
    await expect.poll(() => shape("shells")).toBe(1.8);
    await expect.poll(() => shape("office")).toBe(1.5);
    const rectsIn = (room: string) =>
      map.locator(`[data-room="${room}"] svg rect`).count();
    expect(await rectsIn("shells")).not.toBe(await rectsIn("office"));
  });

  test("a room made from the Open floor template has no private room, and its board is for everybody", async ({
    join,
  }) => {
    const ana = await join("Ana", { query: "floor=openroom" });
    await expect(ana.page.getByLabel("Current room")).toContainText(
      "Open room",
    );

    // Where the main office has its meeting room there is only desk area here
    await ana.teleport(-5, 6.2, 0);
    await ana.teleport(-5, -3.5, 0);
    await expect(
      ana.page.getByRole("status").filter({ hasText: "You are in: Desk area" }),
    ).toBeVisible();
    await expect(
      ana.page.getByRole("status").filter({ hasText: "Private zone" }),
    ).toHaveCount(0);

    // A whiteboard on the north wall, in reach of anybody on the floor
    await ana.teleport(-5, -5.5, 0);
    await expect(
      ana.page.getByText(/Whiteboard · hold click to draw/),
    ).toBeVisible();
  });

  test("the main office is as it was: its meeting room is where it always was", async ({
    join,
  }) => {
    const ana = await join("Ana");
    await ana.teleport(-7.5, 8, 0);
    await ana.teleport(-7.5, -3.5, 0);
    await expect(
      ana.page
        .getByRole("status")
        .filter({ hasText: "Private zone: Meeting room" }),
    ).toBeVisible();
  });
});
