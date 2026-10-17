import { test, expect } from "./fixtures";

const messageIn = (
  player: { page: import("@playwright/test").Page },
  text: string,
) => player.page.locator("[data-chat] li").filter({ hasText: text });

test.describe("chat and notifications", () => {
  test("a message to everyone reaches everyone", async ({ join }) => {
    const ana = await join("Ana");
    const beto = await join("Beto");
    const carla = await join("Carla");

    await ana.say("Good morning, team");

    for (const player of [ana, beto, carla])
      await expect(messageIn(player, "Good morning, team")).toContainText(
        "Ana",
      );
  });

  test("a direct message reaches only its target, who is told while the chat is closed", async ({
    join,
  }) => {
    const ana = await join("Ana");
    const beto = await join("Beto");
    const carla = await join("Carla");
    await expect(
      ana.page.getByRole("button", { name: "Chat (Enter)" }),
    ).toBeVisible();

    await ana.say("Only for Beto", "Beto");

    const toast = beto.page.getByText("Ana (direct): Only for Beto");
    await expect(toast).toBeVisible();
    await expect(
      beto.page
        .getByRole("button", { name: "Chat (Enter)" })
        .locator("..")
        .getByText("1", { exact: true }),
    ).toBeVisible();
    await expect(messageIn(ana, "Only for Beto")).toContainText("you → Beto");

    await beto.tap("Enter");
    await expect(messageIn(beto, "Only for Beto")).toContainText("Ana → you");
    await expect(
      beto.page.getByRole("textbox", { name: /press Enter/ }),
    ).toBeVisible();
    await beto.tap("Escape");

    await ana.say("Hello again, everyone");
    await expect(messageIn(carla, "Hello again, everyone")).toBeVisible();
    await expect(messageIn(carla, "Only for Beto")).toHaveCount(0);
  });
});
