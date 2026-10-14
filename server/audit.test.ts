import { describe, expect, it, vi } from "vitest";
import type { Actor } from "./actor.ts";
import { auditActor, createRecorder } from "./audit.ts";
import { MemoryAuditStore, type AuditStore } from "./auditStore.ts";

describe("auditActor", () => {
  it("is the person, with the id and name of their account", () => {
    const actor: Actor = {
      kind: "user",
      user: { id: "user_ana", email: null, name: "Ana", isAdmin: true },
      roles: { admin: true, headOf: [] },
    };
    expect(auditActor(actor)).toEqual({
      actorUserId: "user_ana",
      actorName: "Ana",
    });
  });

  it("is the server's own tools, with no account", () => {
    expect(auditActor({ kind: "machine" })).toEqual({
      actorUserId: null,
      actorName: "Server tools",
    });
  });
});

describe("createRecorder", () => {
  it("writes to the store it is given now", async () => {
    const first = new MemoryAuditStore();
    const second = new MemoryAuditStore();
    let current: AuditStore = first;
    const record = createRecorder(() => current);
    await record({ actorUserId: null, actorName: "S", action: "floor.lock" });
    current = second;
    await record({ actorUserId: null, actorName: "S", action: "floor.unlock" });
    expect(await first.list({ limit: 10 })).toHaveLength(1);
    expect(await second.list({ limit: 10 })).toHaveLength(1);
  });

  it("never throws when the log cannot be written: the action it describes already happened", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const broken: AuditStore = {
      append: () => Promise.reject(new Error("down")),
      list: () => Promise.reject(new Error("down")),
    };
    const record = createRecorder(() => broken);
    await expect(
      record({ actorUserId: null, actorName: "S", action: "floor.lock" }),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
