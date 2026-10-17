import { test, expect } from "./fixtures";
import { admin } from "./support/admin";

const GREY_FLOOR = "rgb(230, 230, 230)";
const WARM_FLOOR = "rgb(246, 230, 200)";

test.describe("rooms", () => {
  test.beforeAll(async () => {
    await admin.createFloor("lab", "Lab");
  });

  test("the map shows every room grey until one is pointed at, then travelling puts Ana in a roster of her own", async ({
    join,
  }) => {
    const ana = await join("Ana");
    const beto = await join("Beto");
    await expect(ana.people()).toContainText("Beto");

    await ana.tap("KeyR");
    const map = ana.page.getByRole("dialog", { name: "Map of rooms" });
    await expect(map).toBeVisible();
    await ana.waitUntilFree();
    await expect(ana.menu).toBeHidden();
    await expect(ana.clickPrompt).toBeHidden();

    const cards = map.locator("[data-room]");
    await expect(cards).toHaveCount(2);
    const floorOf = (room: string) =>
      map.locator(`[data-room="${room}"] svg rect`).first();
    const fill = (room: string) =>
      floorOf(room).evaluate((rect) => getComputedStyle(rect).fill);

    await expect.poll(() => fill("lab")).toBe(GREY_FLOOR);
    await expect.poll(() => fill("office")).toBe(GREY_FLOOR);
    await expect(map.locator('[data-room="office"]')).toHaveAccessibleName(
      "Main office, you are here",
    );

    await map.locator('[data-room="lab"]').hover();
    await expect.poll(() => fill("lab")).toBe(WARM_FLOOR);
    await expect(map.getByText("Lab", { exact: true })).toBeVisible();
    await expect.poll(() => fill("office")).toBe(GREY_FLOOR);

    await map.locator('[data-room="lab"]').click();
    await expect(ana.page.getByLabel("Current room")).toContainText("Lab");
    await ana.waitUntilLocked();
    await expect(ana.people()).toContainText("Ana (you)");
    await expect(ana.people()).not.toContainText("Beto");
    await expect(beto.people()).not.toContainText("Ana");
    await expect(beto.people()).toContainText("Beto (you)");
  });

  test("the Rooms list of the menu travels too, and the room one is in is disabled", async ({
    join,
  }) => {
    const ana = await join("Ana");
    const beto = await join("Beto");

    await beto.openMenu();
    await beto.menuItem("Rooms");
    await expect(
      beto.menu.getByRole("button", { name: /Main office/ }),
    ).toBeDisabled();
    await beto.menu.getByRole("button", { name: "Lab" }).click();
    await expect(beto.page.getByLabel("Current room")).toContainText("Lab");
    await beto.waitUntilLocked();
    await expect(beto.people()).not.toContainText("Ana");

    await ana.openMenu();
    await ana.menuItem("Rooms");
    await ana.menu.getByRole("button", { name: "Lab" }).click();
    await expect(ana.page.getByLabel("Current room")).toContainText("Lab");
    await ana.waitUntilLocked();
    await expect(ana.people()).toContainText("Beto");
    await expect(beto.people()).toContainText("Ana");
  });

  test.fixme("a room the person may not enter stays grey and says so", () => {
    // Needs sign-in (a member without an entry): the e2e stack has none, and faking it would test the fake.
  });
});
