import { test as base, expect, type Page } from "@playwright/test";
import {
  joinOffice,
  openPage,
  type JoinOptions,
  type OfficePlayer,
} from "./support/office";
import {
  joinPhone,
  type PhoneOptions,
  type PhonePlayer,
} from "./support/phone";

type PageOptions = Parameters<typeof openPage>[2];

interface Fixtures {
  /** Brings somebody into the office; everybody who came in is sent home when the test ends. */
  join: (name: string, options?: JoinOptions) => Promise<OfficePlayer>;
  /** Brings somebody in with a phone: touch only, no keyboard, no mouse. Everybody who came in is sent home when the test ends. */
  joinPhone: (name: string, options?: PhoneOptions) => Promise<PhonePlayer>;
  /** Opens a page of the app as somebody new, for what happens before the office (the lobby, the lite screen). */
  open: (path: string, options?: PageOptions) => Promise<Page>;
}

export const test = base.extend<Fixtures>({
  join: async ({ browser }, provide) => {
    const players: OfficePlayer[] = [];
    await provide(async (name, options) => {
      const player = await joinOffice(browser, name, options);
      players.push(player);
      return player;
    });
    await Promise.all(players.map((player) => player.close()));
  },
  joinPhone: async ({ browser }, provide) => {
    const players: PhonePlayer[] = [];
    await provide(async (name, options) => {
      const player = await joinPhone(browser, name, options);
      players.push(player);
      return player;
    });
    await Promise.all(players.map((player) => player.close()));
  },
  open: async ({ browser }, provide) => {
    const contexts: Awaited<ReturnType<typeof openPage>>["context"][] = [];
    await provide(async (path, options) => {
      const { context, page } = await openPage(browser, path, options);
      contexts.push(context);
      return page;
    });
    await Promise.all(contexts.map((context) => context.close()));
  },
});

export { expect };
