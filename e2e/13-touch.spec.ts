import { test, expect } from "./fixtures";
import { AISLE_X, interactable, lookAt, routeTo } from "./support/geometry";
import { LANDSCAPE, PORTRAIT, installSpies } from "./support/phone";

const CHAIR = interactable("chair:21");

/** How far (px) the thumb goes from the middle of the joystick to run: the edge of its base and beyond. */
const FULL_PUSH = 80;
const HALF_PUSH = 28;

test.describe("a phone: the 3D office with touch controls", () => {
  test("loads the 3D office, not the lite screen, and asks for neither the mouse nor a click", async ({
    joinPhone,
  }) => {
    const ana = await joinPhone("Ana", { keepHint: true });
    await expect(
      ana.page.getByRole("heading", { name: "Lite mode" }),
    ).toHaveCount(0);
    await expect(ana.page.locator("canvas")).toBeVisible();
    await expect(ana.stick).toBeVisible();
    // The buttons of a keyboard and a mouse are not there, and the keys are not reminded
    await expect(ana.button("Menu (Esc)")).toHaveCount(0);
    await expect(ana.button("Menu")).toBeVisible();
    await expect(ana.page.getByText("WASD")).toHaveCount(0);

    await ana.page.waitForTimeout(800);
    await expect(ana.clickPrompt).toHaveCount(0);
    expect(await ana.page.evaluate(() => window.__lockRequests)).toBe(0);
  });

  test("starts with a hint that is gone for good once dismissed", async ({
    joinPhone,
  }) => {
    const ana = await joinPhone("Ana", { keepHint: true });
    const hint = ana.page.getByRole("dialog", { name: "How to move" });
    await expect(hint).toContainText(
      "Left thumb moves, right thumb looks, tap objects to use them.",
    );
    await ana.button("Got it").click();
    await expect(hint).toBeHidden();

    await ana.page.reload();
    await expect(ana.stick).toBeVisible();
    await expect(hint).toHaveCount(0);
  });

  test("the joystick walks the avatar while a finger is on it, and stops when it lifts", async ({
    joinPhone,
  }) => {
    const ana = await joinPhone("Ana");
    await ana.teleport(AISLE_X, 8, 0);
    const start = await ana.position();

    await ana.pushStick(0, -HALF_PUSH);
    await expect
      .poll(async () => start.z - (await ana.position()).z, { timeout: 8000 })
      .toBeGreaterThan(1);
    await ana.releaseStick();

    const stopped = await ana.position();
    await ana.page.waitForTimeout(600);
    const later = await ana.position();
    expect(later.z).toBeCloseTo(stopped.z, 1);
    expect(later.x).toBeCloseTo(start.x, 1);
  });

  test("a push to the edge runs, faster than a gentle one walks", async ({
    joinPhone,
  }) => {
    const ana = await joinPhone("Ana");
    const rate = async (push: number) => {
      await ana.teleport(AISLE_X, 8, 0);
      const before = await ana.position();
      await ana.pushStick(0, -push);
      await ana.page.waitForTimeout(1200);
      const after = await ana.position();
      await ana.releaseStick();
      return before.z - after.z;
    };
    const walked = await rate(HALF_PUSH);
    const ran = await rate(FULL_PUSH);
    expect(walked).toBeGreaterThan(0.5);
    expect(ran).toBeGreaterThan(walked * 1.4);
  });

  test("the right thumb turns the view: right turns right, up looks up, and nothing goes past straight up", async ({
    joinPhone,
  }) => {
    const ana = await joinPhone("Ana");
    await ana.teleport(AISLE_X, 8, 0);
    const middle = {
      x: PORTRAIT.width / 2,
      y: PORTRAIT.height / 2,
    };

    await ana.dragLook(middle, { x: middle.x + 100, y: middle.y });
    const right = await ana.position();
    expect(right.yaw).toBeLessThan(-0.3);
    expect(right.pitch).toBeCloseTo(0, 1);

    await ana.dragLook(middle, { x: middle.x, y: middle.y - 120 });
    const up = await ana.position();
    expect(up.pitch).toBeGreaterThan(0.3);

    for (let i = 0; i < 6; i++)
      await ana.dragLook(
        { x: middle.x, y: PORTRAIT.height - 60 },
        { x: middle.x, y: 80 },
      );
    const straightUp = await ana.position();
    expect(straightUp.pitch).toBeLessThan(Math.PI / 2);
    expect(straightUp.pitch).toBeGreaterThan(1.4);
  });

  test("walks and looks at the same time with two thumbs", async ({
    joinPhone,
  }) => {
    const ana = await joinPhone("Ana");
    await ana.teleport(AISLE_X, 8, 0);
    const start = await ana.position();

    await ana.pushStick(0, -HALF_PUSH);
    const from = { x: PORTRAIT.width / 2, y: PORTRAIT.height / 2 };
    await ana.fingers.press(2, from.x, from.y);
    await ana.fingers.slide(2, from.x + 60, from.y);
    await ana.fingers.slide(2, from.x + 120, from.y);

    await expect
      .poll(async () => {
        const pose = await ana.position();
        return {
          turned: pose.yaw < -0.3,
          walked: start.z - pose.z > 0.5,
        };
      })
      .toEqual({ turned: true, walked: true });
    await ana.fingers.lift(2);
    await ana.releaseStick();
  });

  test("tapping a chair or pressing the Use button sits down, and the button gets up again", async ({
    joinPhone,
  }) => {
    const ana = await joinPhone("Ana");
    await ana.walk(routeTo(lookAt(0, 7.1, CHAIR), "south"));

    const use = ana.button("Sit down");
    await expect(use).toBeVisible();
    await use.tap();
    await expect.poll(async () => (await ana.stats()).seated).toBe(true);
    const stand = ana.button("Stand up");
    await expect(stand).toBeVisible();

    await stand.tap();
    await expect.poll(async () => (await ana.stats()).seated).toBe(false);
    await expect(ana.button("Stand up")).toHaveCount(0);
  });

  test("tapping the chair itself sits down, and pushing the joystick gets up", async ({
    joinPhone,
  }) => {
    const ana = await joinPhone("Ana");
    await ana.walk(routeTo(lookAt(0, 7.1, CHAIR), "south"));
    await expect(ana.button("Sit down")).toBeVisible();

    // The middle of the screen is where the chair is: the camera looks straight at it
    await ana.page.touchscreen.tap(PORTRAIT.width / 2, PORTRAIT.height / 2);
    await expect.poll(async () => (await ana.stats()).seated).toBe(true);

    await ana.pushStick(0, -FULL_PUSH);
    await expect.poll(async () => (await ana.stats()).seated).toBe(false);
    await ana.releaseStick();
  });

  test("the menu and the chat open from their buttons, and the avatar stays put while they cover the scene", async ({
    joinPhone,
  }) => {
    const ana = await joinPhone("Ana");
    const beto = await joinPhone("Beto");
    await ana.teleport(AISLE_X, 8, 0);

    await ana.button("Menu").tap();
    await expect(ana.menu).toBeVisible();
    await expect(ana.stick).toHaveCount(0);
    await expect(ana.clickPrompt).toHaveCount(0);
    const before = await ana.position();
    await ana.page.waitForTimeout(400);
    expect(await ana.position()).toEqual(before);
    await ana.menu.getByRole("button", { name: "Back to the office" }).tap();
    await expect(ana.menu).toBeHidden();
    await expect(ana.stick).toBeVisible();
    await expect(ana.clickPrompt).toHaveCount(0);

    await ana.button("Chat").tap();
    const input = ana.page.getByRole("textbox", { name: "Message everyone" });
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
    await expect(ana.stick).toHaveCount(0);
    await input.fill("Hello from a phone");
    await ana.button("Send").tap();
    await expect(input).toBeHidden();
    await expect(ana.stick).toBeVisible();

    await expect(
      beto.page.locator("[data-chat] li").filter({
        hasText: "Hello from a phone",
      }),
    ).toContainText("Ana");
  });

  test("the chat sends with the Enter key of the virtual keyboard too, and closes with its button", async ({
    joinPhone,
  }) => {
    const ana = await joinPhone("Ana");
    const beto = await joinPhone("Beto");

    await ana.button("Chat").tap();
    const input = ana.page.getByRole("textbox", { name: "Message everyone" });
    await input.fill("Sent with Enter");
    await ana.page.keyboard.press("Enter");
    await expect(
      beto.page
        .locator("[data-chat] li")
        .filter({ hasText: "Sent with Enter" }),
    ).toBeVisible();

    await ana.button("Chat").tap();
    await expect(input).toBeVisible();
    await ana.button("Close the chat").tap();
    await expect(input).toBeHidden();
  });

  test("the people list is a button away, and the emote and knock buttons answer", async ({
    joinPhone,
  }) => {
    const ana = await joinPhone("Ana");
    const beto = await joinPhone("Beto");

    const people = ana.page.getByLabel("People here");
    await expect(people).toHaveCount(0);
    await ana.button("People list").tap();
    await expect(people).toContainText("Beto");
    await ana.button("People list").tap();
    await expect(people).toHaveCount(0);

    await ana.button("Emotes").tap();
    await ana.button("Wave").tap();
    await expect(ana.page.getByText(/Wave$/)).toBeVisible();
    await expect
      .poll(
        async () =>
          (await beto.stats()).players.find((p) => p.name === "Ana")?.sprites,
      )
      .toBe(2);

    await ana.button("Knock").tap();
    await expect(ana.page.getByText(/Nobody to knock on/)).toBeVisible();
  });

  test("the page neither scrolls sideways nor zooms, and a drag on the scene does not scroll the page", async ({
    joinPhone,
  }) => {
    const ana = await joinPhone("Ana");
    const sizes = await ana.page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
      scale: window.visualViewport?.scale,
    }));
    expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.innerWidth);
    expect(sizes.scrollHeight).toBeLessThanOrEqual(sizes.innerHeight);
    expect(sizes.scale).toBe(1);

    await ana.dragLook({ x: 200, y: 600 }, { x: 200, y: 200 });
    expect(await ana.page.evaluate(() => window.scrollY)).toBe(0);

    for (const surface of ["touch-look", "touch-stick"]) {
      const touchAction = await ana.page
        .getByTestId(surface)
        .evaluate((element) => getComputedStyle(element).touchAction);
      expect(touchAction).toBe("none");
    }
  });

  test("starts in Low quality, which Auto keeps on a phone", async ({
    joinPhone,
  }) => {
    const ana = await joinPhone("Ana", { query: "debug" });
    await expect(ana.page.getByText(/Auto \(Low\)/)).toBeVisible();
  });

  test("the lite view is one tap away in the menu, and the full office again from the lite screen", async ({
    joinPhone,
  }) => {
    const ana = await joinPhone("Ana");
    await ana.button("Menu").tap();
    await ana.menu.getByRole("button", { name: "Lite view (no 3D)" }).tap();
    await expect(
      ana.page.getByRole("heading", { name: "Lite mode" }),
    ).toBeVisible();
    await expect(
      ana.page.getByText("You asked for the lite view."),
    ).toBeVisible();

    await ana.page
      .getByRole("button", { name: "Try the 3D office anyway" })
      .tap();
    await expect(ana.stick).toBeVisible();
  });
});

