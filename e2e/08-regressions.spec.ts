import { test, expect } from "./fixtures";
import { interactable, lookAt, routeTo } from "./support/geometry";

test.describe("regressions", () => {
  test("clicking the scene while walking forward and right keeps moving along both axes", async ({
    join,
  }) => {
    const ana = await join("Ana");
    await ana.teleport(-8, 9, 0);

    await ana.hold("KeyW", "KeyD");
    const start = await ana.position();
    await expect
      .poll(async () => (await ana.position()).x - start.x)
      .toBeGreaterThan(0.3);

    await ana.page.evaluate(() =>
      document
        .querySelector("canvas")!
        .dispatchEvent(new MouseEvent("click", { bubbles: true })),
    );
    const clicked = await ana.position();

    await expect
      .poll(
        async () => {
          const now = await ana.position();
          return {
            right: now.x - clicked.x > 0.4,
            forward: clicked.z - now.z > 0.4,
          };
        },
        { timeout: 4000 },
      )
      .toEqual({ right: true, forward: true });
    await ana.release("KeyW", "KeyD");
  });

  test("Esc while a plant panel is open puts the panel away instead of opening the menu", async ({
    join,
  }) => {
    const ana = await join("Ana");
    await ana.walk(
      routeTo(lookAt(-5.5, 1.5, interactable("plant:39")), "open"),
    );
    await ana.tap("KeyF");
    const panel = ana.page
      .getByRole("dialog")
      .filter({ hasText: "Press F or Esc to close" });
    await expect(panel).toBeVisible();

    await ana.loseMouse();
    await expect(panel).toBeHidden();
    await expect(ana.menu).toBeHidden();

    await ana.waitUntilFree();
    await ana.page.mouse.click(400, 280);
    await ana.waitUntilLocked();
    await ana.loseMouse();
    await expect(ana.menu).toBeVisible();
  });

  test("Esc while a computer panel is open closes it, takes the mouse back and does not open the menu", async ({
    join,
  }) => {
    const ana = await join("Ana");
    await ana.walk(routeTo(lookAt(0, 3.9, interactable("desk:20")), "aisle"));
    await ana.tap("KeyF");
    const panel = ana.page.getByRole("dialog", { name: "Computer" });
    await expect(panel).toBeVisible();
    await ana.waitUntilFree();
    await expect(ana.menu).toBeHidden();

    await ana.tap("Escape");
    await expect(panel).toBeHidden();
    await ana.waitUntilLocked();
    await expect(ana.menu).toBeHidden();
  });

  test("the lite screen on a touch phone (asked for in the address), with the chat and the people list", async ({
    join,
    open,
  }) => {
    const ana = await join("Ana");
    const lite = await open("/?e2e&view=lite", {
      viewport: { width: 600, height: 800 },
      hasTouch: true,
      isMobile: true,
    });
    await expect(
      lite.getByRole("heading", { name: "Lite mode" }),
    ).toBeVisible();
    await expect(lite.getByText("You asked for the lite view.")).toBeVisible();

    await lite.getByLabel("Your name").fill("Carla");
    await lite.getByRole("button", { name: "Join the office" }).click();
    const people = lite.getByLabel("People here");
    await expect(people).toContainText("Carla (you)");
    await expect(people).toContainText("Ana");
    await expect(ana.people()).toContainText("Carla");

    await ana.say("Welcome, Carla");
    await expect(
      lite.locator("[data-chat] li").filter({ hasText: "Welcome, Carla" }),
    ).toBeVisible();

    await lite.getByRole("button", { name: "Chat (Enter)" }).click();
    await lite
      .getByRole("textbox", { name: /press Enter/ })
      .fill("Thanks, Ana");
    await lite.keyboard.press("Enter");
    await expect(
      ana.page.locator("[data-chat] li").filter({ hasText: "Thanks, Ana" }),
    ).toContainText("Carla");
  });
});
