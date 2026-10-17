import { test, expect } from "./fixtures";

const SETTINGS_KEY = "visual-office:settings";

test.describe("menu and mouse", () => {
  test("losing the mouse opens the menu, Esc closes it, and the click prompt shows until the mouse is given back", async ({
    join,
  }) => {
    const ana = await join("Ana");
    await expect(ana.menu).toBeHidden();

    await ana.loseMouse();
    await expect(ana.menu).toBeVisible();
    await expect(ana.clickPrompt).toBeHidden();

    await ana.refuseMouse(true);
    await ana.tap("Escape");
    await expect(ana.menu).toBeHidden();
    await expect(ana.clickPrompt).toBeVisible();
    expect(await ana.isLocked()).toBe(false);

    await ana.refuseMouse(false);
    await ana.page.mouse.click(550, 350);
    await ana.waitUntilLocked();
    await expect(ana.clickPrompt).toBeHidden();
  });

  test("the Menu button opens it too, and Back to the office closes it", async ({
    join,
  }) => {
    const ana = await join("Ana");
    await ana.menuButton.click();
    await expect(ana.menu).toBeVisible();
    await ana.closeMenu();
  });

  test("options are kept in the browser and survive a reload", async ({
    join,
  }) => {
    const ana = await join("Ana");
    await ana.openMenu();
    await ana.menuItem("Options");

    const slider = ana.menu.getByRole("slider", { name: "Mouse sensitivity" });
    await slider.focus();
    for (let step = 0; step < 5; step++) await ana.tap("ArrowRight");
    await ana.menu.getByText("High", { exact: true }).click();

    await expect
      .poll(async () =>
        ana.page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key) ?? "{}"),
          SETTINGS_KEY,
        ),
      )
      .toMatchObject({ mouseSensitivity: 1.5, quality: "high" });

    await ana.page.reload();
    await expect(ana.menuButton).toBeVisible();
    await ana.waitUntilLocked();
    await ana.openMenu();
    await ana.menuItem("Options");
    await expect(ana.menu.getByRole("radio", { name: "High" })).toBeChecked();
    await expect(
      ana.menu.getByRole("slider", { name: "Mouse sensitivity" }),
    ).toHaveValue("1.5");
  });

  test("a look picked in the menu can be saved only once it differs from the one worn", async ({
    join,
  }) => {
    const ana = await join("Ana");
    await ana.openMenu();
    await ana.menuItem("Your character");

    const save = ana.menu.getByRole("button", { name: "Save", exact: true });
    await expect(save).toBeDisabled();

    await ana.menu.getByRole("tab", { name: "Clothes" }).click();
    const shirts = ana.menu.getByRole("option", { name: /^Shirt \d+$/ });
    const worn = shirts.and(ana.page.locator("[aria-selected=true]"));
    const wornName = (await worn.getAttribute("aria-label")) ?? "";
    const other = wornName === "Shirt 1" ? "Shirt 2" : "Shirt 1";
    await ana.menu.getByRole("option", { name: other, exact: true }).click();

    await expect(save).toBeEnabled();
    await save.click();
    await expect(ana.menu).toContainText(
      "Saved. Everybody sees your new look.",
    );
    await expect(save).toBeDisabled();
  });
});
