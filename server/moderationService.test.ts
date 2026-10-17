import { beforeEach, describe, expect, it } from "vitest";
import {
  BANNED_CODE,
  BANNED_MESSAGE,
  KICKED_CODE,
} from "../shared/moderation.ts";
import type { AuditInput } from "./auditStore.ts";
import { MemoryBanStore, type BanStore } from "./banStore.ts";
import {
  joinBan,
  moderate,
  type ModerationActor,
  type ModerationDeps,
  type ModerationRooms,
} from "./moderationService.ts";
import { MemoryUserStore } from "./userStore.ts";

const MINUTE = 60_000;

describe("moderate", () => {
  let users: MemoryUserStore;
  let bans: BanStore;
  let recorded: AuditInput[];
  /** Who is in the office, by user id. */
  let present: Set<string>;
  let removed: Array<[string, string, number, string]>;
  let muted: Array<[string, string, boolean]>;
  let voiceDown: boolean;
  let deps: ModerationDeps;

  const rooms: ModerationRooms = {
    removeUser: (floor, userId, code, message) => {
      removed.push([floor, userId, code, message]);
      return present.has(userId) ? 1 : 0;
    },
    setVoiceMuted: async (floor, userId, isMuted) => {
      if (voiceDown) throw new Error("LiveKit is down");
      muted.push([floor, userId, isMuted]);
      return present.has(userId) ? 1 : 0;
    },
  };

  const asAdmin: ModerationActor = {
    id: "user_boss",
    name: "Boss",
    roles: { admin: true, headOf: [] },
  };
  const asHead: ModerationActor = {
    id: "user_hana",
    name: "Hana",
    roles: { admin: false, headOf: ["office"] },
  };
  const asMember: ModerationActor = {
    id: "user_ana",
    name: "Ana",
    roles: { admin: false, headOf: [] },
  };

  beforeEach(async () => {
    users = new MemoryUserStore();
    for (const [id, name] of [
      ["user_boss", "Boss"],
      ["user_hana", "Hana"],
      ["user_ana", "Ana"],
      ["user_beto", "Beto"],
    ])
      await users.upsert({ id, email: null, name });
    await users.setAdmin("user_boss", true);
    await users.addHead("office", "user_hana");
    bans = new MemoryBanStore();
    recorded = [];
    removed = [];
    muted = [];
    present = new Set(["user_ana", "user_beto", "user_hana", "user_boss"]);
    voiceDown = false;
    deps = {
      users,
      bans,
      rooms,
      audit: async (entry) => {
        recorded.push(entry);
      },
      now: () => 1_000,
    };
  });

  describe("who may", () => {
    it("refuses a member, and does nothing", async () => {
      expect(
        await moderate(
          asMember,
          { action: "kick", targetUserId: "user_beto" },
          "office",
          deps,
        ),
      ).toEqual({ ok: false, reason: "not_allowed" });
      expect(removed).toEqual([]);
      expect(recorded).toEqual([]);
    });

    it("refuses the head of another floor", async () => {
      const elsewhere = {
        ...asHead,
        roles: { admin: false, headOf: ["sales"] },
      };
      expect(
        (
          await moderate(
            elsewhere,
            { action: "kick", targetUserId: "user_beto" },
            "office",
            deps,
          )
        ).ok,
      ).toBe(false);
    });

    it("refuses to act on yourself", async () => {
      expect(
        await moderate(
          asAdmin,
          { action: "kick", targetUserId: "user_boss" },
          "office",
          deps,
        ),
      ).toEqual({ ok: false, reason: "self" });
    });

    it("refuses to act on an admin, even for a head", async () => {
      expect(
        await moderate(
          asHead,
          { action: "ban", targetUserId: "user_boss", minutes: 10 },
          "office",
          deps,
        ),
      ).toEqual({ ok: false, reason: "admin" });
      expect(await bans.activeUntil("user_boss", 1_000)).toBeNull();
      expect(removed).toEqual([]);
    });

    it("looks the target's roles up now, not from what the room remembers", async () => {
      await users.setAdmin("user_beto", true);
      expect(
        (
          await moderate(
            asHead,
            { action: "kick", targetUserId: "user_beto" },
            "office",
            deps,
          )
        ).ok,
      ).toBe(false);
    });

    it("says there is nobody with that id, only to somebody who may moderate", async () => {
      expect(
        await moderate(
          asAdmin,
          { action: "kick", targetUserId: "user_nobody" },
          "office",
          deps,
        ),
      ).toEqual({ ok: false, reason: "unknown_user" });
      expect(
        await moderate(
          asMember,
          { action: "kick", targetUserId: "user_nobody" },
          "office",
          deps,
        ),
      ).toEqual({ ok: false, reason: "not_allowed" });
    });
  });

  describe("kick", () => {
    it("disconnects the person with the code and words for being removed", async () => {
      const reply = await moderate(
        asHead,
        { action: "kick", targetUserId: "user_beto" },
        "office",
        deps,
      );
      expect(reply).toEqual({ ok: true, action: "kick", name: "Beto" });
      expect(removed).toEqual([
        [
          "office",
          "user_beto",
          KICKED_CODE,
          "You were removed from the office by a moderator.",
        ],
      ]);
    });

    it("does not ban them: they may come back", async () => {
      await moderate(
        asHead,
        { action: "kick", targetUserId: "user_beto" },
        "office",
        deps,
      );
      expect(await bans.activeUntil("user_beto", 1_000)).toBeNull();
    });

    it("says so when they are not in the office, and records nothing", async () => {
      present.delete("user_beto");
      expect(
        await moderate(
          asHead,
          { action: "kick", targetUserId: "user_beto" },
          "office",
          deps,
        ),
      ).toEqual({ ok: false, reason: "not_here" });
      expect(recorded).toEqual([]);
    });

    it("records who removed whom", async () => {
      await moderate(
        asHead,
        { action: "kick", targetUserId: "user_beto" },
        "office",
        deps,
      );
      expect(recorded).toEqual([
        {
          actorUserId: "user_hana",
          actorName: "Hana",
          action: "moderation.kick",
          targetUserId: "user_beto",
          targetName: "Beto",
          floor: "office",
        },
      ]);
    });
  });

  describe("ban", () => {
    it("bans for the minutes asked, and sends them out with the ban's code", async () => {
      const reply = await moderate(
        asHead,
        { action: "ban", targetUserId: "user_beto", minutes: 30 },
        "office",
        deps,
      );
      expect(reply).toEqual({
        ok: true,
        action: "ban",
        name: "Beto",
        minutes: 30,
      });
      expect(await bans.activeUntil("user_beto", 1_000)).toBe(
        1_000 + 30 * MINUTE,
      );
      expect(removed[0].slice(0, 3)).toEqual([
        "office",
        "user_beto",
        BANNED_CODE,
      ]);
    });

    it("tells the store who banned", async () => {
      const calls: unknown[] = [];
      const ban = bans.ban.bind(bans);
      bans.ban = async (userId, minutes, now, meta) => {
        calls.push(meta);
        return ban(userId, minutes, now, meta);
      };
      await moderate(
        asHead,
        { action: "ban", targetUserId: "user_beto", minutes: 5 },
        "office",
        deps,
      );
      expect(calls).toEqual([{ byUserId: "user_hana" }]);
    });

    it("bans for ten minutes when no length is given", async () => {
      await moderate(
        asHead,
        { action: "ban", targetUserId: "user_beto" },
        "office",
        deps,
      );
      expect(await bans.activeUntil("user_beto", 1_000)).toBe(
        1_000 + 10 * MINUTE,
      );
    });

    it("keeps the length inside the bounds even if the caller did not", async () => {
      await moderate(
        asHead,
        { action: "ban", targetUserId: "user_beto", minutes: 999_999 },
        "office",
        deps,
      );
      expect(await bans.activeUntil("user_beto", 1_000)).toBe(
        1_000 + 240 * MINUTE,
      );
    });

    it("bans somebody who is not in the office now: it applies when they try to enter", async () => {
      present.delete("user_beto");
      expect(
        (
          await moderate(
            asHead,
            { action: "ban", targetUserId: "user_beto", minutes: 5 },
            "office",
            deps,
          )
        ).ok,
      ).toBe(true);
      expect(await bans.activeUntil("user_beto", 1_000)).not.toBeNull();
    });

    it("records the length", async () => {
      await moderate(
        asAdmin,
        { action: "ban", targetUserId: "user_beto", minutes: 15 },
        "office",
        deps,
      );
      expect(recorded).toEqual([
        expect.objectContaining({
          action: "moderation.ban",
          actorUserId: "user_boss",
          targetUserId: "user_beto",
          detail: { minutes: 15 },
        }),
      ]);
    });
  });

  describe("unban", () => {
    it("lifts a ban in force", async () => {
      await bans.ban("user_beto", 10, 1_000);
      expect(
        await moderate(
          asHead,
          { action: "unban", targetUserId: "user_beto" },
          "office",
          deps,
        ),
      ).toEqual({ ok: true, action: "unban", name: "Beto" });
      expect(await bans.activeUntil("user_beto", 1_000)).toBeNull();
      expect(recorded).toEqual([
        expect.objectContaining({ action: "moderation.unban" }),
      ]);
    });

    it("says when there was no ban", async () => {
      expect(
        await moderate(
          asHead,
          { action: "unban", targetUserId: "user_beto" },
          "office",
          deps,
        ),
      ).toEqual({ ok: false, reason: "not_banned" });
      expect(recorded).toEqual([]);
    });
  });

  describe("mute and unmute", () => {
    it("mutes their voice, and lets them speak again", async () => {
      expect(
        await moderate(
          asHead,
          { action: "mute", targetUserId: "user_beto" },
          "office",
          deps,
        ),
      ).toEqual({ ok: true, action: "mute", name: "Beto" });
      expect(
        (
          await moderate(
            asHead,
            { action: "unmute", targetUserId: "user_beto" },
            "office",
            deps,
          )
        ).ok,
      ).toBe(true);
      expect(muted).toEqual([
        ["office", "user_beto", true],
        ["office", "user_beto", false],
      ]);
      expect(recorded.map((entry) => entry.action)).toEqual([
        "moderation.mute",
        "moderation.unmute",
      ]);
    });

    it("says so when they are not in the office", async () => {
      present.delete("user_beto");
      expect(
        await moderate(
          asHead,
          { action: "mute", targetUserId: "user_beto" },
          "office",
          deps,
        ),
      ).toEqual({ ok: false, reason: "not_here" });
    });

    it("says it could not be done when the voice service fails, and records nothing", async () => {
      voiceDown = true;
      expect(
        await moderate(
          asHead,
          { action: "mute", targetUserId: "user_beto" },
          "office",
          deps,
        ),
      ).toEqual({ ok: false, reason: "unavailable" });
      expect(recorded).toEqual([]);
    });
  });

  describe("the server's own tools", () => {
    it("may moderate, and are recorded as such", async () => {
      const machine: ModerationActor = {
        id: null,
        name: "Server tools",
        roles: { admin: true, headOf: [] },
      };
      expect(
        (
          await moderate(
            machine,
            { action: "kick", targetUserId: "user_beto" },
            "office",
            deps,
          )
        ).ok,
      ).toBe(true);
      expect(recorded[0]).toMatchObject({
        actorUserId: null,
        actorName: "Server tools",
      });
    });
  });
});

describe("joinBan", () => {
  it("lets somebody who is not banned in", async () => {
    const bans = new MemoryBanStore();
    expect(await joinBan(bans, "user_ana", 0)).toBeNull();
  });

  it("refuses somebody who is banned, with the ban's code and words, until it ends", async () => {
    const bans = new MemoryBanStore();
    await bans.ban("user_ana", 10, 0);
    expect(await joinBan(bans, "user_ana", 9 * MINUTE)).toEqual({
      code: BANNED_CODE,
      message: BANNED_MESSAGE,
    });
    expect(await joinBan(bans, "user_ana", 10 * MINUTE)).toBeNull();
  });

  it("does not refuse anybody else", async () => {
    const bans = new MemoryBanStore();
    await bans.ban("user_ana", 10, 0);
    expect(await joinBan(bans, "user_beto", 0)).toBeNull();
  });
});
