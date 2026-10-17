import { test, expect } from "./fixtures";
import { admin } from "./support/admin";
import { PLANT_INFO } from "../shared/interactions.ts";
import { interactable, lookAt, routeTo } from "./support/geometry";

const CHAIR = interactable("chair:21");
const PLANT = interactable("plant:39");
const DESK = interactable("desk:20");
const SHELF = interactable("bookshelf.glb:0");

test.describe("interactions", () => {
  test("a chair: Click or F sits down, the others see it, nobody else can take the seat, Space stands up", async ({
    join,
  }) => {
    const ana = await join("Ana");
    const beto = await join("Beto");
    const behindChair = lookAt(0, 7.1, CHAIR);

    await ana.walk(routeTo(behindChair, "south"));
    await expect(ana.hint).toHaveText("Click or F · Sit down");
    await ana.tap("KeyF");

    await expect.poll(async () => (await ana.stats()).seated).toBe(true);
    await expect(ana.hint).toHaveText("F or Space · Stand up");
    await expect
      .poll(
        async () =>
          (await beto.stats()).players.find((p) => p.name === "Ana")?.seat,
      )
      .toBe(CHAIR.id);

    await beto.walk(routeTo(behindChair, "south"));
    await expect(beto.hint).toHaveText("Click or F · Sit down");
    await beto.tap("KeyF");
    await expect(
      beto.page.getByText("Somebody is already sitting there."),
    ).toBeVisible();
    expect((await beto.stats()).seated).toBe(false);

    await ana.tap("Space");
    await expect.poll(async () => (await ana.stats()).seated).toBe(false);
    await expect
      .poll(
        async () =>
          (await beto.stats()).players.find((p) => p.name === "Ana")?.seat,
      )
      .toBeNull();
  });

  test("a plant: the panel tells what it is", async ({ join }) => {
    const ana = await join("Ana");
    const spot = lookAt(-5.5, 1.5, PLANT);
    await ana.walk(routeTo(spot, "open"));
    await expect(ana.hint).toHaveText("Click or F · Look at the plant");
    await ana.tap("KeyF");
    const plant = PLANT_INFO[PLANT.variant ?? 0];
    const panel = ana.page.getByRole("dialog", { name: plant.name });
    await expect(panel).toContainText(plant.text);
  });

  test("a computer shows the announcements of the floor, and its panel keeps still while they load", async ({
    join,
  }) => {
    const pinned = await admin.createContent({
      floor: "office",
      kind: "announcement",
      title: "Fire drill on Friday",
      body: "Meet at the car park at 10:00.",
      pinned: true,
    });
    try {
      const ana = await join("Ana");
      await ana.page.route("**/account/floors/*/content", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await route.continue();
      });
      const spot = lookAt(0, 3.9, DESK);
      await ana.walk(routeTo(spot, "aisle"));
      await expect(ana.hint).toHaveText("Click or F · Use the computer");
      await ana.tap("KeyF");

      const panel = ana.page.getByRole("dialog", { name: "Computer" });
      await expect(panel.getByText("Loading…")).toBeVisible();
      const scrollable = await panel.evaluate(async (dialog) => {
        const area = dialog.querySelector<HTMLElement>(".overflow-y-auto")!;
        const seen = new Set<boolean>();
        const until = performance.now() + 1200;
        while (performance.now() < until) {
          seen.add(area.scrollHeight > area.clientHeight);
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
        return [...seen];
      });
      expect(scrollable).toHaveLength(1);

      await expect(panel).toContainText("Fire drill on Friday");
      await expect(panel).toContainText("Meet at the car park at 10:00.");
      await expect(panel).toContainText("Pinned");
    } finally {
      await admin.deleteContent(pinned);
    }
  });

  test("a bookshelf lists the books and lets you read one", async ({
    join,
  }) => {
    const book = await admin.createContent({
      floor: "office",
      kind: "book",
      title: "The Office Handbook",
      author: "People Team",
      body: "Chapter one.\nBe kind.",
    });
    try {
      const ana = await join("Ana");
      const spot = lookAt(0, -8.3, SHELF);
      await ana.walk(routeTo(spot, "aisle"));
      await expect(ana.hint).toHaveText("Click or F · Read a book");
      await ana.tap("KeyF");

      const shelf = ana.page.getByRole("dialog", { name: "Bookshelf" });
      await shelf.getByRole("button", { name: /The Office Handbook/ }).click();
      await expect(shelf).toContainText("by People Team");
      await expect(shelf).toContainText("Be kind.");
      await shelf.getByRole("button", { name: "Back" }).click();
      await expect(shelf).toContainText("Choose a book to read");
    } finally {
      await admin.deleteContent(book);
    }
  });
});
