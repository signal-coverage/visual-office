import {
  expect,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";
import type { E2ePose, E2eStats } from "../../src/game/e2eHook";
import type { Stance } from "./geometry";
import { hideDevOverlay } from "./devOverlay";
import { installFrameLimit } from "./frameLimit";
import { installFakePointerLock } from "./pointerLock";

export interface JoinOptions {
  /** Extra address parameters, e.g. `floor=lab`. */
  query?: string;
  viewport?: { width: number; height: number };
}

/** One person in the office: their own browser profile, page and (fake) mouse. */
export class OfficePlayer {
  readonly name: string;
  readonly context: BrowserContext;
  readonly page: Page;

  constructor(name: string, context: BrowserContext, page: Page) {
    this.name = name;
    this.context = context;
    this.page = page;
  }

  get menuButton(): Locator {
    return this.page.getByRole("button", { name: "Menu (Esc)" });
  }

  get menu(): Locator {
    return this.page.getByRole("dialog", { name: "Menu" });
  }

  get clickPrompt(): Locator {
    return this.page.getByText("Click to control your character");
  }

  get hint(): Locator {
    return this.page
      .locator("[role=status]")
      .filter({ hasText: /Click or F|Stand up/ });
  }

  people(): Locator {
    return this.page.getByLabel("People here");
  }

  /** What the browser does when the player presses Esc while the mouse is captured: it frees the mouse and tells the page. */
  async loseMouse() {
    await this.page.evaluate(() => document.exitPointerLock());
  }

  /** While refused, the browser does not give the mouse back (as just after Esc): the click prompt shows until it does. */
  async refuseMouse(refuse: boolean) {
    await this.page.evaluate((value) => {
      window.__refusePointerLock = value;
    }, refuse);
  }

  async isLocked(): Promise<boolean> {
    return this.page.evaluate(() => document.pointerLockElement !== null);
  }

  async waitUntilLocked() {
    await expect.poll(() => this.isLocked()).toBe(true);
    await expect(this.clickPrompt).toBeHidden();
  }

  async waitUntilFree() {
    await expect.poll(() => this.isLocked()).toBe(false);
  }

  async openMenu() {
    await this.loseMouse();
    await expect(this.menu).toBeVisible();
  }

  async menuItem(name: string) {
    await this.menu.getByRole("button", { name, exact: true }).click();
  }

  async closeMenu() {
    await this.menu.getByRole("button", { name: "Back to the office" }).click();
    await expect(this.menu).toBeHidden();
    await this.waitUntilLocked();
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

  async hold(...codes: string[]) {
    for (const code of codes) await this.page.keyboard.down(code);
  }

  async release(...codes: string[]) {
    for (const code of codes) await this.page.keyboard.up(code);
  }

  async tap(code: string) {
    await this.page.keyboard.press(code);
  }

  /** Writes a chat message the way a player does: Enter, the text, Enter. */
  async say(text: string, to?: string) {
    await this.tap("Enter");
    const input = this.page.getByRole("textbox", { name: /press Enter/ });
    await expect(input).toBeVisible();
    if (to === undefined) {
      await this.page.getByRole("tab", { name: "Everyone" }).click();
    } else {
      await this.page.getByRole("tab", { name: "Direct" }).click();
      await this.page
        .getByRole("button", { name: /Choose somebody|Send the message to/ })
        .click();
      await this.page.getByRole("option", { name: to }).click();
    }
    await this.page.getByRole("textbox", { name: /press Enter/ }).fill(text);
    await this.page.keyboard.press("Enter");
    await expect(
      this.page.getByRole("textbox", { name: /press Enter/ }),
    ).toBeHidden();
  }

  async close() {
    await this.context.close();
  }
}

/** A player's own browser profile on a page of the app, with the fake mouse capture installed and nothing waited for. */
export async function openPage(
  browser: Browser,
  path: string,
  options: Pick<JoinOptions, "viewport"> & {
    hasTouch?: boolean;
    isMobile?: boolean;
    /** More that runs inside the page before the app does. */
    init?: Array<() => void>;
  } = {},
): Promise<{ context: BrowserContext; page: Page }> {
  const { viewport, hasTouch, isMobile, init = [] } = options;
  const context = await browser.newContext({ viewport, hasTouch, isMobile });
  await context.addInitScript(installFakePointerLock);
  await context.addInitScript(installFrameLimit);
  await context.addInitScript(hideDevOverlay);
  for (const script of init) await context.addInitScript(script);
  const page = await context.newPage();
  await page.goto(path);
  return { context, page };
}

/** Opens a player's own browser profile, goes into the office and waits until they stand in it with the mouse captured. */
export async function joinOffice(
  browser: Browser,
  name: string,
  options: JoinOptions = {},
): Promise<OfficePlayer> {
  const extra = options.query ? `&${options.query}` : "";
  const { context, page } = await openPage(
    browser,
    `/?name=${encodeURIComponent(name)}&e2e${extra}`,
    options,
  );
  const player = new OfficePlayer(name, context, page);
  await expect(player.menuButton).toBeVisible();
  await page.waitForFunction(() => window.__e2e !== undefined);
  await player.waitUntilLocked();
  return player;
}
