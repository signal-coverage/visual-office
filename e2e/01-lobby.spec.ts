import { test, expect } from "./fixtures";

test.describe("lobby", () => {
  test("shows the name field and the five tabs of the character, and a shirt picked there is the look worn in the office", async ({
    open,
  }) => {
    const page = await open("/?e2e");
    await expect(page.getByRole("heading", { name: "Lobby" })).toBeVisible();
    await expect(page.getByLabel("Your name")).toBeVisible();

    const tabs = page.getByRole("tablist", { name: "Character options" });
    for (const tab of ["Body", "Hair", "Face", "Clothes", "Extras"])
      await expect(tabs.getByRole("tab", { name: tab })).toBeVisible();

    await tabs.getByRole("tab", { name: "Clothes" }).click();
    const shirt = page.getByRole("option", { name: "Shirt 7", exact: true });
    await shirt.click();
    await expect(shirt).toHaveAttribute("aria-selected", "true");

    await page.getByLabel("Your name").fill("Ana");
    await page.getByRole("button", { name: "Enter office" }).click();
    await expect(
      page.getByRole("button", { name: "Menu (Esc)" }),
    ).toBeVisible();

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("visual-office:appearance") ?? "{}"),
    );
    expect(stored.shirt).toBe(6);
  });

  test("dragging the preview turns the character by hand", async ({ open }) => {
    const page = await open("/?e2e");
    const preview = page.getByRole("img", { name: "Your character" });
    await expect(preview.locator("canvas")).toBeVisible();
    const box = (await preview.boundingBox())!;
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

    await page.mouse.move(centre.x, centre.y);
    await page.mouse.down();
    const held = await preview.screenshot();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    expect((await preview.screenshot()).equals(held)).toBe(true);
    await page.mouse.move(centre.x + 70, centre.y, { steps: 8 });
    const dragged = await preview.screenshot();
    await page.mouse.up();

    expect(dragged.equals(held)).toBe(false);
  });

  test("enters the office with the typed name", async ({ open }) => {
    const page = await open("/?e2e");
    await page.getByLabel("Your name").fill("Beto");
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("button", { name: "Menu (Esc)" }),
    ).toBeVisible();
    await expect(page.getByLabel("People here")).toContainText("Beto (you)");
  });
});
