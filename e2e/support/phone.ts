import {
  expect,
  type Browser,
  type BrowserContext,
  type CDPSession,
  type Locator,
  type Page,
} from "@playwright/test";
import type { E2ePose, E2eStats } from "../../src/game/e2eHook";
import type { Stance } from "./geometry";
import { openPage } from "./office";

/** An iPhone 14 Pro is 393 x 852; these are the round sizes of the phones the task names. */
export const PORTRAIT = { width: 390, height: 844 };
export const LANDSCAPE = { width: 844, height: 390 };

declare global {
  interface Window {
    /** Counted by the spy below: how many times the page asked to capture the mouse. */
    __lockRequests?: number;
    /** Counted by the spy below: how many times the page asked for the microphone or the camera. */
    __mediaRequests?: number;
  }
}

/** Runs inside the page: counts the calls that a phone should never make (the mouse) or should make only when asked (the microphone). */
export function installSpies() {
  window.__lockRequests = 0;
  window.__mediaRequests = 0;
  const request = Element.prototype.requestPointerLock;
  Element.prototype.requestPointerLock = function (this: Element) {
    window.__lockRequests = (window.__lockRequests ?? 0) + 1;
    return request.call(this);
  } as typeof Element.prototype.requestPointerLock;
  const devices = navigator.mediaDevices;
  if (devices?.getUserMedia) {
    const ask = devices.getUserMedia.bind(devices);
    devices.getUserMedia = (constraints) => {
      window.__mediaRequests = (window.__mediaRequests ?? 0) + 1;
      return ask(constraints);
    };
  }
}

/**
 * Runs inside the page, before the app does: the message with which the game
 * server hands out the voice call never reaches the page, as when the server
 * has no voice to offer. (A room's messages are a code, 13, then the name of the
 * message as a short string, then what it carries.)
 */
export function dropVoiceMessages() {
  const Native = window.WebSocket;
  window.WebSocket = class extends Native {
    constructor(...args: ConstructorParameters<typeof WebSocket>) {
      super(...args);
      this.addEventListener("message", (event) => {
        if (!(event.data instanceof ArrayBuffer)) return;
        const bytes = new Uint8Array(event.data);
        const name = String.fromCharCode(...bytes.subarray(2, 7));
        if (bytes[0] === 13 && bytes[1] === 0xa5 && name === "voice")
          event.stopImmediatePropagation();
      });
    }
  } as typeof WebSocket;
}

/** Fingers on the screen, one by one, the way a real touch screen reports them: every event lists the fingers that are down. */
export class Fingers {
  private readonly cdp: CDPSession;
  private readonly down = new Map<number, { x: number; y: number }>();

  private constructor(cdp: CDPSession) {
    this.cdp = cdp;
  }

  static async on(page: Page): Promise<Fingers> {
    return new Fingers(await page.context().newCDPSession(page));
  }

  private send(type: "touchStart" | "touchMove" | "touchEnd") {
    return this.cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: [...this.down].map(([id, { x, y }]) => ({ id, x, y })),
    });
  }

  async press(id: number, x: number, y: number) {
    this.down.set(id, { x, y });
    await this.send("touchStart");
  }

  async slide(id: number, x: number, y: number) {
    if (!this.down.has(id)) throw new Error(`Finger ${id} is not down`);
    this.down.set(id, { x, y });
    await this.send("touchMove");
  }

  async lift(id: number) {
    this.down.delete(id);
    await this.send("touchEnd");
  }
}

/** One person with a phone in the office: their own browser profile and page, walked with fingers. */
export class PhonePlayer {
  readonly name: string;
  readonly context: BrowserContext;
  readonly page: Page;
  readonly fingers: Fingers;

  constructor(
    name: string,
    context: BrowserContext,
    page: Page,
    fingers: Fingers,
  ) {
    this.name = name;
    this.context = context;
    this.page = page;
    this.fingers = fingers;
  }

  button(name: string): Locator {
    return this.page.getByRole("button", { name, exact: true });
  }

  get stick(): Locator {
    return this.page.getByTestId("touch-stick");
  }

  get clickPrompt(): Locator {
    return this.page.getByText("Click to control your character");
  }

  get menu(): Locator {
    return this.page.getByRole("dialog", { name: "Menu" });
  }

  position(): Promise<E2ePose> {
    return this.page.evaluate(() => window.__e2e!.position());
  }

  stats(): Promise<E2eStats> {
    return this.page.evaluate(() => window.__e2e!.stats());
  }

  async teleport(x: number, z: number, yaw: number, pitch = 0) {
    await this.page.evaluate(
      ([px, pz, pyaw, ppitch]) => window.__e2e!.teleport(px, pz, pyaw, ppitch),
      [x, z, yaw, pitch],
    );
  }

  /** Walks, point by point, the way the server will accept: never through furniture. */
  async walk(route: readonly Stance[]) {
    for (const { x, z, yaw, pitch } of route)
      await this.teleport(x, z, yaw, pitch);
  }

  async stickCentre(): Promise<{ x: number; y: number }> {
    const box = await this.stick.boundingBox();
    if (!box) throw new Error("The joystick is not on screen");
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  /** Puts the left thumb on the joystick and pushes it `dx` right and `dy` down from its middle; it stays there until `releaseStick`. */
  async pushStick(dx: number, dy: number) {
    const { x, y } = await this.stickCentre();
    await this.fingers.press(1, x, y);
    await this.fingers.slide(1, x + dx, y + dy);
  }

  async releaseStick() {
    await this.fingers.lift(1);
  }

  /** Drags the right thumb across the scene, from one point to another, in a few steps. */
  async dragLook(
    from: { x: number; y: number },
    to: { x: number; y: number },
    steps = 6,
  ) {
    await this.fingers.press(2, from.x, from.y);
    for (let step = 1; step <= steps; step++)
      await this.fingers.slide(
        2,
        from.x + ((to.x - from.x) * step) / steps,
        from.y + ((to.y - from.y) * step) / steps,
      );
    await this.fingers.lift(2);
  }

  async close() {
    await this.context.close();
  }
}

export interface PhoneOptions {
  viewport?: { width: number; height: number };
  /** Extra address parameters. */
  query?: string;
  /** Leaves the first-run hint on screen instead of dismissing it. */
  keepHint?: boolean;
}

/** A phone's own browser profile, in the office, with the joystick on screen and (unless asked) the first-run hint put away. */
export async function joinPhone(
  browser: Browser,
  name: string,
  options: PhoneOptions = {},
): Promise<PhonePlayer> {
  const extra = options.query ? `&${options.query}` : "";
  const { context, page } = await openPage(
    browser,
    `/?name=${encodeURIComponent(name)}&e2e${extra}`,
    {
      viewport: options.viewport ?? PORTRAIT,
      hasTouch: true,
      isMobile: true,
      init: [installSpies],
    },
  );
  const player = new PhonePlayer(name, context, page, await Fingers.on(page));
  await expect(player.stick).toBeVisible();
  await page.waitForFunction(() => window.__e2e !== undefined);
  if (!options.keepHint) {
    await page.getByRole("button", { name: "Got it" }).click();
    await expect(
      page.getByRole("dialog", { name: "How to move" }),
    ).toBeHidden();
  }
  return player;
}
