import { test, expect } from "./fixtures";

test.describe("presence and emotes", () => {
  test("Ana's do not disturb shows in Beto's people list, and Z goes round the statuses", async ({
    join,
  }) => {
    const ana = await join("Ana");
    const beto = await join("Beto");
    const anaInBetosList = beto
      .people()
      .getByRole("listitem")
      .filter({ hasText: "Ana" });
    await expect(anaInBetosList).toBeVisible();
    await expect(anaInBetosList).not.toContainText("Do not disturb");

    await ana.openMenu();
    await ana.menuItem("Your status");
    await ana.menu.getByText("Do not disturb", { exact: true }).click();
    await expect(anaInBetosList).toContainText("Do not disturb");

    await expect(async () => {
      await ana.menu.getByText("Available", { exact: true }).click();
      await expect(anaInBetosList).not.toContainText("Do not disturb", {
        timeout: 1000,
      });
    }).toPass();
    await ana.menu.getByRole("button", { name: "Back" }).click();
    await ana.closeMenu();

    await expect(async () => {
      await ana.tap("KeyZ");
      await expect(ana.page.getByText("Status: In a meeting")).toBeVisible({
        timeout: 1000,
      });
    }).toPass();
    await expect(anaInBetosList).toContainText("In a meeting");
    await expect(
      ana.people().getByRole("listitem").filter({ hasText: "(you)" }),
    ).toContainText("In a meeting");
  });

  test("Ana's gesture floats its icon over her in Beto's view", async ({
    join,
  }) => {
    const ana = await join("Ana");
    const beto = await join("Beto");
    const spritesOnAna = async () =>
      (await beto.stats()).players.find((player) => player.name === "Ana")
        ?.sprites;
    await expect.poll(spritesOnAna).toBeDefined();
    const resting = await spritesOnAna();

    await ana.hold("KeyE");
    await ana.tap("Digit1");
    await ana.release("KeyE");

    await expect(ana.page.getByText("👋 Wave")).toBeVisible();
    await expect.poll(spritesOnAna).toBe(resting! + 1);
    await expect.poll(spritesOnAna, { timeout: 8000 }).toBe(resting);
  });
});
