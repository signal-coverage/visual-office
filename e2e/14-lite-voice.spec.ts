import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { PORTRAIT, dropVoiceMessages, installSpies } from "./support/phone";

const IDLE = "Join voice · asks for your microphone";

/** Opens the lite screen on a phone and goes into the office as somebody. */
async function joinLite(
  open: (
    path: string,
    options?: Parameters<typeof import("./support/office").openPage>[2],
  ) => Promise<Page>,
  name: string,
) {
  const page = await open("/?e2e&view=lite", {
    viewport: PORTRAIT,
    hasTouch: true,
    isMobile: true,
    init: [installSpies],
  });
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Join the office" }).tap();
  await expect(page.getByLabel("People here")).toContainText(`${name} (you)`);
  return page;
}

test.describe("lite mode: voice", () => {
  test("offers the microphone, asks for it only when pressed, and says so plainly when the call cannot be joined", async ({
    open,
  }) => {
    const page = await joinLite(open, "Carla");

    const voice = page.getByRole("button", { name: IDLE });
    await expect(voice).toBeVisible();
    await expect(
      page.getByText(/asked for only when you press Join voice/),
    ).toBeVisible();
    // Nothing asked for the microphone before the press
    expect(await page.evaluate(() => window.__mediaRequests)).toBe(0);

    // There is no voice server in this stack: the call fails, and the screen says it did
    await voice.tap();
    await expect(
      page.getByRole("button", { name: "Call failed · tap to retry" }),
    ).toBeVisible();
    await expect(
      page.getByText(/Could not join the voice call\./),
    ).toBeVisible();

    // And it can be tried again
    await page
      .getByRole("button", { name: "Call failed · tap to retry" })
      .tap();
    await expect(
      page.getByRole("button", { name: "Call failed · tap to retry" }),
    ).toBeVisible();
  });

  test("says voice is not available when the server has none to offer, instead of a dead button", async ({
    open,
  }) => {
    // The server of this stack does offer a call: its message with the credentials never arrives here
    const page = await open("/?e2e&view=lite", {
      viewport: PORTRAIT,
      hasTouch: true,
      isMobile: true,
      init: [dropVoiceMessages],
    });
    await page.getByLabel("Your name").fill("Carla");
    await page.getByRole("button", { name: "Join the office" }).tap();
    await expect(page.getByLabel("People here")).toContainText("Carla (you)");
    await expect(
      page.getByText(
        "Voice is not available on this server, so there is no call to join.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /voice/i })).toHaveCount(0);
  });

  test("the lite screen no longer lists speaking as missing, and still lists the camera", async ({
    open,
  }) => {
    const page = await open("/?e2e&view=lite", {
      viewport: PORTRAIT,
      hasTouch: true,
      isMobile: true,
    });
    await expect(page.getByText("What works here")).toBeVisible();
    await expect(
      page.getByText(/Voice, where the server has it: join the call and talk/),
    ).toBeVisible();
    await expect(page.getByText("Cameras and screen sharing.")).toBeVisible();
    await expect(page.getByText(/listen only|cannot speak/i)).toHaveCount(0);
  });
});
