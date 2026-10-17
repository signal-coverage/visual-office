import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { admin } from "./support/admin";
import { LANDSCAPE, PORTRAIT } from "./support/phone";

const OPTIONS = [
  "Enter the office",
  "Enter a different office",
  "Customize character",
  "Exit",
];

const phone = (viewport: { width: number; height: number }) => ({
  viewport,
  hasTouch: true,
  isMobile: true,
});

/** Whether the page body scrolls, and whether any two of the menu's pieces overlap. */
async function layoutOf(page: Page) {
  return page.evaluate((labels) => {
    const rect = (element: Element) => {
      const { left, top, right, bottom } = element.getBoundingClientRect();
      return { left, top, right, bottom };
    };
    const pieces = [
      rect(document.querySelector("h1")!),
      ...labels.map((label) =>
        rect(
          [...document.querySelectorAll("nav button")].find(
            (button) => button.textContent?.trim() === label,
          )!,
        ),
      ),
    ];
    const overlaps = pieces.some((a, i) =>
      pieces.some(
        (b, j) =>
          i < j &&
          a.left < b.right &&
          b.left < a.right &&
          a.top < b.bottom &&
          b.top < a.bottom,
      ),
    );
    const inside = pieces.every(
      (p) =>
        p.left >= 0 &&
        p.top >= 0 &&
        p.right <= window.innerWidth &&
        p.bottom <= window.innerHeight,
    );
    return {
      scrolls:
        document.documentElement.scrollHeight > window.innerHeight ||
        document.body.scrollHeight > window.innerHeight,
      overlaps,
      inside,
    };
  }, OPTIONS);
}

