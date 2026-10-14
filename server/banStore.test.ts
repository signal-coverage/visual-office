import { describe, expect, it } from "vitest";
import { MemoryBanStore } from "./banStore.ts";

const MINUTE = 60_000;

describe("MemoryBanStore", () => {
  it("knows nobody is banned at first", async () => {
    const bans = new MemoryBanStore();
    expect(await bans.activeUntil("user_ana", 1000)).toBeNull();
  });

  it("bans for a number of minutes and says until when", async () => {
    const bans = new MemoryBanStore();
    expect(await bans.ban("user_ana", 10, 1000)).toBe(1000 + 10 * MINUTE);
    expect(await bans.activeUntil("user_ana", 1000 + 9 * MINUTE)).toBe(
      1000 + 10 * MINUTE,
    );
  });

  it("lets the ban lapse by itself", async () => {
    const bans = new MemoryBanStore();
    await bans.ban("user_ana", 10, 1000);
    expect(await bans.activeUntil("user_ana", 1000 + 10 * MINUTE)).toBeNull();
    expect(await bans.list(1000 + 10 * MINUTE)).toEqual([]);
  });

  it("replaces the end when somebody is banned again", async () => {
    const bans = new MemoryBanStore();
    await bans.ban("user_ana", 30, 0);
    expect(await bans.ban("user_ana", 5, 0)).toBe(5 * MINUTE);
    expect(await bans.activeUntil("user_ana", 0)).toBe(5 * MINUTE);
  });

  it("lifts a ban, and says whether there was one", async () => {
    const bans = new MemoryBanStore();
    await bans.ban("user_ana", 10, 0);
    expect(await bans.lift("user_ana", 0)).toBe(true);
    expect(await bans.activeUntil("user_ana", 0)).toBeNull();
    expect(await bans.lift("user_ana", 0)).toBe(false);
  });

  it("does not count a lapsed ban as one to lift", async () => {
    const bans = new MemoryBanStore();
    await bans.ban("user_ana", 1, 0);
    expect(await bans.lift("user_ana", 2 * MINUTE)).toBe(false);
  });

  it("lists the bans in force", async () => {
    const bans = new MemoryBanStore();
    await bans.ban("user_ana", 10, 0);
    await bans.ban("user_beto", 20, 0);
    expect(await bans.list(0)).toEqual([
      { userId: "user_ana", until: 10 * MINUTE },
      { userId: "user_beto", until: 20 * MINUTE },
    ]);
  });
});
