import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { admin } from "./support/admin";

/** Where a point of the floor (meters, from the middle) is on the editor's canvas: 32 px a meter and a 40 px margin. */
async function pointOnPlan(page: Page, width: number, depth: number) {
  const box = await page
    .getByLabel("Plan of the office seen from above")
    .boundingBox();
  if (!box) throw new Error("The plan is not on the page");
  return (x: number, z: number) => ({
    x: box.x + 40 + (x + width / 2) * 32,
    y: box.y + 40 + (z + depth / 2) * 32,
  });
}

async function drag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
}

test.describe("the structure editor (development page)", () => {
  test.beforeAll(async () => {
    await admin.createFloor("drawn", "Drawn by hand", "open");
    await admin.createFloor("shrunk", "Shrunk", "meeting");
  });

  test("draws a wall and a private room, publishes them, and the room is there for the next player", async ({
    open,
    join,
  }) => {
    const editor = await open("/editor.html?floor=drawn", {
      viewport: { width: 1500, height: 900 },
    });
    editor.on("dialog", (dialog) => void dialog.accept());

    await editor.getByRole("button", { name: "Start editing" }).click();
    await expect(
      editor.getByRole("button", { name: "Finish editing" }),
    ).toBeVisible();
    await editor.getByRole("radio", { name: "Structure" }).click();
    const at = await pointOnPlan(editor, 24, 16);

    // A thin wall, from the empty east side of the desks
    await editor.getByRole("button", { name: "Wall", exact: true }).click();
    await drag(editor, at(8.5, -4), at(8.5, 0));
    await expect(editor.getByText("Wall 1")).toBeVisible();

    // A private room next to it, named in the dialog
    await editor.getByRole("button", { name: "Private room" }).click();
    await drag(editor, at(9, -3.5), at(11.5, -0.5));
    const dialog = editor.getByRole("dialog", {
      name: "Name the private room",
    });
    await dialog.getByRole("textbox", { name: "Name" }).fill("Quiet");
    await dialog.getByRole("button", { name: "Make the room" }).click();
    await expect(editor.getByText("Private zone: Quiet")).toBeVisible();

    await editor.locator("button", { hasText: /^Publish$/ }).click();
    await expect(
      editor.getByRole("status").filter({ hasText: "Published as version" }),
    ).toBeVisible();
    await editor.getByRole("button", { name: "Finish editing" }).click();

    // The next player to join finds the new private room
    const ana = await join("Ana", { query: "floor=drawn" });
    await ana.teleport(10.3, 6.2, 0);
    await ana.teleport(10.3, 1, 0);
    await ana.teleport(10.3, -2, 0);
    await expect(
      ana.page.getByRole("status").filter({ hasText: "Private zone: Quiet" }),
    ).toBeVisible();
  });

  test("does not publish while the structure has an error", async ({
    open,
  }) => {
    const editor = await open("/editor.html?floor=shrunk", {
      viewport: { width: 1500, height: 900 },
    });
    editor.on("dialog", (dialog) => void dialog.accept());
    await editor.getByRole("button", { name: "Start editing" }).click();
    await editor.getByRole("radio", { name: "Structure" }).click();
    // The floor gets smaller than its meeting rooms
    await editor.getByRole("textbox", { name: "Width (m)" }).first().fill("16");
    await editor
      .getByRole("textbox", { name: "Width (m)" })
      .first()
      .press("Enter");
    await expect(
      editor.getByText(/sticks? out past the floor/).first(),
    ).toBeVisible();
    await expect(
      editor.locator("button", { hasText: /^Publish$/ }),
    ).toBeDisabled();
    await editor.getByRole("button", { name: "Finish editing" }).click();
  });
});