test.describe("the main menu", () => {
  test.beforeAll(async () => {
    await admin.createFloor("menu-lab", "Menu Lab");
  });

  test("shows the title, the four options and the turning character, with no pickers", async ({
    open,
  }) => {
    const page = await open("/?e2e");
    await expect(
      page.getByRole("heading", { level: 1, name: "Visual Office" }),
    ).toBeVisible();
    const menu = page.getByRole("navigation", { name: "Main menu" });
    for (const label of OPTIONS)
      await expect(menu.getByRole("button", { name: label })).toBeVisible();

    const preview = page.getByRole("img", { name: "Your character" });
    await expect(preview.locator("canvas")).toBeVisible();
    await expect(page.getByRole("tablist")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Surprise me" })).toHaveCount(
      0,
    );
    await expect(page.getByLabel("Your name")).toHaveCount(0);

    const before = await preview.screenshot();
    await expect
      .poll(async () => (await preview.screenshot()).equals(before))
      .toBe(false);
  });

  test("is reached with the keyboard: the first option has the focus, the arrows move it and Enter presses", async ({
    open,
  }) => {
    const page = await open("/?e2e");
    const menu = page.getByRole("navigation", { name: "Main menu" });
    await expect(
      menu.getByRole("button", { name: "Enter the office" }),
    ).toBeFocused();
    await expect(
      menu.getByRole("button", { name: "Enter a different office" }),
    ).toBeEnabled();
    await page.keyboard.press("ArrowDown");
    await expect(
      menu.getByRole("button", { name: "Enter a different office" }),
    ).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(
      menu.getByRole("button", { name: "Customize character" }),
    ).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: "Customize character" }),
    ).toBeVisible();
  });

  test("Customize character opens the pickers, saves the look as it is chosen, and Back (or Esc) returns", async ({
    open,
  }) => {
    const page = await open("/?e2e");
    await page.getByRole("button", { name: "Customize character" }).click();

    const tabs = page.getByRole("tablist", { name: "Character options" });
    for (const tab of ["Body", "Hair", "Face", "Clothes", "Extras"])
      await expect(tabs.getByRole("tab", { name: tab })).toBeVisible();
    await expect(page.getByLabel("Your name")).toBeVisible();

    await tabs.getByRole("tab", { name: "Clothes" }).click();
    // The first look is random: pick a shirt that is not already the one worn
    const seventh = page.getByRole("option", { name: "Shirt 7", exact: true });
    const worn = (await seventh.getAttribute("aria-selected")) === "true";
    const shirtNumber = worn ? 8 : 7;
    const shirt = page.getByRole("option", {
      name: `Shirt ${shirtNumber}`,
      exact: true,
    });
    await shirt.click();
    await expect(shirt).toHaveAttribute("aria-selected", "true");
    await page.getByLabel("Your name").fill("Ana");

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("visual-office:appearance") ?? "{}"),
    );
    expect(stored.shirt).toBe(shirtNumber - 1);

    await page.getByRole("button", { name: "Back" }).click();
    await expect(
      page.getByRole("navigation", { name: "Main menu" }),
    ).toBeVisible();
    await expect(page.getByText("Ana", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Customize character" }).click();
    await expect(page.getByLabel("Your name")).toHaveValue("Ana");
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("navigation", { name: "Main menu" }),
    ).toBeVisible();
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

  test("Enter the office joins with the saved name and look", async ({
    open,
  }) => {
    const page = await open("/?e2e");
    await page.getByRole("button", { name: "Customize character" }).click();
    await page.getByLabel("Your name").fill("Beto");
    await page.getByRole("button", { name: "Back" }).click();
    await page.getByRole("button", { name: "Enter the office" }).click();
    await expect(
      page.getByRole("button", { name: "Menu (Esc)" }),
    ).toBeVisible();
    await expect(page.getByLabel("People here")).toContainText("Beto (you)");
  });

  test("Enter a different office shows the map, and joining the second room puts the player in a roster of its own", async ({
    open,
    join,
  }) => {
    const zed = await join("Zed");
    await expect(zed.people()).toContainText("Zed (you)");

    const page = await open("/?e2e");
    await page.getByRole("button", { name: "Customize character" }).click();
    await page.getByLabel("Your name").fill("Cris");
    await page.getByRole("button", { name: "Back" }).click();

    await page
      .getByRole("button", { name: "Enter a different office" })
      .click();
    const map = page.getByRole("dialog", { name: "Map of rooms" });
    await expect(map).toBeVisible();
    await expect(map.locator('[data-room="office"]')).toBeVisible();
    await expect(map.locator('[data-room="menu-lab"]')).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(map).toBeHidden();
    await expect(
      page.getByRole("navigation", { name: "Main menu" }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: "Enter a different office" })
      .click();
    await map.locator('[data-room="menu-lab"]').click();
    await expect(page.getByLabel("Current room")).toContainText("Menu Lab");
    await expect(page.getByLabel("People here")).toContainText("Cris (you)");
    await expect(page.getByLabel("People here")).not.toContainText("Zed");
    await expect(zed.people()).not.toContainText("Cris");
  });

  test("with a single office the other-offices option is disabled and says why", async ({
    open,
  }) => {
    const page = await open("/?e2e");
    await page.route("**/account/floors", (route) =>
      route.fulfill({
        json: {
          floors: [
            {
              id: "office",
              name: "Main office",
              common: true,
              canEnter: true,
            },
          ],
        },
      }),
    );
    await page.reload();
    const other = page.getByRole("button", {
      name: "Enter a different office",
    });
    await expect(other).toBeDisabled();
    await expect(page.getByText("There is only one office")).toBeVisible();
    await expect(other).toHaveAccessibleDescription("There is only one office");
  });

  test("Exit without sign-in says goodbye, and Back to the menu returns", async ({
    open,
  }) => {
    const page = await open("/?e2e");
    await page.getByRole("button", { name: "Exit" }).click();
    await expect(
      page.getByRole("heading", { name: "See you soon" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Back to the menu" }).click();
    await expect(
      page.getByRole("navigation", { name: "Main menu" }),
    ).toBeVisible();
  });

  test("a link with ?name= still skips the menu", async ({ join }) => {
    const ana = await join("Ana");
    await expect(ana.people()).toContainText("Ana (you)");
  });

  for (const [label, size] of [
    ["portrait", PORTRAIT],
    ["landscape", LANDSCAPE],
  ] as const) {
    test(`a phone in ${label} shows all four options without scrolling or overlap, in buttons at least 48 px tall`, async ({
      open,
    }) => {
      const page = await open("/?e2e", phone(size));
      const menu = page.getByRole("navigation", { name: "Main menu" });
      await expect(menu).toBeVisible();
      await expect(
        page.getByRole("img", { name: "Your character" }),
      ).toBeVisible();
      for (const option of OPTIONS) {
        const box = (await menu
          .getByRole("button", { name: option })
          .boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(47.5);
      }
      expect(await layoutOf(page)).toEqual({
        scrolls: false,
        overlaps: false,
        inside: true,
      });
    });
  }
});