for (const [name, viewport] of [
  ["portrait", PORTRAIT],
  ["landscape", LANDSCAPE],
] as const)
  test.describe(`a phone in ${name}`, () => {
    test("every control fits on the screen, is at least 44 px and none sits on another", async ({
      joinPhone,
    }) => {
      const ana = await joinPhone("Ana", { viewport });
      // Everything there is to press, with the hint away: the buttons, the joystick, and the badges
      await ana.page.getByRole("button", { name: "Sit down" }).count();
      const boxes: Array<{
        name: string;
        x: number;
        y: number;
        w: number;
        h: number;
      }> = [];
      const named = [
        ["menu", ana.button("Menu")],
        ["chat", ana.button("Chat")],
        [
          "voice",
          ana.page.getByRole("button", { name: /voice|Microphone|Muted/i }),
        ],
        ["camera", ana.button("Camera")],
        ["people", ana.button("People list")],
        ["emotes", ana.button("Emotes")],
        ["knock", ana.button("Knock")],
        ["stick", ana.stick],
        ["you", ana.page.locator("div").filter({ hasText: /^Ana$/ }).first()],
      ] as const;
      for (const [label, locator] of named) {
        await expect(locator, label).toBeVisible();
        const box = (await locator.boundingBox())!;
        boxes.push({
          name: label,
          x: box.x,
          y: box.y,
          w: box.width,
          h: box.height,
        });
      }

      for (const box of boxes) {
        expect(box.x, `${box.name} left`).toBeGreaterThanOrEqual(0);
        expect(box.y, `${box.name} top`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.w, `${box.name} right`).toBeLessThanOrEqual(
          viewport.width,
        );
        expect(box.y + box.h, `${box.name} bottom`).toBeLessThanOrEqual(
          viewport.height,
        );
        if (box.name !== "you" && box.name !== "stick") {
          expect(box.w, `${box.name} width`).toBeGreaterThanOrEqual(44);
          expect(box.h, `${box.name} height`).toBeGreaterThanOrEqual(44);
        }
      }
      for (const [i, a] of boxes.entries())
        for (const b of boxes.slice(i + 1)) {
          const apart =
            a.x + a.w <= b.x ||
            b.x + b.w <= a.x ||
            a.y + a.h <= b.y ||
            b.y + b.h <= a.y;
          expect(apart, `${a.name} and ${b.name} overlap`).toBe(true);
        }

      const { scrollWidth, innerWidth } = await ana.page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
    });

    test("turning the phone keeps the view whole: the canvas follows the window", async ({
      joinPhone,
    }) => {
      const ana = await joinPhone("Ana", { viewport });
      const other = viewport.width < viewport.height ? LANDSCAPE : PORTRAIT;
      await ana.page.setViewportSize(other);
      await expect
        .poll(() =>
          ana.page.evaluate(() => {
            const canvas = document.querySelector("canvas")!;
            return [canvas.clientWidth, canvas.clientHeight];
          }),
        )
        .toEqual([other.width, other.height]);
      await expect(ana.stick).toBeVisible();
      const box = (await ana.stick.boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(other.height);
    });
  });

test.describe("the same address on a computer", () => {
  test("keeps the keyboard and the mouse: no touch controls, and the mouse is asked for", async ({
    join,
  }) => {
    const ana = await join("Ana");
    await expect(ana.page.getByTestId("touch-stick")).toHaveCount(0);
    await expect(ana.menuButton).toBeVisible();
  });

  test("?controls=touch asks for the touch controls on a computer", async ({
    open,
  }) => {
    const page = await open("/?name=Ana&e2e&controls=touch", {
      init: [installSpies],
    });
    await expect(page.getByTestId("touch-stick")).toBeVisible();
    expect(await page.evaluate(() => window.__lockRequests)).toBe(0);
  });
});

test.describe("a phone that cannot draw 3D", () => {
  test("gets the lite screen, which says why, and no way into the office", async ({
    open,
  }) => {
    const page = await open("/?e2e", {
      viewport: PORTRAIT,
      hasTouch: true,
      isMobile: true,
      init: [
        () => {
          const getContext = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function (
            this: HTMLCanvasElement,
            type: string,
            ...rest: unknown[]
          ) {
            if (type.startsWith("webgl") || type === "experimental-webgl")
              return null;
            return (
              getContext as (
                this: HTMLCanvasElement,
                ...args: unknown[]
              ) => unknown
            ).call(this, type, ...rest);
          } as typeof HTMLCanvasElement.prototype.getContext;
        },
      ],
    });
    await expect(
      page.getByRole("heading", { name: "Lite mode" }),
    ).toBeVisible();
    await expect(page.getByText(/cannot draw 3D graphics/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Try the 3D office anyway" }),
    ).toHaveCount(0);
  });
});
